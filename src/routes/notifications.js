const express = require('express');
const { supabase } = require('../lib/supabase');
const { verifyFirebaseIdToken } = require('../middleware/auth');
const { z } = require('zod');

const router = express.Router();

// Validation schemas
const fcmTokenSchema = z.object({
  fcm_token: z.string().min(1),
  device_id: z.string().min(1),
  device_type: z.enum(['android', 'ios', 'web']).default('android'),
});

const markReadSchema = z.object({
  is_read: z.boolean(),
});

// GET /notifications - Get user's notifications
router.get('/', verifyFirebaseIdToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, unread_only = false } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('notifications')
      .select(`
        id,
        title,
        message,
        type,
        related_job_id,
        related_application_id,
        is_read,
        created_at,
        job_postings!notifications_related_job_id_fkey (
          id,
          title,
          company_name
        ),
        applications!notifications_related_application_id_fkey (
          id,
          status
        )
      `)
      .eq('user_uid', req.user.firebaseUid)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (unread_only === 'true') {
      query = query.eq('is_read', false);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return res.json({
      notifications: data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /notifications/:id/read - Mark notification as read/unread
router.patch('/:id/read', verifyFirebaseIdToken, async (req, res) => {
  try {
    const validation = markReadSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }

    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: validation.data.is_read })
      .eq('id', req.params.id)
      .eq('user_uid', req.user.firebaseUid)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Notification not found' });
      }
      throw error;
    }

    return res.json(data);
  } catch (error) {
    console.error('Error updating notification:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /notifications/mark-all-read - Mark all notifications as read
router.patch('/mark-all-read', verifyFirebaseIdToken, async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_uid', req.user.firebaseUid)
      .eq('is_read', false);

    if (error) throw error;

    return res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /notifications/unread-count - Get unread notification count
router.get('/unread-count', verifyFirebaseIdToken, async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_uid', req.user.firebaseUid)
      .eq('is_read', false);

    if (error) throw error;

    return res.json({ unread_count: count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /fcm/tokens - Register FCM token
router.post('/fcm/tokens', verifyFirebaseIdToken, async (req, res) => {
  try {
    const validation = fcmTokenSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }

    const tokenData = {
      user_uid: req.user.firebaseUid,
      fcm_token: validation.data.fcm_token,
      device_id: validation.data.device_id,
      device_type: validation.data.device_type,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('user_fcm_tokens')
      .upsert(tokenData, { 
        onConflict: 'user_uid,device_id',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (error) throw error;

    console.log('FCM token registered/updated', {
      user_uid: tokenData.user_uid,
      device_id: tokenData.device_id,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error registering FCM token:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /fcm/tokens/:token - Deactivate FCM token
router.delete('/fcm/tokens/:token', verifyFirebaseIdToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('user_fcm_tokens')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_uid', req.user.firebaseUid)
      .eq('fcm_token', req.params.token)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'FCM token not found' });
      }
      throw error;
    }

    console.log('FCM token deactivated', {
      user_uid: req.user.firebaseUid,
      fcm_token: req.params.token,
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error deactivating FCM token:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /fcm/tokens - Get user's FCM tokens
router.get('/fcm/tokens', verifyFirebaseIdToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('user_fcm_tokens')
      .select('id, device_id, device_type, is_active, created_at, updated_at')
      .eq('user_uid', req.user.firebaseUid)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json(data);
  } catch (error) {
    console.error('Error fetching FCM tokens:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

