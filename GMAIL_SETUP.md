# 📧 Gmail Integration Setup Guide

This guide will help you set up Gmail OAuth integration for the Communications Agent.

## Prerequisites

- A Google Cloud Project
- OAuth 2.0 credentials (Client ID and Client Secret)
- Access to Google Cloud Console

## Step 1: Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. If prompted, configure the OAuth consent screen:
   - Choose **External** (unless you have a Google Workspace)
   - Fill in the required fields (App name, User support email, Developer contact)
   - Add scopes:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.modify`
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`
   - Add test users (your email) if in testing mode
   - Save and continue

6. Create the OAuth client:
   - Application type: **Web application**
   - Name: `Project GBeta - Gmail Integration`
   - **Authorized JavaScript origins:**
     - `http://localhost:5173` (for local development)
     - `https://gbeta-a7ea6.web.app` (for Firebase hosting)
     - `https://gbeta-a7ea6.firebaseapp.com` (Firebase alternate domain)
   - **Authorized redirect URIs:**
     - `http://localhost:3001/api/connections/gmail/callback` (for local development)
     - `https://project-gbeta.onrender.com/api/connections/gmail/callback` (for production backend)
   - Click **Create**

7. Copy your **Client ID** and **Client Secret**

## Step 2: Configure Environment Variables

### For Local Development (`.env` in project root):

```env
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:3001/api/connections/gmail/callback
```

### For Production (Render Dashboard):

1. Go to your Render service dashboard
2. Navigate to **Environment** tab
3. Add these environment variables:
   - `GOOGLE_CLIENT_ID` = your Client ID
   - `GOOGLE_CLIENT_SECRET` = your Client Secret
   - `GOOGLE_REDIRECT_URI` = `https://project-gbeta.onrender.com/api/connections/gmail/callback`
   - `FRONTEND_URL` = `https://gbeta-a7ea6.web.app`

## Step 3: Enable Gmail API

1. In Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for "Gmail API"
3. Click **Enable**

## Step 4: Test the Integration

1. Start your backend server (if running locally):
   ```bash
   cd server
   npm start
   ```

2. Start your frontend (if running locally):
   ```bash
   npm run dev
   ```

3. Navigate to the Communications Agent page
4. Click **Connect Gmail** or **Connect Your Accounts**
5. You should be redirected to Google's consent screen
6. Authorize the application
7. You should be redirected back to the app with Gmail connected

## Troubleshooting

### Error: "redirect_uri_mismatch"

**Solution:** Make sure the redirect URI in your Google Cloud Console exactly matches:
- For production: `https://project-gbeta.onrender.com/api/connections/gmail/callback`
- For local: `http://localhost:3001/api/connections/gmail/callback`

**Important:** 
- No trailing slashes
- Must match exactly (including `http` vs `https`)
- Must be added in **Authorized redirect URIs** (not just JavaScript origins)

### Error: "access_denied"

**Solution:** 
- Make sure you've added your email as a test user in the OAuth consent screen (if app is in testing mode)
- Check that all required scopes are added to the consent screen

### Error: "invalid_client"

**Solution:**
- Verify your Client ID and Client Secret are correct
- Make sure environment variables are set correctly on Render
- Restart your Render service after adding environment variables

### Gmail not appearing as connected after authorization

**Solution:**
- Check browser console for errors
- Verify the backend is running and accessible
- Check Render logs for any backend errors
- Make sure `FRONTEND_URL` environment variable is set correctly on Render

## Security Notes

- Never commit your Client Secret to version control
- Use environment variables for all sensitive credentials
- Keep your OAuth consent screen up to date
- Regularly review and rotate credentials if needed

## Next Steps

Once Gmail is connected:
- Messages will automatically sync from your Gmail inbox
- The AI agent can draft responses to your emails
- You can send replies directly from the Communications Agent interface




