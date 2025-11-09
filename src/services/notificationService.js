const { supabase } = require('../lib/supabase');
const { admin, isInitialized } = require('../lib/firebase');

class NotificationService {
  static async getNotifications(userUid, page = 1, limit = 20) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_uid', userUid)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return {
      notifications: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    };
  }

  static async markNotificationAsRead(notificationId, userUid) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_uid', userUid);

    if (error) throw error;
  }

  static async markAllNotificationsAsRead(userUid) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_uid', userUid)
      .eq('is_read', false);

    if (error) throw error;
  }

  static async getUnreadCount(userUid) {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_uid', userUid)
      .eq('is_read', false);

    if (error) throw error;
    return count || 0;
  }

  static async registerFCMToken(userUid, tokenData) {
    const tokenDataWithUser = {
      user_uid: userUid,
      fcm_token: tokenData.fcm_token,
      device_id: tokenData.device_id,
      device_type: tokenData.device_type || 'android',
    };

    const { data, error } = await supabase
      .from('user_fcm_tokens')
      .upsert(tokenDataWithUser, { 
        onConflict: 'user_uid,device_id',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (error) throw error;
    console.log('FCM token registered/updated (service)', {
      user_uid: userUid,
      device_id: tokenData.device_id,
    });
    return data;
  }

  static async getUserFCMTokens(userUid) {
    const { data, error } = await supabase
      .from('user_fcm_tokens')
      .select('*')
      .eq('user_uid', userUid)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async deactivateFCMToken(userUid, fcmToken) {
    const { error } = await supabase
      .from('user_fcm_tokens')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_uid', userUid)
      .eq('fcm_token', fcmToken);

    if (error) throw error;
    console.log('FCM token deactivated (service)', {
      user_uid: userUid,
      fcm_token: fcmToken,
    });
  }

  static async createNotification(notificationData) {
    const { data, error } = await supabase
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getActiveFCMTokensForUser(userUid) {
    console.log(`🔍 [FCM TOKEN LOOKUP] Looking up FCM tokens for user: ${userUid}`);
    
    const { data, error } = await supabase
      .from('user_fcm_tokens')
      .select('fcm_token, device_id, device_type, is_active, created_at')
      .eq('user_uid', userUid)
      .eq('is_active', true);

    if (error) {
      console.error(`❌ [FCM TOKEN LOOKUP] Database error retrieving tokens for user ${userUid}:`, error);
      throw error;
    }
    
    const tokens = data?.map(token => token.fcm_token) || [];
    console.log(`📱 [FCM TOKEN LOOKUP] Found ${tokens.length} active token(s) for user ${userUid}`);
    
    if (data && data.length > 0) {
      console.log(`   Token details:`, data.map(t => ({
        device_id: t.device_id,
        device_type: t.device_type,
        token_prefix: t.fcm_token?.substring(0, 20) + '...'
      })));
    } else {
      console.log(`   ⚠️  No active FCM tokens found in database for user ${userUid}`);
      console.log(`   This could mean:`);
      console.log(`   - User hasn't registered FCM token yet`);
      console.log(`   - Token was deactivated`);
      console.log(`   - User UID mismatch between registration and lookup`);
    }
    
    return tokens;
  }

  /**
   * Send FCM push notification to a user
   * @param {string} userUid - User ID to send notification to
   * @param {Object} notificationData - Notification data
   * @param {string} notificationData.title - Notification title
   * @param {string} notificationData.body - Notification body
   * @param {Object} notificationData.data - Additional data payload
   */
  static async sendFCMNotification(userUid, notificationData) {
    try {
      console.log(`🔔 [FCM NOTIFICATION] Starting FCM notification send to user: ${userUid}`);
      console.log(`   Notification type: ${notificationData.data?.type || 'general'}`);
      console.log(`   Title: ${notificationData.title}`);
      
      // Check if Firebase is initialized
      if (!isInitialized || !admin) {
        console.error('❌ [FCM NOTIFICATION] Firebase Admin SDK not initialized - skipping FCM notification');
        console.error(`   isInitialized: ${isInitialized}, admin exists: ${!!admin}`);
        console.error(`   This means FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY may be missing or invalid`);
        return { success: false, message: 'Firebase not initialized' };
      }
      
      console.log(`✅ [FCM NOTIFICATION] Firebase Admin SDK is initialized`);

      // Get active FCM tokens for the user
      console.log(`🔍 Retrieving FCM tokens for user: ${userUid}`);
      const fcmTokens = await this.getActiveFCMTokensForUser(userUid);
      console.log(`📱 Found ${fcmTokens.length} FCM tokens for user ${userUid}`);

      if (!fcmTokens || fcmTokens.length === 0) {
        console.log(`No active FCM tokens found for user ${userUid}`);
        return { success: false, message: 'No active FCM tokens found' };
      }

      // Prepare the FCM message
      // Convert all data values to strings (FCM requirement)
      const dataPayload = {
        type: String(notificationData.data?.type || 'general'),
        title: String(notificationData.title || ''),
        body: String(notificationData.body || ''),
      };
      
      // Add additional data fields, ensuring all values are strings
      if (notificationData.data) {
        Object.keys(notificationData.data).forEach(key => {
          if (key !== 'type') { // Already added above
            const value = notificationData.data[key];
            dataPayload[key] = value !== null && value !== undefined ? String(value) : '';
          }
        });
      }

      const message = {
        tokens: fcmTokens, // Send to multiple tokens
        notification: {
          title: notificationData.title,
          body: notificationData.body,
        },
        data: dataPayload,
        android: {
          priority: 'high',
          notification: {
            channelId: 'career_connect_notifications',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
            // Click action is handled by Android service via PendingIntent
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      // Send the message using Firebase Admin SDK
      console.log(`🔥 Sending FCM notification to user ${userUid} with ${fcmTokens.length} tokens`);
      console.log(`📱 FCM message:`, JSON.stringify(message, null, 2));

      // Check if sendMulticast is available (Firebase Admin SDK v8.0.0+)
      let messaging;
      try {
        messaging = admin.messaging();
      } catch (error) {
        console.error('❌ [FCM NOTIFICATION] Error getting Firebase Messaging service:', error.message);
        return { success: false, message: 'Firebase Messaging service error' };
      }

      // Verify messaging is available
      if (!messaging) {
        console.error('❌ [FCM NOTIFICATION] Firebase Messaging is not available');
        return { success: false, message: 'Firebase Messaging not available' };
      }

      console.log(`📦 [FCM NOTIFICATION] Firebase Admin SDK version check - messaging object type: ${typeof messaging}`);
      console.log(`📦 [FCM NOTIFICATION] sendMulticast available: ${typeof messaging.sendMulticast}`);
      console.log(`📦 [FCM NOTIFICATION] send available: ${typeof messaging.send}`);

      let successCount = 0;
      let failureCount = 0;
      const failedTokens = [];

      if (typeof messaging.sendMulticast === 'function') {
        // Use sendMulticast for multiple tokens (preferred method)
        console.log(`📤 Using sendMulticast for ${fcmTokens.length} tokens`);
        try {
          const response = await messaging.sendMulticast(message);

          successCount = response.successCount || 0;
          failureCount = response.failureCount || 0;

          console.log(`✅ FCM notification result for user ${userUid}:`, {
            successCount: response.successCount,
            failureCount: response.failureCount,
            totalTokens: fcmTokens.length,
          });

          if (response.failureCount > 0 && response.responses) {
            console.log(`❌ FCM failures:`, response.responses.filter(r => !r.success).map(r => r.error));
            response.responses.forEach((resp, idx) => {
              if (!resp.success) {
                console.log(`FCM token failed: ${fcmTokens[idx]}, Error: ${resp.error}`);
                failedTokens.push(fcmTokens[idx]);
              }
            });
          }
        } catch (sendError) {
          console.error(`❌ [FCM NOTIFICATION] Error with sendMulticast:`, sendError.message);
          console.log(`📤 Falling back to individual send method`);
          // Fall back to individual send method
          await sendIndividualMessages();
        }
      } else {
        // Fallback: Use send for each token individually (for older SDK versions)
        console.log(`📤 sendMulticast not available, using send for each token individually`);
        console.log(`⚠️  Consider updating firebase-admin to v8.0.0+ for better performance`);
        await sendIndividualMessages();
      }

      async function sendIndividualMessages() {
        const sendPromises = fcmTokens.map(async (token, index) => {
          try {
            const singleMessage = {
              token: token,
              notification: message.notification,
              data: message.data,
              android: message.android,
              apns: message.apns,
            };

            await messaging.send(singleMessage);
            successCount++;
            console.log(`✅ Successfully sent to token ${index + 1}/${fcmTokens.length}`);
            return { success: true, token };
          } catch (error) {
            failureCount++;
            console.error(`❌ Failed to send to token ${index + 1}/${fcmTokens.length}:`, error.message);
            failedTokens.push(token);
            return { success: false, token, error };
          }
        });

        await Promise.allSettled(sendPromises);

        console.log(`✅ FCM notification result for user ${userUid}:`, {
          successCount: successCount,
          failureCount: failureCount,
          totalTokens: fcmTokens.length,
        });
      }

      // Handle failed tokens (could be expired or invalid)
      if (failedTokens.length > 0) {
        console.log(`⚠️  ${failedTokens.length} token(s) failed. Attempting to deactivate...`);
        await this.deactivateFailedTokens(userUid, failedTokens);
      }

      return {
        success: successCount > 0,
        successCount: successCount,
        failureCount: failureCount,
        totalTokens: fcmTokens.length,
      };
    } catch (error) {
      console.error('Error sending FCM notification:', error);
      throw error;
    }
  }

  /**
   * Deactivate FCM tokens that failed to receive notifications
   */
  static async deactivateFailedTokens(userUid, failedTokens) {
    try {
      for (const token of failedTokens) {
        await this.deactivateFCMToken(userUid, token);
      }
      console.log(`Deactivated ${failedTokens.length} failed FCM tokens for user ${userUid}`);
    } catch (error) {
      console.error('Error deactivating failed FCM tokens:', error);
    }
  }
}

module.exports = { NotificationService };
