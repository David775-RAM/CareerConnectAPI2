require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',        // Local development
    'http://localhost:8080',        // Android emulator
    'http://10.0.2.2:3000',        // Android emulator localhost
    'https://careerconnectapi2.onrender.com',
    //'https://careerconnectapi-production.up.railway.app', // Your hosted API
    // Add your Android app's domain when you have it
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '2mb' }));

// Health root fallback
app.get('/', (req, res) => {
	return res.json({
		status: 'ok',
		service: 'CareerConnect API',
		version: '1.0.3',
		firebase: process.env.FIREBASE_PROJECT_ID ? 'Configured ✅' : 'Not configured',
		supabase: process.env.SUPABASE_URL ? 'Configured ✅' : 'Not configured',
		message: 'CareerConnect API is running successfully'
	});
});

// Mock FCM token registration endpoint for testing
app.post('/api/notifications/fcm/tokens', (req, res) => {
	console.log('📱 FCM Token Registration Request:', {
		user: req.headers.authorization ? 'Present' : 'Missing',
		token: req.body.fcm_token ? 'Present' : 'Missing',
		device: req.body.device_id,
		type: req.body.device_type
	});

	// Always return success for testing
	return res.status(200).json({ ok: true });
});

// Mock applications endpoint
app.post('/api/applications', (req, res) => {
	console.log('📝 Application Submission Request:', req.body);
	return res.status(201).json({
		id: 'test-app-id',
		job_id: req.body.job_id,
		applicant_uid: 'test-user-id',
		status: 'pending',
		applied_at: new Date().toISOString()
	});
});

// Mock application status update endpoint
app.patch('/api/applications/:id/status', (req, res) => {
	console.log('📋 Application Status Update Request:', {
		id: req.params.id,
		status: req.body.status
	});

	// Simulate sending FCM notification
	console.log('📲 Would send FCM notification to job seeker about status:', req.body.status);

	return res.status(200).json({
		id: req.params.id,
		status: req.body.status,
		updated_at: new Date().toISOString()
	});
});

// Start server
const port = process.env.PORT || 3000;
try {
	app.listen(port, () => {
		console.log(`🚀 CareerConnect API listening on port ${port}`);
		console.log('🔶 Running in MINIMAL TEST MODE');
		console.log('🔶 Firebase & Supabase not configured');
		console.log('🔶 Use for testing FCM token registration only');
		console.log('🔶 Set environment variables for full functionality');
	});
} catch (error) {
	console.error('❌ Failed to start server:', error.message);
	process.exit(1);
}



