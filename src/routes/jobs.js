const express = require('express');
const { supabase } = require('../lib/supabase');
const { verifyFirebaseIdToken } = require('../middleware/auth');
const { z } = require('zod');

const router = express.Router();

// Validation schemas
const createJobSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  company_name: z.string().min(1).max(200),
  location: z.string().min(1).max(200),
  job_type: z.enum(['full-time', 'part-time', 'contract', 'internship']),
  salary_min: z.number().int().positive().optional(),
  salary_max: z.number().int().positive().optional(),
  experience_level: z.enum(['entry', 'mid', 'senior', 'executive']).optional(),
  industry: z.string().optional(),
  requirements: z.string().optional(),
  benefits: z.string().optional(),
});

const updateJobSchema = createJobSchema.partial();

const jobSearchSchema = z.object({
  query: z.string().optional(),
  location: z.string().optional(),
  job_type: z.enum(['full-time', 'part-time', 'contract', 'internship']).optional(),
  salary_min: z.number().int().positive().optional(),
  salary_max: z.number().int().positive().optional(),
  experience_level: z.enum(['entry', 'mid', 'senior', 'executive']).optional(),
  industry: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

// Middleware to check if user is recruiter
const requireRecruiter = async (req, res, next) => {
  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('user_type')
      .eq('firebase_uid', req.user.firebaseUid)
      .single();

    if (error || !profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    if (profile.user_type !== 'recruiter') {
      return res.status(403).json({ error: 'Access denied. Recruiter role required.' });
    }

    next();
  } catch (error) {
    console.error('Error checking user role:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /jobs - Search and filter jobs
router.get('/', async (req, res) => {
  try {
    const validation = jobSearchSchema.safeParse({
      ...req.query,
      page: req.query.page ? parseInt(req.query.page) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      salary_min: req.query.salary_min ? parseInt(req.query.salary_min) : undefined,
      salary_max: req.query.salary_max ? parseInt(req.query.salary_max) : undefined,
    });

    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid search parameters', 
        details: validation.error.errors 
      });
    }

    const { page, limit, ...filters } = validation.data;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('job_postings')
      .select(`
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
          company_name
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (filters.location) {
      query = query.ilike('location', `%${filters.location}%`);
    }
    if (filters.job_type) {
      query = query.eq('job_type', filters.job_type);
    }
    if (filters.experience_level) {
      query = query.eq('experience_level', filters.experience_level);
    }
    if (filters.industry) {
      query = query.ilike('industry', `%${filters.industry}%`);
    }
    if (filters.salary_min) {
      query = query.gte('salary_min', filters.salary_min);
    }
    if (filters.salary_max) {
      query = query.lte('salary_max', filters.salary_max);
    }

    // Full-text search
    if (filters.query) {
      query = query.or(`title.ilike.%${filters.query}%,description.ilike.%${filters.query}%,company_name.ilike.%${filters.query}%`);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return res.json({
      jobs: data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Error searching jobs:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /jobs/:id - Get job by ID
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('job_postings')
      .select(`
        *,
        user_profiles!job_postings_recruiter_uid_fkey (
          first_name,
          last_name,
          company_name,
          profile_image_url
        )
      `)
      .eq('id', req.params.id)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Job not found' });
      }
      throw error;
    }

    return res.json(data);
  } catch (error) {
    console.error('Error fetching job:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /jobs - Create job (recruiter only)
router.post('/', verifyFirebaseIdToken, requireRecruiter, async (req, res) => {
  try {
    const validation = createJobSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }

    const jobData = {
      recruiter_uid: req.user.firebaseUid,
      ...validation.data,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('job_postings')
      .insert(jobData)
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json(data);
  } catch (error) {
    console.error('Error creating job:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /jobs/:id - Update job (recruiter only)
router.put('/:id', verifyFirebaseIdToken, requireRecruiter, async (req, res) => {
  try {
    const validation = updateJobSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }

    // Check if job belongs to the recruiter
    const { data: existingJob, error: fetchError } = await supabase
      .from('job_postings')
      .select('recruiter_uid')
      .eq('id', req.params.id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Job not found' });
      }
      throw fetchError;
    }

    if (existingJob.recruiter_uid !== req.user.firebaseUid) {
      return res.status(403).json({ error: 'Access denied. You can only update your own jobs.' });
    }

    const updateData = {
      ...validation.data,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('job_postings')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    return res.json(data);
  } catch (error) {
    console.error('Error updating job:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /jobs/:id - Delete job (recruiter only)
router.delete('/:id', verifyFirebaseIdToken, requireRecruiter, async (req, res) => {
  try {
    // Check if job belongs to the recruiter
    const { data: existingJob, error: fetchError } = await supabase
      .from('job_postings')
      .select('recruiter_uid')
      .eq('id', req.params.id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Job not found' });
      }
      throw fetchError;
    }

    if (existingJob.recruiter_uid !== req.user.firebaseUid) {
      return res.status(403).json({ error: 'Access denied. You can only delete your own jobs.' });
    }

    const { error } = await supabase
      .from('job_postings')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting job:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

