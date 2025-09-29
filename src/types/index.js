// User Types
/**
 * @typedef {Object} User
 * @property {string} firebaseUid
 * @property {string} email
 * @property {string} [name]
 * @property {string} [picture]
 * @property {any} claims
 */

/**
 * @typedef {Object} UserProfile
 * @property {string} firebase_uid
 * @property {'job_seeker'|'recruiter'} user_type
 * @property {string} first_name
 * @property {string} last_name
 * @property {string} email
 * @property {string} [phone]
 * @property {string} [location]
 * @property {string} [company_name]
 * @property {string} [bio]
 * @property {string} [profile_image_url]
 * @property {string} created_at
 * @property {string} updated_at
 */

// Job Types
/**
 * @typedef {Object} JobPosting
 * @property {string} id
 * @property {string} recruiter_uid
 * @property {string} title
 * @property {string} description
 * @property {string} company_name
 * @property {string} location
 * @property {'full-time'|'part-time'|'contract'|'internship'} job_type
 * @property {number} [salary_min]
 * @property {number} [salary_max]
 * @property {'entry'|'mid'|'senior'|'executive'} [experience_level]
 * @property {string} [industry]
 * @property {string} [requirements]
 * @property {string} [benefits]
 * @property {boolean} is_active
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} JobSearchFilters
 * @property {string} [query]
 * @property {string} [location]
 * @property {'full-time'|'part-time'|'contract'|'internship'} [job_type]
 * @property {number} [salary_min]
 * @property {number} [salary_max]
 * @property {'entry'|'mid'|'senior'|'executive'} [experience_level]
 * @property {string} [industry]
 * @property {number} [page]
 * @property {number} [limit]
 */

// CV Types
/**
 * @typedef {Object} CV
 * @property {string} id
 * @property {string} user_uid
 * @property {string} file_name
 * @property {string} file_url
 * @property {number} [file_size]
 * @property {boolean} is_primary
 * @property {string} created_at
 * @property {string} updated_at
 */

// Application Types
/**
 * @typedef {Object} JobApplication
 * @property {string} id
 * @property {string} job_id
 * @property {string} applicant_uid
 * @property {string} cv_id
 * @property {string} [cover_letter]
 * @property {'pending'|'reviewed'|'accepted'|'rejected'} status
 * @property {string} applied_at
 * @property {string} [reviewed_at]
 */

/**
 * @typedef {Object} CreateApplicationRequest
 * @property {string} job_id
 * @property {string} cv_id
 * @property {string} [cover_letter]
 */

/**
 * @typedef {Object} UpdateApplicationStatusRequest
 * @property {'pending'|'reviewed'|'accepted'|'rejected'} status
 */

// Saved Jobs Types
/**
 * @typedef {Object} SavedJob
 * @property {string} id
 * @property {string} user_uid
 * @property {string} job_id
 * @property {string} saved_at
 */

// Notification Types
/**
 * @typedef {Object} Notification
 * @property {string} id
 * @property {string} user_uid
 * @property {string} title
 * @property {string} message
 * @property {'new_application'|'application_update'|'job_alert'|'general'} type
 * @property {boolean} is_read
 * @property {string} [related_job_id]
 * @property {string} [related_application_id]
 * @property {string} created_at
 */

/**
 * @typedef {Object} FCMToken
 * @property {string} id
 * @property {string} user_uid
 * @property {string} fcm_token
 * @property {string} [device_id]
 * @property {'android'|'ios'|'web'} [device_type]
 * @property {boolean} is_active
 * @property {string} created_at
 * @property {string} updated_at
 */

// API Response Types
/**
 * @typedef {Object} ApiResponse
 * @property {any} [data]
 * @property {string} [error]
 * @property {string} [message]
 */

/**
 * @typedef {Object} PaginatedResponse
 * @property {any[]} data
 * @property {Object} pagination
 * @property {number} pagination.page
 * @property {number} pagination.limit
 * @property {number} [pagination.total]
 * @property {number} [pagination.totalPages]
 */

// Request Types
/**
 * @typedef {Object} CreateProfileRequest
 * @property {'job_seeker'|'recruiter'} user_type
 * @property {string} first_name
 * @property {string} last_name
 * @property {string} email
 * @property {string} [phone]
 * @property {string} [location]
 * @property {string} [company_name]
 * @property {string} [bio]
 * @property {string} [profile_image_url]
 */

/**
 * @typedef {Object} CreateJobRequest
 * @property {string} title
 * @property {string} description
 * @property {string} company_name
 * @property {string} location
 * @property {'full-time'|'part-time'|'contract'|'internship'} job_type
 * @property {number} [salary_min]
 * @property {number} [salary_max]
 * @property {'entry'|'mid'|'senior'|'executive'} [experience_level]
 * @property {string} [industry]
 * @property {string} [requirements]
 * @property {string} [benefits]
 */

/**
 * @typedef {Object} CreateCVRequest
 * @property {string} file_name
 * @property {string} file_url
 * @property {number} [file_size]
 * @property {boolean} [is_primary]
 */

/**
 * @typedef {Object} SaveJobRequest
 * @property {string} job_id
 */

/**
 * @typedef {Object} RegisterFCMTokenRequest
 * @property {string} fcm_token
 * @property {string} [device_id]
 * @property {'android'|'ios'|'web'} [device_type]
 */

module.exports = {};
