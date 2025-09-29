const { supabase } = require('../lib/supabase');

class SavedJobsService {
  static async saveJob(userUid, jobId) {
    // Check if job exists and is active
    const { data: job, error: jobError } = await supabase
      .from('job_postings')
      .select('id, title')
      .eq('id', jobId)
      .eq('is_active', true)
      .single();

    if (jobError) {
      if (jobError.code === 'PGRST116') {
        throw new Error('Job not found or not active');
      }
      throw jobError;
    }

    // Check if job is already saved
    const { data: existingSavedJob } = await supabase
      .from('saved_jobs')
      .select('id')
      .eq('user_uid', userUid)
      .eq('job_id', jobId)
      .single();

    if (existingSavedJob) {
      throw new Error('Job is already saved');
    }

    const savedJobData = {
      user_uid: userUid,
      job_id: jobId,
    };

    const { data, error } = await supabase
      .from('saved_jobs')
      .insert(savedJobData)
      .select(`
        *,
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
          is_active,
          created_at,
          user_profiles!job_postings_recruiter_uid_fkey (
            first_name,
            last_name,
            company_name,
            profile_image_url
          )
        )
      `)
      .single();

    if (error) throw error;
    return data;
  }

  static async getSavedJobs(userUid) {
    const { data, error } = await supabase
      .from('saved_jobs')
      .select(`
        *,
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
          is_active,
          created_at,
          user_profiles!job_postings_recruiter_uid_fkey (
            first_name,
            last_name,
            company_name,
            profile_image_url
          )
        )
      `)
      .eq('user_uid', userUid)
      .order('saved_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async removeSavedJob(userUid, jobId) {
    const { error } = await supabase
      .from('saved_jobs')
      .delete()
      .eq('user_uid', userUid)
      .eq('job_id', jobId);

    if (error) throw error;
  }

  static async isJobSaved(userUid, jobId) {
    const { data, error } = await supabase
      .from('saved_jobs')
      .select('id')
      .eq('user_uid', userUid)
      .eq('job_id', jobId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return !!data;
  }

  static async getSavedJobIds(userUid) {
    const { data, error } = await supabase
      .from('saved_jobs')
      .select('job_id')
      .eq('user_uid', userUid);

    if (error) throw error;
    return data?.map(item => item.job_id) || [];
  }
}

module.exports = { SavedJobsService };
