const admin = require('../lib/firebase');

async function verifyFirebaseIdToken(req, res, next) {
	try {
		const authHeader = req.headers.authorization || '';
		const token = authHeader.startsWith('Bearer ')
			? authHeader.substring('Bearer '.length)
			: null;
		if (!token) {
			return res.status(401).json({ error: 'Missing Authorization Bearer token' });
		}
		const decoded = await admin.auth().verifyIdToken(token);
		req.user = {
			firebaseUid: decoded.uid,
			email: decoded.email,
			name: decoded.name,
			picture: decoded.picture,
			claims: decoded,
		};
		return next();
	} catch (err) {
		return res.status(401).json({ error: 'Invalid Firebase token' });
	}
}

module.exports = { verifyFirebaseIdToken };



