# FCM Notification Diagnostic Guide

## Issue: Job seekers not receiving notifications when recruiters update application status

### Step 1: Check Render Logs

After deploying the updated code, check Render logs when:
1. A job seeker registers their FCM token (on app login/startup)
2. A recruiter updates an application status

### Step 2: Verify FCM Token Registration

**In Render logs, look for:**
```
📱 [FCM TOKEN REGISTRATION] Registering FCM token for user: EPaRl9iXEqhys01ad80KoPNqGN72
✅ [FCM TOKEN REGISTRATION] Token registered/updated successfully
```

**If you see errors:**
- Check if the user is authenticated
- Verify the API endpoint is accessible
- Check database connection

### Step 3: Verify FCM Token Storage in Database

**Query Supabase:**
```sql
SELECT * FROM user_fcm_tokens 
WHERE user_uid = 'EPaRl9iXEqhys01ad80KoPNqGN72' 
AND is_active = true;
```

**Expected result:**
- At least one row with the FCM token
- `user_uid` matches the job seeker's Firebase UID
- `is_active` is `true`

### Step 4: Check Firebase Admin SDK Initialization

**In Render logs, look for (on server startup):**
```
✅ Firebase Admin initialized successfully
```

**If you see:**
```
❌ Failed to initialize Firebase Admin
🔶 Firebase environment variables not found
```

**Then check Render Environment Variables:**
- `FIREBASE_PROJECT_ID` - Should be your Firebase project ID
- `FIREBASE_CLIENT_EMAIL` - Should be your Firebase service account email
- `FIREBASE_PRIVATE_KEY` - Should be your Firebase service account private key (with `\n` as actual newlines)

### Step 5: Verify Notification Sending

**When a recruiter updates application status, look for in Render logs:**
```
🚀 [APPLICATION STATUS UPDATE] Sending FCM notification to job seeker
   Applicant UID: EPaRl9iXEqhys01ad80KoPNqGN72
   Application ID: [application_id]
   Job ID: [job_id]
   New Status: [status]
```

**Then check for:**
```
🔍 [FCM TOKEN LOOKUP] Looking up FCM tokens for user: EPaRl9iXEqhys01ad80KoPNqGN72
📱 [FCM TOKEN LOOKUP] Found X active token(s) for user EPaRl9iXEqhys01ad80KoPNqGN72
```

**If you see:**
```
⚠️  No active FCM tokens found in database for user EPaRl9iXEqhys01ad80KoPNqGN72
```

**This means:**
- Token was never registered
- Token was deactivated
- User UID mismatch between registration and lookup

### Step 6: Test FCM Notification Manually

**Use the test endpoint:**
```
POST https://careerconnectapi2.onrender.com/api/applications/test-fcm/EPaRl9iXEqhys01ad80KoPNqGN72
Authorization: Bearer [your_firebase_id_token]
```

**Expected response:**
```json
{
  "success": true,
  "message": "Test FCM notification sent",
  "tokensFound": 1,
  "successCount": 1,
  "failureCount": 0
}
```

**If you get errors:**
- `Firebase not initialized` - Check environment variables
- `No FCM tokens found` - Token wasn't registered or user UID mismatch
- `Failed to send test notification` - Check Firebase Admin SDK configuration

### Step 7: Common Issues and Solutions

#### Issue: "No active FCM tokens found"
**Solution:**
1. Ensure the job seeker has logged into the app recently
2. Check if FCM token registration endpoint is being called
3. Verify the user_uid in the database matches the Firebase UID
4. Check if tokens were accidentally deactivated

#### Issue: "Firebase not initialized"
**Solution:**
1. Check Render environment variables are set correctly
2. Verify `FIREBASE_PRIVATE_KEY` has actual newlines (not `\n` as text)
3. Restart the Render service after setting environment variables

#### Issue: "FCM notification sent but not received"
**Solution:**
1. Check Android device has internet connection
2. Verify app has notification permissions
3. Check if app is in background (notifications work better when app is backgrounded)
4. Verify FCM token is valid and not expired
5. Check Android logcat for FCM service errors

### Step 8: Verify Application Data

**If you see the name changing from "Khumo" to Firebase UID:**
- This is a separate issue from notifications
- Check the application query in the recruiter's view
- Verify the join with user_profiles table is working
- Check if applicant_uid is being used instead of applicant name

### Step 9: Debug Checklist

- [ ] FCM token is registered in database
- [ ] Firebase Admin SDK is initialized on Render
- [ ] Environment variables are set correctly
- [ ] Application status update is triggering notification code
- [ ] Applicant UID matches between application and token lookup
- [ ] Android app has notification permissions
- [ ] FCM token is valid and not expired
- [ ] Render logs show notification sending attempts

### Step 10: Contact Points

If issues persist after checking all above:
1. Check Render logs for detailed error messages
2. Check Supabase database for token storage
3. Verify Firebase Console for FCM delivery status
4. Check Android Logcat for FCM service errors

