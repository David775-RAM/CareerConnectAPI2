const { supabase } = require('../lib/supabase');

class CVService {
  static async createCV(userUid, cvData) {
    // If setting as primary, unset other primary CVs
    if (cvData.is_primary) {
      await supabase
        .from('cvs')
        .update({ is_primary: false })
        .eq('user_uid', userUid);
    }

    const cvDataWithUser = {
      user_uid: userUid,
      ...cvData,
      is_primary: cvData.is_primary || false,
    };

    const { data, error } = await supabase
      .from('cvs')
      .insert(cvDataWithUser)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getCVs(userUid) {
    const { data, error } = await supabase
      .from('cvs')
      .select('*')
      .eq('user_uid', userUid)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async getCVById(cvId, userUid) {
    const { data, error } = await supabase
      .from('cvs')
      .select('*')
      .eq('id', cvId)
      .eq('user_uid', userUid)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // CV not found
      }
      throw error;
    }

    return data;
  }

  static async updateCV(cvId, userUid, updateData) {
    // Check if CV belongs to user
    const existingCV = await this.getCVById(cvId, userUid);
    if (!existingCV) {
      throw new Error('CV not found or does not belong to you');
    }

    // If setting as primary, unset other primary CVs
    if (updateData.is_primary) {
      await supabase
        .from('cvs')
        .update({ is_primary: false })
        .eq('user_uid', userUid)
        .neq('id', cvId);
    }

    const { data, error } = await supabase
      .from('cvs')
      .update(updateData)
      .eq('id', cvId)
      .eq('user_uid', userUid)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteCV(cvId, userUid) {
    // Check if CV belongs to user
    const existingCV = await this.getCVById(cvId, userUid);
    if (!existingCV) {
      throw new Error('CV not found or does not belong to you');
    }

    const { error } = await supabase
      .from('cvs')
      .delete()
      .eq('id', cvId)
      .eq('user_uid', userUid);

    if (error) throw error;
  }

  static async getPrimaryCV(userUid) {
    const { data, error } = await supabase
      .from('cvs')
      .select('*')
      .eq('user_uid', userUid)
      .eq('is_primary', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No primary CV found
      }
      throw error;
    }

    return data;
  }

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
}

module.exports = { CVService };
