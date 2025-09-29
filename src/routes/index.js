const express = require('express');
const profiles = require('./profiles');
const jobs = require('./jobs');
const cvs = require('./cvs');
const applications = require('./applications');
const savedJobs = require('./saved-jobs');
const notifications = require('./notifications');

const router = express.Router();

// API routes
router.use('/profiles', profiles);
router.use('/jobs', jobs);
router.use('/cvs', cvs);
router.use('/applications', applications);
router.use('/saved', savedJobs);
router.use('/notifications', notifications);

// Health check
router.get('/health', (req, res) => {
  return res.json({ ok: true, uptime: process.uptime() });
});

module.exports = router;



