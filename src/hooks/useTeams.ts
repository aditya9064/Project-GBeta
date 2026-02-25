import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

// Team type for the app
export interface Team {
  id: string;
  name: string;
  handle: string;
  description: string;
  memberCount: number;
  avatar: string;
  color: string;
  createdAt: Date;
  createdBy: string;
  createdByName: string;
  workspaceId: string;
}

// Firestore team type
interface FirestoreTeam {
  id: string;
  name: string;
  handle: string;
  description: string | null;
  memberCount: number;
  avatar: string;
  color: string;
  createdAt: Timestamp;
  createdBy: string;
  createdByName: string;
  workspaceId: string;
}

// Convert Firestore team to Team
const toTeam = (firestoreTeam: FirestoreTeam): Team => ({
  id: firestoreTeam.id,
  name: firestoreTeam.name,
  handle: firestoreTeam.handle,
  description: firestoreTeam.description || '',
  memberCount: firestoreTeam.memberCount,
  avatar: firestoreTeam.avatar,
  color: firestoreTeam.color,
  createdAt: firestoreTeam.createdAt.toDate(),
  createdBy: firestoreTeam.createdBy,
  createdByName: firestoreTeam.createdByName,
  workspaceId: firestoreTeam.workspaceId,
});

// Get avatar color based on name
const getAvatarColor = (name: string) => {
  const colors = [
    '#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6', '#F97316'
  ];
  return colors[name.length % colors.length];
};

export function useTeams() {
  const { user, userProfile } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Get the user's default workspace ID
  const workspaceId = user ? `${user.uid}-default` : null;

  // Subscribe to teams
  useEffect(() => {
    if (!workspaceId) {
      setTeams([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const teamsRef = collection(db, 'teams');
    const q = query(
      teamsRef,
      where('workspaceId', '==', workspaceId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const teamsList: Team[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as Omit<FirestoreTeam, 'id'>;
          teamsList.push(toTeam({ id: doc.id, ...data }));
        });
        setTeams(teamsList);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching teams:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [workspaceId]);

  // Add a new team
  const addTeam = useCallback(
    async (teamData: { name: string; handle?: string; description?: string }) => {
      if (!user || !workspaceId || !userProfile) {
        return { error: new Error('Not authenticated') };
      }

      try {
        const teamsRef = collection(db, 'teams');
        const handle = teamData.handle || `@${teamData.name.toLowerCase().replace(/\s+/g, '-')}`;
        
        const firestoreData = {
          workspaceId,
          name: teamData.name,
          handle,
          description: teamData.description || null,
          memberCount: 1, // Creator is the first member
          avatar: teamData.name.charAt(0).toUpperCase(),
          color: getAvatarColor(teamData.name),
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          createdByName: userProfile.displayName || user.displayName || 'Unknown',
        };
        
        const docRef = await addDoc(teamsRef, firestoreData);
        return { id: docRef.id, error: null };
      } catch (err) {
        return { id: null, error: err as Error };
      }
    },
    [user, workspaceId, userProfile]
  );

  // Update a team
  const updateTeam = useCallback(
    async (teamId: string, updates: Partial<Pick<Team, 'name' | 'handle' | 'description'>>) => {
      if (!user) {
        return { error: new Error('Not authenticated') };
      }

      try {
        const teamRef = doc(db, 'teams', teamId);
        const updateData: { name?: string; avatar?: string; handle?: string; description?: string | null } = {};
        
        if (updates.name !== undefined) {
          updateData.name = updates.name;
          updateData.avatar = updates.name.charAt(0).toUpperCase();
        }
        if (updates.handle !== undefined) updateData.handle = updates.handle;
        if (updates.description !== undefined) updateData.description = updates.description || null;

        await updateDoc(teamRef, updateData);
        return { error: null };
      } catch (err) {
        return { error: err as Error };
      }
    },
    [user]
  );

  // Delete a team
  const deleteTeam = useCallback(async (teamId: string) => {
    try {
      const teamRef = doc(db, 'teams', teamId);
      await deleteDoc(teamRef);
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  }, []);

  return {
    teams,
    loading,
    error,
    addTeam,
    updateTeam,
    deleteTeam,
  };
}

