const express = require('express');
const { supabase } = require('../lib/supabase');
const { verifyFirebaseIdToken } = require('../middleware/auth');
const { z } = require('zod');

const router = express.Router();

// Validation schemas
const createProfileSchema = z.object({
  user_type: z.enum(['job_seeker', 'recruiter']),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  location: z.string().optional(),
  company_name: z.string().optional(),
  bio: z.string().optional(),
  profile_image_url: z.string().url().optional(),
});

const updateProfileSchema = createProfileSchema.partial();

// GET /profiles/me - Get current user's profile
router.get('/me', verifyFirebaseIdToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('firebase_uid', req.user.firebaseUid)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Profile not found' });
      }
      throw error;
    }

    return res.json(data);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /profiles/me - Create user profile
router.post('/me', verifyFirebaseIdToken, async (req, res) => {
  try {
    const validation = createProfileSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }

    const profileData = {
      firebase_uid: req.user.firebaseUid,
      email: req.user.email || validation.data.email,
      ...validation.data,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('user_profiles')
      .insert(profileData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Profile already exists' });
      }
      throw error;
    }

    return res.status(201).json(data);
  } catch (error) {
    console.error('Error creating profile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /profiles/me - Update user profile
router.put('/me', verifyFirebaseIdToken, async (req, res) => {
  try {
    const validation = updateProfileSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }

    const updateData = {
      ...validation.data,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('firebase_uid', req.user.firebaseUid)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Profile not found' });
      }
      throw error;
    }

    return res.json(data);
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

