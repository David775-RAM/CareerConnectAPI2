const { admin, isInitialized } = require('../lib/firebase');

async function verifyFirebaseIdToken(req, res, next) {
	try {
		// Check if Firebase is initialized
		if (!isInitialized || !admin) {
			console.error('❌ Firebase not initialized - cannot verify tokens');
			return res.status(500).json({ error: 'Authentication service unavailable' });
		}

		const authHeader = req.headers.authorization || '';
		const token = authHeader.startsWith('Bearer ')
			? authHeader.substring('Bearer '.length)
			: null;

		if (!token) {
			console.log('🔍 Missing Authorization Bearer token');
			return res.status(401).json({ error: 'Missing Authorization Bearer token' });
		}

		console.log('🔍 Verifying Firebase token...');
		const decoded = await admin.auth().verifyIdToken(token);

		console.log('✅ Token verified for user:', decoded.email);
		req.user = {
			firebaseUid: decoded.uid,
			email: decoded.email,
			name: decoded.name,
			picture: decoded.picture,
			claims: decoded,
		};
		return next();
	} catch (err) {
		console.error('❌ Firebase token verification failed:', err.message);
		console.error('❌ Error details:', err);
		return res.status(401).json({ error: 'Invalid Firebase token' });
	}
}

module.exports = { verifyFirebaseIdToken };



