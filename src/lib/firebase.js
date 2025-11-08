const admin = require('firebase-admin');

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (privateKey && privateKey.includes('\\n')) {
	privateKey = privateKey.replace(/\\n/g, '\n');
}

// Only initialize Firebase if we have the required environment variables
let firebaseInitialized = false;
if (projectId && clientEmail && privateKey) {
	try {
		console.log('🔍 Initializing Firebase with:');
		console.log('  Project ID:', projectId);
		console.log('  Client Email:', clientEmail.substring(0, 20) + '...');
		console.log('  Private Key Length:', privateKey.length);

		if (!admin.apps.length) {
			admin.initializeApp({
				credential: admin.credential.cert({
					projectId,
					clientEmail,
					privateKey,
				}),
			});
		}
		firebaseInitialized = true;
		console.log('✅ Firebase Admin initialized successfully');

		// Test token verification
		console.log('🔍 Testing Firebase token verification...');

	} catch (error) {
		console.error('❌ Failed to initialize Firebase Admin:', error.message);
		console.error('❌ Error details:', error);
		console.log('🔶 Server will run without Firebase authentication');
	}
} else {
	console.log('🔶 Firebase environment variables not found. Missing:');
	console.log('  Project ID:', !!projectId);
	console.log('  Client Email:', !!clientEmail);
	console.log('  Private Key:', !!privateKey);
	console.log('🔶 Server will run without Firebase authentication');
}

// Export a flag to check if Firebase is available
module.exports = {
	admin: firebaseInitialized ? admin : null,
	isInitialized: firebaseInitialized
};



