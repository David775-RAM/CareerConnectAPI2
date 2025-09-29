const { supabase } = require('../lib/supabase');

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
        onConflict: 'user_uid,fcm_token',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (error) throw error;
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
}

module.exports = { NotificationService };
