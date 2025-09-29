const express = require('express');
const { supabase } = require('../lib/supabase');
const { verifyFirebaseIdToken } = require('../middleware/auth');
const { z } = require('zod');

const router = express.Router();

// Validation schemas
const saveJobSchema = z.object({
  job_id: z.string().uuid(),
});

// GET /saved - Get user's saved jobs
router.get('/', verifyFirebaseIdToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('saved_jobs')
      .select(`
        id,
        created_at,
        job_postings!saved_jobs_job_id_fkey (
          id,
          title,
          description,
          company_name,
          location,
          job_type,
          salary_min,
          salary_max,
          experience_level,
          industry,
          requirements,
          benefits,
          is_active,
          created_at,
          updated_at,
          user_profiles!job_postings_recruiter_uid_fkey (
            first_name,
            last_name,
            company_name,
            profile_image_url
          )
        )
      `)
      .eq('user_uid', req.user.firebaseUid)
      .eq('job_postings.is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json(data);
  } catch (error) {
    console.error('Error fetching saved jobs:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /saved - Save a job
router.post('/', verifyFirebaseIdToken, async (req, res) => {
  try {
    const validation = saveJobSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }

    // Check if job exists and is active
    const { data: job, error: jobError } = await supabase
      .from('job_postings')
      .select('id, title')
      .eq('id', validation.data.job_id)
      .eq('is_active', true)
      .single();

    if (jobError) {
      if (jobError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Job not found or not active' });
      }
      throw jobError;
    }

    const saveData = {
      user_uid: req.user.firebaseUid,
      job_id: validation.data.job_id,
    };

    const { data, error } = await supabase
      .from('saved_jobs')
      .insert(saveData)
      .select(`
        *,
        job_postings!saved_jobs_job_id_fkey (
          id,
          title,
          company_name,
          location,
          job_type,
          salary_min,
          salary_max,
          created_at
        )
      `)
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Job already saved' });
      }
      throw error;
    }

    return res.status(201).json(data);
  } catch (error) {
    console.error('Error saving job:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /saved/:job_id - Remove saved job
router.delete('/:job_id', verifyFirebaseIdToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('saved_jobs')
      .delete()
      .eq('user_uid', req.user.firebaseUid)
      .eq('job_id', req.params.job_id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Saved job not found' });
      }
      throw error;
    }

    return res.status(204).send();
  } catch (error) {
    console.error('Error removing saved job:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /saved/check/:job_id - Check if job is saved
router.get('/check/:job_id', verifyFirebaseIdToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('saved_jobs')
      .select('id')
      .eq('user_uid', req.user.firebaseUid)
      .eq('job_id', req.params.job_id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return res.json({ is_saved: !!data });
  } catch (error) {
    console.error('Error checking saved job:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

