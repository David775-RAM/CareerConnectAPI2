const { supabase } = require('../lib/supabase');

class JobService {
  static async createJob(recruiterUid, jobData) {
    const jobDataWithRecruiter = {
      recruiter_uid: recruiterUid,
      ...jobData,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('job_postings')
      .insert(jobDataWithRecruiter)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getJobs(filters = {}) {
    const {
      query,
      location,
      job_type,
      salary_min,
      salary_max,
      experience_level,
      industry,
      page = 1,
      limit = 20
    } = filters;

    let queryBuilder = supabase
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
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    // Apply filters
    if (query) {
      queryBuilder = queryBuilder.or(`title.ilike.%${query}%,description.ilike.%${query}%,company_name.ilike.%${query}%`);
    }
    if (location) {
      queryBuilder = queryBuilder.ilike('location', `%${location}%`);
    }
    if (job_type) {
      queryBuilder = queryBuilder.eq('job_type', job_type);
    }
    if (salary_min) {
      queryBuilder = queryBuilder.gte('salary_max', salary_min);
    }
    if (salary_max) {
      queryBuilder = queryBuilder.lte('salary_min', salary_max);
    }
    if (experience_level) {
      queryBuilder = queryBuilder.eq('experience_level', experience_level);
    }
    if (industry) {
      queryBuilder = queryBuilder.ilike('industry', `%${industry}%`);
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    queryBuilder = queryBuilder.range(from, to);

    const { data, error, count } = await queryBuilder;

    if (error) throw error;

    return {
      jobs: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    };
  }

  static async getJobById(jobId) {
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
      .eq('id', jobId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Job not found
      }
      throw error;
    }

    return data;
  }

  static async updateJob(jobId, recruiterUid, updateData) {
    // First check if job belongs to recruiter
    const existingJob = await this.getJobById(jobId);
    if (!existingJob) {
      throw new Error('Job not found');
    }
    if (existingJob.recruiter_uid !== recruiterUid) {
      throw new Error('Access denied. You can only update your own jobs.');
    }

    const updateDataWithTimestamp = {
      ...updateData,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('job_postings')
      .update(updateDataWithTimestamp)
      .eq('id', jobId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteJob(jobId, recruiterUid) {
    // First check if job belongs to recruiter
    const existingJob = await this.getJobById(jobId);
    if (!existingJob) {
      throw new Error('Job not found');
    }
    if (existingJob.recruiter_uid !== recruiterUid) {
      throw new Error('Access denied. You can only delete your own jobs.');
    }

    const { error } = await supabase
      .from('job_postings')
      .delete()
      .eq('id', jobId);

    if (error) throw error;
  }

  static async getJobsByRecruiter(recruiterUid) {
    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('recruiter_uid', recruiterUid)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }
}

module.exports = { JobService };
