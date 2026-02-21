# 🔧 Quick Fix: Gmail OAuth Redirect URI Error

## Error Message
```
You can't sign in to this app because it doesn't comply with Google's OAuth 2.0 policy.
redirect_uri=https://project-gbeta.onrender.com/api/connections/gmail/callback
```

## ✅ Solution (5 minutes)

### Step 1: Open Google Cloud Console
1. Go to: https://console.cloud.google.com/apis/credentials
2. Make sure you're in the correct project

### Step 2: Find Your OAuth Client
1. Look for the OAuth 2.0 Client ID that starts with: `1056673802661-...`
2. Click the **pencil/edit icon** (✏️) on the right

### Step 3: Add Redirect URI
1. Scroll down to **"Authorized redirect URIs"**
2. Click **"+ ADD URI"** button
3. **Copy and paste this EXACTLY** (no spaces, no trailing slash):
   ```
   https://project-gbeta.onrender.com/api/connections/gmail/callback
   ```
4. Click **"ADD"**

### Step 4: Add JavaScript Origins (if not already there)
1. Scroll to **"Authorized JavaScript origins"**
2. Click **"+ ADD URI"** if not already present
3. Add these two:
   ```
   https://project-gbeta.onrender.com
   https://gbeta-a7ea6.web.app
   ```

### Step 5: Save
1. Scroll to the bottom
2. Click **"SAVE"** button
3. Wait 1-2 minutes for changes to propagate

### Step 6: Test Again
1. Go back to your app
2. Click "Connect Gmail" again
3. It should work now! ✅

## ⚠️ Common Mistakes to Avoid

❌ **DON'T** add:
- `http://project-gbeta.onrender.com/...` (must be `https`)
- `https://project-gbeta.onrender.com/api/connections/gmail/callback/` (no trailing slash)
- `https://project-gbeta.onrender.com` (missing the `/api/connections/gmail/callback` part)

✅ **DO** add exactly:
- `https://project-gbeta.onrender.com/api/connections/gmail/callback`

## 🔍 Still Not Working?

1. **Wait 2-3 minutes** - Google's changes can take a moment to propagate
2. **Clear browser cache** - Try in an incognito/private window
3. **Check Render environment variables** - Make sure these are set:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI=https://project-gbeta.onrender.com/api/connections/gmail/callback`
4. **Check OAuth consent screen** - Make sure your email is added as a test user (if app is in testing mode)

## 📸 Visual Guide

The redirect URI section should look like this:

```
Authorized redirect URIs
┌─────────────────────────────────────────────────────────────┐
│ https://project-gbeta.onrender.com/api/connections/gmail/   │
│ callback                                                     │
└─────────────────────────────────────────────────────────────┘
[+ ADD URI]
```

Make sure there's **exactly one entry** with that exact URL.




