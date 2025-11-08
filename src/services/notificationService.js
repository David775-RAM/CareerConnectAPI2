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
    const { data, error } = await supabase
      .from('user_fcm_tokens')
      .select('fcm_token')
      .eq('user_uid', userUid)
      .eq('is_active', true);

    if (error) throw error;
    return data?.map(token => token.fcm_token) || [];
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
      // Check if Firebase is initialized
      if (!isInitialized || !admin) {
        console.log('🔶 Firebase not initialized - skipping FCM notification');
        return { success: false, message: 'Firebase not initialized' };
      }

      // Get active FCM tokens for the user
      const fcmTokens = await this.getActiveFCMTokensForUser(userUid);

      if (!fcmTokens || fcmTokens.length === 0) {
        console.log(`No active FCM tokens found for user ${userUid}`);
        return { success: false, message: 'No active FCM tokens found' };
      }

      // Prepare the FCM message
      const message = {
        tokens: fcmTokens, // Send to multiple tokens
        notification: {
          title: notificationData.title,
          body: notificationData.body,
        },
        data: {
          type: notificationData.data?.type || 'general',
          title: notificationData.title,
          body: notificationData.body,
          ...notificationData.data, // Include additional data
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'career_connect_notifications',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
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
      const response = await admin.messaging().sendMulticast(message);

      console.log(`FCM notification sent to user ${userUid}:`, {
        successCount: response.successCount,
        failureCount: response.failureCount,
        totalTokens: fcmTokens.length,
      });

      // Handle failed tokens (could be expired or invalid)
      if (response.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.log(`FCM token failed: ${fcmTokens[idx]}, Error: ${resp.error}`);
            failedTokens.push(fcmTokens[idx]);
          }
        });

        // Optionally deactivate failed tokens
        if (failedTokens.length > 0) {
          await this.deactivateFailedTokens(userUid, failedTokens);
        }
      }

      return {
        success: response.successCount > 0,
        successCount: response.successCount,
        failureCount: response.failureCount,
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
