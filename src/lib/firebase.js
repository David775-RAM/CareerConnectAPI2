const admin = require('firebase-admin');

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (privateKey && privateKey.includes('\\n')) {
	privateKey = privateKey.replace(/\\n/g, '\n');
}

if (!admin.apps.length) {
	admin.initializeApp({
		credential: admin.credential.cert({
			projectId,
			clientEmail,
			privateKey,
		}),
	});
}

module.exports = admin;



