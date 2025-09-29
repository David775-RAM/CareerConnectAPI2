const express = require('express');
const { supabase } = require('../lib/supabase');
const { verifyFirebaseIdToken } = require('../middleware/auth');
const { z } = require('zod');

const router = express.Router();

// Validation schemas
const createCvSchema = z.object({
  file_name: z.string().min(1).max(255),
  file_url: z.string().url(),
  file_size: z.number().int().positive().optional(),
  is_primary: z.boolean().default(false),
});

const updateCvSchema = z.object({
  file_name: z.string().min(1).max(255).optional(),
  is_primary: z.boolean().optional(),
});

// GET /cvs - Get user's CVs
router.get('/', verifyFirebaseIdToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('cvs')
      .select('*')
      .eq('user_uid', req.user.firebaseUid)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json(data);
  } catch (error) {
    console.error('Error fetching CVs:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /cvs - Upload new CV
router.post('/', verifyFirebaseIdToken, async (req, res) => {
  try {
    const validation = createCvSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }

    // If setting as primary, unset other primary CVs
    if (validation.data.is_primary) {
      await supabase
        .from('cvs')
        .update({ is_primary: false })
        .eq('user_uid', req.user.firebaseUid);
    }

    const cvData = {
      user_uid: req.user.firebaseUid,
      ...validation.data,
    };

    const { data, error } = await supabase
      .from('cvs')
      .insert(cvData)
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json(data);
  } catch (error) {
    console.error('Error creating CV:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /cvs/:id - Update CV
router.put('/:id', verifyFirebaseIdToken, async (req, res) => {
  try {
    const validation = updateCvSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }

    // Check if CV belongs to user
    const { data: existingCv, error: fetchError } = await supabase
      .from('cvs')
      .select('user_uid')
      .eq('id', req.params.id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'CV not found' });
      }
      throw fetchError;
    }

    if (existingCv.user_uid !== req.user.firebaseUid) {
      return res.status(403).json({ error: 'Access denied. You can only update your own CVs.' });
    }

    // If setting as primary, unset other primary CVs
    if (validation.data.is_primary) {
      await supabase
        .from('cvs')
        .update({ is_primary: false })
        .eq('user_uid', req.user.firebaseUid);
    }

    const { data, error } = await supabase
      .from('cvs')
      .update(validation.data)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    return res.json(data);
  } catch (error) {
    console.error('Error updating CV:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /cvs/:id - Delete CV
router.delete('/:id', verifyFirebaseIdToken, async (req, res) => {
  try {
    // Check if CV belongs to user
    const { data: existingCv, error: fetchError } = await supabase
      .from('cvs')
      .select('user_uid, is_primary')
      .eq('id', req.params.id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'CV not found' });
      }
      throw fetchError;
    }

    if (existingCv.user_uid !== req.user.firebaseUid) {
      return res.status(403).json({ error: 'Access denied. You can only delete your own CVs.' });
    }

    const { error } = await supabase
      .from('cvs')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting CV:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

