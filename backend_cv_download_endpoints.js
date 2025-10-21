// Add these endpoints to your cvs.js file after the existing routes

// GET /cvs/:id - Get CV by ID (for recruiters to view CVs from applications)
router.get('/:id', verifyFirebaseIdToken, async (req, res) => {
  try {
    const cvId = req.params.id;
    
    // Get CV details
    const { data: cv, error } = await supabase
      .from('cvs')
      .select('*')
      .eq('id', cvId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'CV not found' });
      }
      throw error;
    }

    // Check if user has access to this CV
    // Either the CV belongs to the user OR the user is a recruiter viewing an application
    const userUid = req.user.firebaseUid;
    
    if (cv.user_uid === userUid) {
      // User owns the CV
      return res.json(cv);
    }
    
    // Check if user is a recruiter and has access through applications
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_type')
      .eq('firebase_uid', userUid)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    if (profile.user_type === 'recruiter') {
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
        return res.status(403).json({ error: 'Access denied. You can only view CVs from applications for your jobs.' });
      }

      return res.json(cv);
    }

    return res.status(403).json({ error: 'Access denied' });
  } catch (error) {
    console.error('Error fetching CV:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /cvs/:id/download - Get CV download URL
router.post('/:id/download', verifyFirebaseIdToken, async (req, res) => {
  try {
    const cvId = req.params.id;
    const { download_type = 'original' } = req.body;
    
    // Get CV details with same access control as above
    const { data: cv, error } = await supabase
      .from('cvs')
      .select('*')
      .eq('id', cvId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'CV not found' });
      }
      throw error;
    }

    // Check access permissions (same logic as above)
    const userUid = req.user.firebaseUid;
    let hasAccess = false;

    if (cv.user_uid === userUid) {
      hasAccess = true;
    } else {
      // Check if user is a recruiter with access through applications
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('user_type')
        .eq('firebase_uid', userUid)
        .single();

      if (profile?.user_type === 'recruiter') {
        const { data: application } = await supabase
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

        if (application) {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Generate a temporary download URL (expires in 1 hour)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    
    // For now, return the Cloudinary URL directly
    // In a production environment, you might want to generate signed URLs
    const downloadUrl = cv.file_url;

    const response = {
      download_url: downloadUrl,
      expires_at: expiresAt,
      file_name: cv.file_name,
      file_size: cv.file_size || 0
    };

    return res.json(response);
  } catch (error) {
    console.error('Error generating CV download URL:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /cvs/:id/file - Download CV file directly (proxy)
router.get('/:id/file', verifyFirebaseIdToken, async (req, res) => {
  try {
    const cvId = req.params.id;
    const { type = 'original' } = req.query;
    
    // Get CV details with same access control
    const { data: cv, error } = await supabase
      .from('cvs')
      .select('*')
      .eq('id', cvId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'CV not found' });
      }
      throw error;
    }

    // Check access permissions (same logic as above)
    const userUid = req.user.firebaseUid;
    let hasAccess = false;

    if (cv.user_uid === userUid) {
      hasAccess = true;
    } else {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('user_type')
        .eq('firebase_uid', userUid)
        .single();

      if (profile?.user_type === 'recruiter') {
        const { data: application } = await supabase
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

        if (application) {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Proxy the file from Cloudinary
    const axios = require('axios');
    
    try {
      const fileResponse = await axios.get(cv.file_url, {
        responseType: 'stream',
        timeout: 30000 // 30 second timeout
      });

      // Set appropriate headers
      res.setHeader('Content-Type', fileResponse.headers['content-type'] || 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${cv.file_name}"`);
      res.setHeader('Content-Length', fileResponse.headers['content-length'] || '');
      
      // Pipe the file stream to response
      fileResponse.data.pipe(res);
      
    } catch (proxyError) {
      console.error('Error proxying CV file:', proxyError);
      return res.status(502).json({ error: 'Failed to retrieve CV file' });
    }
    
  } catch (error) {
    console.error('Error downloading CV file:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
