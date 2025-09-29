// Export all services
const { UserService } = require('./userService');
const { JobService } = require('./jobService');
const { CVService } = require('./cvService');
const { ApplicationService } = require('./applicationService');
const { NotificationService } = require('./notificationService');
const { SavedJobsService } = require('./savedJobsService');

module.exports = {
  UserService,
  JobService,
  CVService,
  ApplicationService,
  NotificationService,
  SavedJobsService
};
