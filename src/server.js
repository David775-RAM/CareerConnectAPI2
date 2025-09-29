require('dotenv').config();
const express = require('express');
const cors = require('cors');

const routes = require('./routes');

const app = express();

// Middleware
app.use(cors());
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
});



