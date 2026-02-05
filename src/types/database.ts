import { Timestamp } from 'firebase/firestore';

// User profile stored in Firestore
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Workspace for team collaboration
export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Workspace member
export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Timestamp;
}

// Calendar event stored in Firestore
export interface FirestoreEvent {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  startTime: Timestamp;
  endTime: Timestamp;
  eventType: 'meeting' | 'call' | 'focus' | 'reminder' | 'task';
  status: 'scheduled' | 'completed' | 'canceled';
  location: {
    type: 'virtual' | 'physical';
    address?: string;
    meetingLink?: string;
  } | null;
  color: string | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Event participant
export interface EventParticipant {
  id: string;
  eventId: string;
  userId: string | null;
  email: string;
  name: string;
  rsvpStatus: 'pending' | 'accepted' | 'declined' | 'tentative';
  createdAt: Timestamp;
}

// Workspace invitation
export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: 'admin' | 'member';
  invitedBy: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

