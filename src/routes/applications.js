const express = require('express');
const { supabase } = require('../lib/supabase');
const { verifyFirebaseIdToken } = require('../middleware/auth');
const { z } = require('zod');
const { NotificationService } = require('../services/notificationService');

const router = express.Router();

// Validation schemas
const createApplicationSchema = z.object({
  job_id: z.string().uuid(),
  cv_id: z.string().uuid(),
  cover_letter: z.string().optional(),
});

const updateApplicationStatusSchema = z.object({
  status: z.enum(['pending', 'under_review', 'reviewed', 'shortlisted', 'interview_scheduled', 'accepted', 'rejected', 'withdrawn']),
});

// Middleware to check if user is job seeker
const requireJobSeeker = async (req, res, next) => {
  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('user_type')
      .eq('firebase_uid', req.user.firebaseUid)
      .single();

    if (error || !profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    if (profile.user_type !== 'job_seeker') {
      return res.status(403).json({ error: 'Access denied. Job seeker role required.' });
    }

    next();
  } catch (error) {
    console.error('Error checking user role:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

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

// GET /applications/me - Get user's applications (job seeker)
router.get('/me', verifyFirebaseIdToken, requireJobSeeker, async (req, res) => {
  try {
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
      .eq('applicant_uid', req.user.firebaseUid)
      .order('applied_at', { ascending: false });

    if (error) throw error;

    return res.json(data);
  } catch (error) {
    console.error('Error fetching applications:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /applications - Apply to job (job seeker)
router.post('/', verifyFirebaseIdToken, requireJobSeeker, async (req, res) => {
  try {
    const validation = createApplicationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }

    // Check if job exists and is active
    const { data: job, error: jobError } = await supabase
      .from('job_postings')
      .select('id, recruiter_uid, title')
      .eq('id', validation.data.job_id)
      .eq('is_active', true)
      .single();

    if (jobError) {
      if (jobError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Job not found or not active' });
      }
      throw jobError;
    }

    // Check if CV belongs to user
    const { data: cv, error: cvError } = await supabase
      .from('cvs')
      .select('id, user_uid')
      .eq('id', validation.data.cv_id)
      .eq('user_uid', req.user.firebaseUid)
      .single();

    if (cvError) {
      if (cvError.code === 'PGRST116') {
        return res.status(404).json({ error: 'CV not found or does not belong to you' });
      }
      throw cvError;
    }

    // Check if user already applied to this job
    const { data: existingApplication, error: existingError } = await supabase
      .from('applications')
      .select('id')
      .eq('job_id', validation.data.job_id)
      .eq('applicant_uid', req.user.firebaseUid)
      .single();

    if (existingApplication) {
      return res.status(409).json({ error: 'You have already applied to this job' });
    }

    const applicationData = {
      job_id: validation.data.job_id,
      applicant_uid: req.user.firebaseUid,
      cv_id: validation.data.cv_id,
      cover_letter: validation.data.cover_letter,
    };

    const { data, error } = await supabase
      .from('applications')
      .insert(applicationData)
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
        related_job_id: validation.data.job_id,
        related_application_id: data.id,
      });

    // Send FCM push notification to recruiter
    try {
      await NotificationService.sendFCMNotification(job.recruiter_uid, {
        title: 'New Job Application',
        body: `A new application has been submitted for: ${job.title}`,
        data: {
          type: 'new_application',
          job_id: validation.data.job_id,
          application_id: data.id,
          job_title: job.title,
        },
      });
    } catch (fcmError) {
      // Log FCM error but don't fail the application submission
      console.error('Failed to send FCM notification for new application:', fcmError);
    }

    return res.status(201).json(data);
  } catch (error) {
    console.error('Error creating application:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /applications/recruiter - Get applications for recruiter's jobs
router.get('/recruiter', verifyFirebaseIdToken, requireRecruiter, async (req, res) => {
  try {
    const { job_id } = req.query;

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
      .eq('job_postings.recruiter_uid', req.user.firebaseUid)
      .order('applied_at', { ascending: false });

    if (job_id) {
      query = query.eq('job_id', job_id);
    }

    const { data, error } = await query;

    if (error) throw error;

    return res.json(data);
  } catch (error) {
    console.error('Error fetching recruiter applications:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /applications/:id/status - Update application status (recruiter)
router.patch('/:id/status', verifyFirebaseIdToken, requireRecruiter, async (req, res) => {
  try {
    const validation = updateApplicationStatusSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }

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
      .eq('id', req.params.id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Application not found' });
      }
      throw fetchError;
    }

    if (application.job_postings.recruiter_uid !== req.user.firebaseUid) {
      return res.status(403).json({ error: 'Access denied. You can only update applications for your jobs.' });
    }

    const updateData = {
      status: validation.data.status,
      reviewed_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('applications')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Create notification for job seeker
    let notificationTitle, notificationMessage;
    switch (validation.data.status) {
      case 'under_review':
      case 'reviewed':
        notificationTitle = 'Application Under Review';
        notificationMessage = `Your application for ${application.job_postings.title} is now under review.`;
        break;
      case 'shortlisted':
        notificationTitle = 'Application Shortlisted!';
        notificationMessage = `Great news! Your application for ${application.job_postings.title} has been shortlisted.`;
        break;
      case 'interview_scheduled':
        notificationTitle = 'Interview Scheduled';
        notificationMessage = `Congratulations! An interview has been scheduled for ${application.job_postings.title}.`;
        break;
      case 'accepted':
        notificationTitle = 'Application Accepted!';
        notificationMessage = `Congratulations! Your application for ${application.job_postings.title} has been accepted.`;
        break;
      case 'rejected':
        notificationTitle = 'Application Update';
        notificationMessage = `Your application for ${application.job_postings.title} was not selected this time.`;
        break;
      case 'withdrawn':
        notificationTitle = 'Application Withdrawn';
        notificationMessage = `Your application for ${application.job_postings.title} has been withdrawn.`;
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
        related_application_id: application.id,
      });

    // Send FCM push notification to job seeker
    console.log(`🚀 [APPLICATION STATUS UPDATE] Sending FCM notification to job seeker`);
    console.log(`   Applicant UID: ${application.applicant_uid}`);
    console.log(`   Application ID: ${application.id}`);
    console.log(`   Job ID: ${application.job_postings.id}`);
    console.log(`   Job Title: ${application.job_postings.title}`);
    console.log(`   New Status: ${validation.data.status}`);
    
    try {
      const notificationResult = await NotificationService.sendFCMNotification(application.applicant_uid, {
        title: notificationTitle,
        body: notificationMessage,
        data: {
          type: 'application_update',
          job_id: application.job_postings.id,
          application_id: application.id,
          job_title: application.job_postings.title,
          status: validation.data.status,
        },
      });
      
      if (notificationResult.success) {
        console.log(`✅ [APPLICATION STATUS UPDATE] FCM notification sent successfully to job seeker ${application.applicant_uid}`);
        console.log(`   Success count: ${notificationResult.successCount}, Failure count: ${notificationResult.failureCount}`);
      } else {
        console.error(`❌ [APPLICATION STATUS UPDATE] FCM notification failed: ${notificationResult.message}`);
        console.error(`   This might be due to: No active FCM tokens, Firebase not initialized, or token retrieval error`);
      }
    } catch (fcmError) {
      console.error(`❌ [APPLICATION STATUS UPDATE] Exception sending FCM notification to ${application.applicant_uid}:`, fcmError);
      console.error(`   Error stack:`, fcmError.stack);
    }

    return res.json(data);
  } catch (error) {
    console.error('Error updating application status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Test FCM notification endpoint (for debugging)
router.post('/test-fcm/:userUid', verifyFirebaseIdToken, async (req, res) => {
  try {
    const { userUid } = req.params;
    console.log(`🧪 [TEST FCM] Testing FCM notification for user: ${userUid}`);

    // First check if we can access Firebase Admin SDK
    const { admin, isInitialized } = require('../lib/firebase');
    console.log(`🔥 [TEST FCM] Firebase initialized: ${isInitialized}, admin exists: ${!!admin}`);

    if (!isInitialized || !admin) {
      return res.status(500).json({ 
        error: 'Firebase not initialized', 
        firebaseInitialized: isInitialized, 
        adminExists: !!admin,
        message: 'Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables'
      });
    }

    // Try to get FCM tokens
    const fcmTokens = await NotificationService.getActiveFCMTokensForUser(userUid);
    console.log(`📱 [TEST FCM] Retrieved ${fcmTokens.length} tokens for user ${userUid}`);

    if (!fcmTokens || fcmTokens.length === 0) {
      return res.status(400).json({ 
        error: 'No FCM tokens found for user', 
        userUid, 
        tokensFound: 0,
        message: 'User needs to register FCM token first. Check if token was registered with correct user_uid.'
      });
    }

    // Now try to send the notification
    const result = await NotificationService.sendFCMNotification(userUid, {
      title: 'Test Notification',
      body: 'This is a test FCM notification to verify push notifications are working.',
      data: {
        type: 'test',
        test_id: '12345',
      },
    });

    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Test FCM notification sent', 
        tokensFound: fcmTokens.length,
        successCount: result.successCount,
        failureCount: result.failureCount
      });
    } else {
      res.status(500).json({
        error: 'Failed to send test notification',
        message: result.message,
        tokensFound: fcmTokens.length
      });
    }
  } catch (error) {
    console.error('❌ [TEST FCM] Error sending test FCM notification:', error);
    res.status(500).json({
      error: 'Failed to send test notification',
      details: error.message,
      stack: error.stack?.split('\n').slice(0, 5) // First 5 lines of stack trace
    });
  }
});

module.exports = router;

