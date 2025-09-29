const { supabase } = require('../lib/supabase');

class ApplicationService {
  static async createApplication(applicantUid, applicationData) {
    // Check if job exists and is active
    const { data: job, error: jobError } = await supabase
      .from('job_postings')
      .select('id, recruiter_uid, title')
      .eq('id', applicationData.job_id)
      .eq('is_active', true)
      .single();

    if (jobError) {
      if (jobError.code === 'PGRST116') {
        throw new Error('Job not found or not active');
      }
      throw jobError;
    }

    // Check if CV belongs to user
    const { data: cv, error: cvError } = await supabase
      .from('cvs')
      .select('id, user_uid')
      .eq('id', applicationData.cv_id)
      .eq('user_uid', applicantUid)
      .single();

    if (cvError) {
      if (cvError.code === 'PGRST116') {
        throw new Error('CV not found or does not belong to you');
      }
      throw cvError;
    }

    // Check if user already applied to this job
    const { data: existingApplication } = await supabase
      .from('applications')
      .select('id')
      .eq('job_id', applicationData.job_id)
      .eq('applicant_uid', applicantUid)
      .single();

    if (existingApplication) {
      throw new Error('You have already applied to this job');
    }

    const applicationDataWithApplicant = {
      job_id: applicationData.job_id,
      applicant_uid: applicantUid,
      cv_id: applicationData.cv_id,
      cover_letter: applicationData.cover_letter,
    };

    const { data, error } = await supabase
      .from('applications')
      .insert(applicationDataWithApplicant)
      .select(`
        *,
        job_postings!applications_job_id_fkey (
          title,
          company_name,
          user_profiles!job_postings_recruiter_uid_fkey (
            first_name,
            last_name,
            company_name
          )
        )
      `)
      .single();

    if (error) throw error;

    // Create notification for recruiter
    await supabase
      .from('notifications')
      .insert({
        user_uid: job.recruiter_uid,
        title: 'New Job Application',
        message: `A new application has been submitted for the position: ${job.title}`,
        type: 'new_application',
        related_job_id: applicationData.job_id,
        related_application_id: data.id,
      });

    return data;
  }

  static async getUserApplications(userUid) {
    const { data, error } = await supabase
      .from('applications')
      .select(`
        *,
        job_postings!applications_job_id_fkey (
          id,
          title,
          company_name,
          location,
          job_type,
          salary_min,
          salary_max,
          is_active,
          user_profiles!job_postings_recruiter_uid_fkey (
            first_name,
            last_name,
            company_name
          )
        ),
        cvs!applications_cv_id_fkey (
          id,
          file_name,
          file_url
        )
      `)
      .eq('applicant_uid', userUid)
      .order('applied_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async getRecruiterApplications(recruiterUid, jobId) {
    let query = supabase
      .from('applications')
      .select(`
        *,
        job_postings!applications_job_id_fkey (
          id,
          title,
          company_name,
          location,
          job_type
        ),
        user_profiles!applications_applicant_uid_fkey (
          first_name,
          last_name,
          email,
          phone,
          location,
          profile_image_url
        ),
        cvs!applications_cv_id_fkey (
          id,
          file_name,
          file_url,
          file_size
        )
      `)
      .eq('job_postings.recruiter_uid', recruiterUid)
      .order('applied_at', { ascending: false });

    if (jobId) {
      query = query.eq('job_id', jobId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  static async updateApplicationStatus(applicationId, recruiterUid, statusData) {
    // Check if application exists and belongs to recruiter's job
    const { data: application, error: fetchError } = await supabase
      .from('applications')
      .select(`
        id,
        status,
        applicant_uid,
        job_postings!applications_job_id_fkey (
          id,
          title,
          recruiter_uid
        )
      `)
      .eq('id', applicationId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        throw new Error('Application not found');
      }
      throw fetchError;
    }

    if (application.job_postings.recruiter_uid !== recruiterUid) {
      throw new Error('Access denied. You can only update applications for your jobs.');
    }

    const updateData = {
      status: statusData.status,
      reviewed_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('applications')
      .update(updateData)
      .eq('id', applicationId)
      .select()
      .single();

    if (error) throw error;

    // Create notification for job seeker
    let notificationTitle, notificationMessage;
    switch (statusData.status) {
      case 'reviewed':
        notificationTitle = 'Application Reviewed';
        notificationMessage = `Your application for ${application.job_postings.title} has been reviewed.`;
        break;
      case 'accepted':
        notificationTitle = 'Application Accepted!';
        notificationMessage = `Congratulations! Your application for ${application.job_postings.title} has been accepted.`;
        break;
      case 'rejected':
        notificationTitle = 'Application Update';
        notificationMessage = `Your application for ${application.job_postings.title} was not selected this time.`;
        break;
      default:
        notificationTitle = 'Application Update';
        notificationMessage = `Your application for ${application.job_postings.title} has been updated.`;
    }

    await supabase
      .from('notifications')
      .insert({
        user_uid: application.applicant_uid,
        title: notificationTitle,
        message: notificationMessage,
        type: 'application_update',
        related_job_id: application.job_postings.id,
        related_application_id: applicationId,
      });

    return data;
  }
}

module.exports = { ApplicationService };
