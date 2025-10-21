require('dotenv').config();
const express = require('express');
const cors = require('cors');

const routes = require('./routes');

const app = express();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',        // Local development
    'http://localhost:8080',        // Android emulator
    'http://10.0.2.2:3000',        // Android emulator localhost
    'https://careerconnectapi-production.up.railway.app', // Your hosted API
    // Add your Android app's domain when you have it
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '2mb' }));

// Routes
app.use('/api', routes);

// Health root fallback
app.get('/', (req, res) => {
	return res.json({ status: 'ok', service: 'CareerConnect API' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
	console.log(`CareerConnect API listening on port ${port}`);
	console.log('Version 1.0.2 - Fixed axios dependency issue');
});



