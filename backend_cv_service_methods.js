// Add these methods to your cvService.js file

  /**
   * Get CV by ID with access control for recruiters
   */
  static async getCVByIdWithAccess(cvId, userUid, userType) {
    const { data: cv, error } = await supabase
      .from('cvs')
      .select('*')
      .eq('id', cvId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // CV not found
      }
      throw error;
    }

    // Check access permissions
    if (cv.user_uid === userUid) {
      return cv; // User owns the CV
    }

    if (userType === 'recruiter') {
      // Check if this CV is part of an application for the recruiter's job
      const { data: application, error: appError } = await supabase
        .from('applications')
        .select(`
          id,
          job_postings!applications_job_id_fkey (
            recruiter_uid
          )
        `)
        .eq('cv_id', cvId)
        .eq('job_postings.recruiter_uid', userUid)
        .single();

      if (appError || !application) {
        throw new Error('Access denied. You can only view CVs from applications for your jobs.');
      }

      return cv;
    }

    throw new Error('Access denied');
  }

  /**
   * Generate CV download URL
   */
  static async generateCVDownloadUrl(cvId, userUid, userType) {
    const cv = await this.getCVByIdWithAccess(cvId, userUid, userType);
    
    // Generate a temporary download URL (expires in 1 hour)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    
    return {
      download_url: cv.file_url,
      expires_at: expiresAt,
      file_name: cv.file_name,
      file_size: cv.file_size || 0
    };
  }

  /**
   * Get CV file stream for proxying
   */
  static async getCVFileStream(cvId, userUid, userType) {
    const cv = await this.getCVByIdWithAccess(cvId, userUid, userType);
    return {
      fileUrl: cv.file_url,
      fileName: cv.file_name,
      fileSize: cv.file_size || 0
    };
  }
