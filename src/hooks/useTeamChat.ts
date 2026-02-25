import { useState, useEffect, useCallback, useRef } from 'react';
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
  limit,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

// Message type for the app
export interface ChatMessage {
  id: string;
  teamId: string;
  channelId: string;
  text: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  createdAt: Date;
  editedAt?: Date;
  type: 'message' | 'system' | 'plan';
  reactions: { [emoji: string]: string[] }; // emoji -> userIds
  replyTo?: string; // message id if this is a reply
  replyToText?: string; // preview of the message being replied to
  replyToSender?: string; // name of the person being replied to
  isPinned?: boolean;
  attachments?: { name: string; url: string; type: string }[];
  mentions?: string[]; // user IDs mentioned
  threadCount?: number; // number of replies in thread
}

// Channel type
export interface Channel {
  id: string;
  teamId: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  createdAt: Date;
  createdBy: string;
  members?: string[];
  lastMessageAt?: Date;
  unreadCount?: number;
}

// User presence type
export interface UserPresence {
  odfserId: string;
  name: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  statusMessage?: string;
  lastSeen: Date;
  isTyping?: boolean;
  currentChannel?: string;
}

// Firestore types
interface FirestoreMessage {
  id: string;
  teamId: string;
  channelId: string;
  text: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  createdAt: Timestamp;
  editedAt?: Timestamp;
  type: 'message' | 'system' | 'plan';
  reactions?: { [emoji: string]: string[] };
  replyTo?: string;
  replyToText?: string;
  replyToSender?: string;
  isPinned?: boolean;
  attachments?: { name: string; url: string; type: string }[];
  mentions?: string[];
  threadCount?: number;
}

interface FirestoreChannel {
  id: string;
  teamId: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  createdAt: Timestamp;
  createdBy: string;
  members?: string[];
  lastMessageAt?: Timestamp;
}

// Convert Firestore message to ChatMessage
const toMessage = (firestoreMessage: FirestoreMessage): ChatMessage => ({
  id: firestoreMessage.id,
  teamId: firestoreMessage.teamId,
  channelId: firestoreMessage.channelId,
  text: firestoreMessage.text,
  senderId: firestoreMessage.senderId,
  senderName: firestoreMessage.senderName,
  senderAvatar: firestoreMessage.senderAvatar,
  createdAt: firestoreMessage.createdAt?.toDate() || new Date(),
  editedAt: firestoreMessage.editedAt?.toDate(),
  type: firestoreMessage.type || 'message',
  reactions: firestoreMessage.reactions || {},
  replyTo: firestoreMessage.replyTo,
  replyToText: firestoreMessage.replyToText,
  replyToSender: firestoreMessage.replyToSender,
  isPinned: firestoreMessage.isPinned,
  attachments: firestoreMessage.attachments,
  mentions: firestoreMessage.mentions,
  threadCount: firestoreMessage.threadCount,
});

// Convert Firestore channel to Channel
const toChannel = (firestoreChannel: FirestoreChannel): Channel => ({
  id: firestoreChannel.id,
  teamId: firestoreChannel.teamId,
  name: firestoreChannel.name,
  description: firestoreChannel.description,
  isPrivate: firestoreChannel.isPrivate,
  createdAt: firestoreChannel.createdAt?.toDate() || new Date(),
  createdBy: firestoreChannel.createdBy,
  members: firestoreChannel.members,
  lastMessageAt: firestoreChannel.lastMessageAt?.toDate(),
});

// Get avatar color based on name
export const getAvatarColor = (name: string) => {
  const colors = [
    '#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6', '#F97316'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

// Format message text with mentions and formatting
export const formatMessageText = (text: string): string => {
  // Bold: *text* -> <strong>text</strong>
  let formatted = text.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
  // Italic: _text_ -> <em>text</em>
  formatted = formatted.replace(/_([^_]+)_/g, '<em>$1</em>');
  // Code: `text` -> <code>text</code>
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Strikethrough: ~text~ -> <del>text</del>
  formatted = formatted.replace(/~([^~]+)~/g, '<del>$1</del>');
  // Links: automatically linkify URLs
  formatted = formatted.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  // Mentions: @name -> <span class="mention">@name</span>
  formatted = formatted.replace(
    /@(\w+)/g,
    '<span class="mention">@$1</span>'
  );
  return formatted;
};

export function useTeamChat(teamId: string | null, channelId: string | null = 'general') {
  const { user, userProfile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [typingUsers, setTypingUsers] = useState<{ [userId: string]: string }>({});
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to channels for this team
  useEffect(() => {
    if (!teamId) {
      setChannels([]);
      return;
    }

    const channelsRef = collection(db, 'teamChannels');
    const q = query(
      channelsRef,
      where('teamId', '==', teamId),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const channelsList: Channel[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as Omit<FirestoreChannel, 'id'>;
          channelsList.push(toChannel({ id: doc.id, ...data }));
        });
        
        // If no channels exist, we'll create a default one
        if (channelsList.length === 0 && user) {
          createChannel('general', 'General discussion for the team', false);
        }
        
        setChannels(channelsList);
      },
      (err) => {
        console.error('Error fetching channels:', err);
      }
    );

    return () => unsubscribe();
  }, [teamId, user]);

  // Subscribe to messages for this channel
  useEffect(() => {
    if (!teamId || !channelId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const messagesRef = collection(db, 'teamMessages');
    const q = query(
      messagesRef,
      where('teamId', '==', teamId),
      where('channelId', '==', channelId),
      orderBy('createdAt', 'asc'),
      limit(200)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const messagesList: ChatMessage[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as Omit<FirestoreMessage, 'id'>;
          messagesList.push(toMessage({ id: doc.id, ...data }));
        });
        setMessages(messagesList);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching messages:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [teamId, channelId]);

  // Subscribe to typing indicators
  useEffect(() => {
    if (!teamId || !channelId) return;

    const typingRef = collection(db, 'typingIndicators');
    const q = query(
      typingRef,
      where('teamId', '==', teamId),
      where('channelId', '==', channelId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const typing: { [userId: string]: string } = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Only show typing if it's recent (within 5 seconds)
        if (data.timestamp && data.userId !== user?.uid) {
          const timestamp = data.timestamp.toDate();
          if (Date.now() - timestamp.getTime() < 5000) {
            typing[data.userId] = data.userName;
          }
        }
      });
      setTypingUsers(typing);
    });

    return () => unsubscribe();
  }, [teamId, channelId, user?.uid]);

  // Subscribe to online users
  useEffect(() => {
    if (!teamId) return;

    const presenceRef = collection(db, 'userPresence');
    const q = query(
      presenceRef,
      where('teamId', '==', teamId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users: UserPresence[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        users.push({
          odfserId: data.userId,
          name: data.name,
          status: data.status || 'offline',
          statusMessage: data.statusMessage,
          lastSeen: data.lastSeen?.toDate() || new Date(),
          isTyping: data.isTyping,
          currentChannel: data.currentChannel,
        });
      });
      setOnlineUsers(users);
    });

    return () => unsubscribe();
  }, [teamId]);

  // Update user presence
  const updatePresence = useCallback(async (status: 'online' | 'away' | 'busy' | 'offline') => {
    if (!user || !teamId || !userProfile) return;

    const presenceRef = doc(db, 'userPresence', `${teamId}-${user.uid}`);
    await setDoc(presenceRef, {
      teamId,
      odfserId: user.uid,
      name: userProfile.displayName || user.displayName || 'Unknown',
      status,
      lastSeen: serverTimestamp(),
      currentChannel: channelId,
    }, { merge: true });
  }, [user, teamId, userProfile, channelId]);

  // Set user online when component mounts
  useEffect(() => {
    if (user && teamId) {
      updatePresence('online');
      
      // Set offline when tab closes
      const handleUnload = () => {
        updatePresence('offline');
      };
      window.addEventListener('beforeunload', handleUnload);
      
      return () => {
        window.removeEventListener('beforeunload', handleUnload);
        updatePresence('offline');
      };
    }
  }, [user, teamId, updatePresence]);

  // Create a new channel
  const createChannel = useCallback(
    async (name: string, description?: string, isPrivate: boolean = false) => {
      if (!user || !teamId || !userProfile) {
        return { error: new Error('Not authenticated') };
      }

      try {
        const channelsRef = collection(db, 'teamChannels');
        const channelData = {
          teamId,
          name: name.toLowerCase().replace(/\s+/g, '-'),
          description: description || null,
          isPrivate,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          members: isPrivate ? [user.uid] : null,
        };
        
        const docRef = await addDoc(channelsRef, channelData);
        return { id: docRef.id, error: null };
      } catch (err) {
        return { id: null, error: err as Error };
      }
    },
    [user, teamId, userProfile]
  );

  // Send typing indicator
  const sendTypingIndicator = useCallback(async () => {
    if (!user || !teamId || !channelId || !userProfile) return;

    const typingRef = doc(db, 'typingIndicators', `${teamId}-${channelId}-${user.uid}`);
    await setDoc(typingRef, {
      teamId,
      channelId,
      odfserId: user.uid,
      userName: userProfile.displayName || user.displayName || 'Unknown',
      timestamp: serverTimestamp(),
    });

    // Clear typing indicator after 3 seconds
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(async () => {
      await deleteDoc(typingRef);
    }, 3000);
  }, [user, teamId, channelId, userProfile]);

  // Send a new message
  const sendMessage = useCallback(
    async (
      text: string, 
      type: 'message' | 'plan' = 'message', 
      replyTo?: ChatMessage
    ) => {
      if (!user || !teamId || !channelId || !userProfile || !text.trim()) {
        return { error: new Error('Cannot send message') };
      }

      try {
        // Clear typing indicator
        const typingRef = doc(db, 'typingIndicators', `${teamId}-${channelId}-${user.uid}`);
        await deleteDoc(typingRef).catch(() => {});

        const messagesRef = collection(db, 'teamMessages');
        const displayName = userProfile.displayName || user.displayName || 'Unknown';
        
        // Extract mentions from text
        const mentionMatches = text.match(/@(\w+)/g);
        const mentions = mentionMatches ? mentionMatches.map(m => m.slice(1)) : [];
        
        const firestoreData: Record<string, unknown> = {
          teamId,
          channelId,
          text: text.trim(),
          senderId: user.uid,
          senderName: displayName,
          senderAvatar: displayName.charAt(0).toUpperCase(),
          createdAt: serverTimestamp(),
          type,
          reactions: {},
          mentions: mentions.length > 0 ? mentions : null,
        };

        if (replyTo) {
          firestoreData.replyTo = replyTo.id;
          firestoreData.replyToText = replyTo.text.slice(0, 100);
          firestoreData.replyToSender = replyTo.senderName;
        }
        
        const docRef = await addDoc(messagesRef, firestoreData);

        // Update channel's lastMessageAt
        const channelRef = doc(db, 'teamChannels', channelId);
        await updateDoc(channelRef, {
          lastMessageAt: serverTimestamp(),
        }).catch(() => {}); // Ignore if channel doesn't exist yet

        return { id: docRef.id, error: null };
      } catch (err) {
        return { id: null, error: err as Error };
      }
    },
    [user, teamId, channelId, userProfile]
  );

  // Edit a message
  const editMessage = useCallback(
    async (messageId: string, newText: string) => {
      if (!user) {
        return { error: new Error('Not authenticated') };
      }

      try {
        const messageRef = doc(db, 'teamMessages', messageId);
        await updateDoc(messageRef, {
          text: newText.trim(),
          editedAt: serverTimestamp(),
        });
        return { error: null };
      } catch (err) {
        return { error: err as Error };
      }
    },
    [user]
  );

  // Delete a message
  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!user) {
        return { error: new Error('Not authenticated') };
      }

      try {
        const messageRef = doc(db, 'teamMessages', messageId);
        await deleteDoc(messageRef);
        return { error: null };
      } catch (err) {
        return { error: err as Error };
      }
    },
    [user]
  );

  // Add reaction to message
  const addReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!user) {
        return { error: new Error('Not authenticated') };
      }

      try {
        const messageRef = doc(db, 'teamMessages', messageId);
        const messageDoc = await getDoc(messageRef);
        
        if (!messageDoc.exists()) {
          return { error: new Error('Message not found') };
        }

        const data = messageDoc.data();
        const reactions = data.reactions || {};
        
        if (!reactions[emoji]) {
          reactions[emoji] = [];
        }
        
        // Toggle reaction
        const userIndex = reactions[emoji].indexOf(user.uid);
        if (userIndex === -1) {
          reactions[emoji].push(user.uid);
        } else {
          reactions[emoji].splice(userIndex, 1);
          if (reactions[emoji].length === 0) {
            delete reactions[emoji];
          }
        }

        await updateDoc(messageRef, { reactions });
        return { error: null };
      } catch (err) {
        return { error: err as Error };
      }
    },
    [user]
  );

  // Pin/unpin a message
  const togglePinMessage = useCallback(
    async (messageId: string) => {
      if (!user) {
        return { error: new Error('Not authenticated') };
      }

      try {
        const messageRef = doc(db, 'teamMessages', messageId);
        const messageDoc = await getDoc(messageRef);
        
        if (!messageDoc.exists()) {
          return { error: new Error('Message not found') };
        }

        const isPinned = messageDoc.data().isPinned || false;
        await updateDoc(messageRef, { isPinned: !isPinned });
        return { error: null };
      } catch (err) {
        return { error: err as Error };
      }
    },
    [user]
  );

  // Search messages
  const searchMessages = useCallback((searchQuery: string): ChatMessage[] => {
    if (!searchQuery.trim()) return messages;
    
    const query = searchQuery.toLowerCase();
    return messages.filter(msg => 
      msg.text.toLowerCase().includes(query) ||
      msg.senderName.toLowerCase().includes(query)
    );
  }, [messages]);

  // Get pinned messages
  const pinnedMessages = messages.filter(msg => msg.isPinned);

  return {
    messages,
    channels,
    pinnedMessages,
    typingUsers,
    onlineUsers,
    loading,
    error,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    togglePinMessage,
    createChannel,
    sendTypingIndicator,
    updatePresence,
    searchMessages,
    getAvatarColor,
    formatMessageText,
    currentUserId: user?.uid,
  };
}
