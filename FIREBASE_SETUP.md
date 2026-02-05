# Firebase Setup Guide

Your Firebase configuration is already set up in the app. Here's how to complete the setup:

## 1. Enable Authentication

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: **gbeta-a7ea6**
3. Go to **Authentication** → **Sign-in method**
4. Enable the following providers:
   - **Email/Password** - Toggle ON
   - **Google** - Toggle ON (click and add your email as support email)

## 2. Set Up Firestore Database

1. Go to **Firestore Database** in the Firebase Console
2. Click **Create database**
3. Choose **Start in production mode**
4. Select a location close to your users (e.g., `us-central1`)
5. Click **Enable**

## 3. Deploy Security Rules

After creating the database, go to the **Rules** tab and paste the contents of `firestore.rules` from this project.

Or deploy via Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
firebase init firestore
firebase deploy --only firestore:rules
```

## 4. Create Required Indexes

Firestore will automatically prompt you to create indexes when queries fail. You can also create them manually:

1. Go to **Firestore Database** → **Indexes**
2. Create a composite index for events:
   - Collection: `events`
   - Fields: `workspaceId` (Ascending), `startTime` (Ascending)

## Database Structure

```
/users/{userId}
  - email: string
  - displayName: string
  - photoURL: string | null
  - createdAt: timestamp
  - updatedAt: timestamp

/workspaces/{workspaceId}
  - name: string
  - ownerId: string (userId)
  - createdAt: timestamp
  - updatedAt: timestamp

/workspaceMembers/{workspaceId-userId}
  - workspaceId: string
  - userId: string
  - role: 'owner' | 'admin' | 'member'
  - joinedAt: timestamp

/events/{eventId}
  - workspaceId: string
  - title: string
  - description: string | null
  - startTime: timestamp
  - endTime: timestamp
  - eventType: string
  - status: string
  - location: object | null
  - color: string | null
  - createdBy: string (userId)
  - createdAt: timestamp
  - updatedAt: timestamp

/eventParticipants/{participantId}
  - eventId: string
  - userId: string | null
  - email: string
  - name: string
  - rsvpStatus: 'pending' | 'accepted' | 'declined' | 'tentative'
  - createdAt: timestamp

/workspaceInvitations/{invitationId}
  - workspaceId: string
  - email: string
  - role: 'admin' | 'member'
  - invitedBy: string (userId)
  - status: 'pending' | 'accepted' | 'declined'
  - createdAt: timestamp
  - expiresAt: timestamp
```

## Inviting Team Members

Once set up, you can invite team members by:

1. Having them sign up at your app URL
2. Sharing workspace invites (feature to be implemented)
3. Using Google Sign-In for quick onboarding

## Testing Locally

Run the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Troubleshooting

### "Missing or insufficient permissions" error
- Make sure you've deployed the Firestore rules
- Check that the user is authenticated
- Verify the workspace membership exists

### Google Sign-In not working
- Add `localhost` to authorized domains in Firebase Console
- Go to **Authentication** → **Settings** → **Authorized domains**
- Add your production domain when deploying

### Events not syncing
- Check browser console for errors
- Verify Firestore indexes are created
- Ensure workspace membership document exists


