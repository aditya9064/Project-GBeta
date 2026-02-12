/* ═══════════════════════════════════════════════════════════
   User Voice Profile Service — Personal AI Voice Learning
   
   This is the core of the personalized AI system. It learns from
   the USER's OWN sent messages to build a comprehensive voice
   profile that makes AI responses indistinguishable from the
   user's actual writing.
   
   Unlike a ChatGPT wrapper that generates generic responses,
   this system:
   
   1. Fetches the user's SENT messages from Gmail, Slack, Teams
   2. Analyzes 20+ dimensions of their writing style
   3. Builds a persistent "voice fingerprint"
   4. Uses that fingerprint for ALL AI-generated responses
   
   The result: AI drafts that sound exactly like the user wrote them.
   ═══════════════════════════════════════════════════════════ */

import { GmailService } from './gmail.service.js';
import { SlackService } from './slack.service.js';
import { StyleAnalyzer } from './style-analyzer.js';
import type { UnifiedMessage, StyleProfile } from '../types.js';

/* ─── User Voice Profile Type ─────────────────────────── */

export interface UserVoiceProfile {
  /** Unique user identifier */
  userId: string;
  
  /** User's name */
  userName: string;
  
  /** User's email */
  userEmail?: string;
  
  /** The comprehensive style profile learned from their messages */
  styleProfile: StyleProfile;
  
  /** Channel-specific style variations */
  channelStyles: {
    email?: Partial<StyleProfile>;
    slack?: Partial<StyleProfile>;
    teams?: Partial<StyleProfile>;
  };
  
  /** Number of messages analyzed to build this profile */
  messagesAnalyzed: number;
  
  /** Breakdown by channel */
  messagesByChannel: {
    email: number;
    slack: number;
    teams: number;
  };
  
  /** When the profile was created */
  createdAt: Date;
  
  /** When the profile was last updated */
  updatedAt: Date;
  
  /** Confidence score (0-100) — higher with more messages */
  confidence: number;
  
  /** Whether the profile is ready for use */
  isReady: boolean;
}

/* ─── State ────────────────────────────────────────────── */

let userVoiceProfile: UserVoiceProfile | null = null;

/* ─── Minimum messages needed for a reliable profile ─── */
const MIN_MESSAGES_FOR_PROFILE = 10;
const IDEAL_MESSAGES_FOR_PROFILE = 50;

/* ═══════════════════════════════════════════════════════════
   User Voice Profile Service
   ═══════════════════════════════════════════════════════════ */

export const UserVoiceService = {
  /**
   * Learn the user's voice from their sent messages.
   * This fetches sent messages from all connected channels and
   * builds a comprehensive style profile.
   * 
   * Should be called:
   * - When the user first connects their accounts
   * - Periodically to update the profile with new messages
   * - When the user explicitly requests a refresh
   */
  async learnUserVoice(options?: {
    userId?: string;
    userName?: string;
    userEmail?: string;
    maxMessagesPerChannel?: number;
  }): Promise<UserVoiceProfile> {
    const userId = options?.userId || 'default';
    const userName = options?.userName || 'User';
    const userEmail = options?.userEmail;
    const maxMessages = options?.maxMessagesPerChannel || 100;

    console.log('\n🎓 User Voice Service: Starting voice learning...');
    console.log(`   User: ${userName} (${userId})`);

    const allSentMessages: UnifiedMessage[] = [];
    const messagesByChannel = { email: 0, slack: 0, teams: 0 };

    // ─── Fetch sent messages from Gmail ───────────────────
    try {
      const gmailConnection = GmailService.getConnection();
      if (gmailConnection.status === 'connected') {
        console.log('   📧 Fetching sent emails...');
        const sentEmails = await GmailService.fetchSentMessages(maxMessages);
        allSentMessages.push(...sentEmails);
        messagesByChannel.email = sentEmails.length;
        console.log(`   ✓ Found ${sentEmails.length} sent emails`);
      } else {
        console.log('   ⚠️  Gmail not connected, skipping email analysis');
      }
    } catch (err) {
      console.error('   ✗ Error fetching sent emails:', err);
    }

    // ─── Fetch sent messages from Slack ───────────────────
    try {
      const slackConnection = SlackService.getConnection();
      if (slackConnection.status === 'connected') {
        console.log('   💬 Fetching sent Slack messages...');
        const sentSlack = await SlackService.fetchSentMessages(maxMessages);
        allSentMessages.push(...sentSlack);
        messagesByChannel.slack = sentSlack.length;
        console.log(`   ✓ Found ${sentSlack.length} sent Slack messages`);
      } else {
        console.log('   ⚠️  Slack not connected, skipping Slack analysis');
      }
    } catch (err) {
      console.error('   ✗ Error fetching sent Slack messages:', err);
    }

    // ─── TODO: Fetch sent messages from Teams ─────────────
    // (Similar pattern when Teams service is implemented)

    console.log(`\n   📊 Total messages to analyze: ${allSentMessages.length}`);

    if (allSentMessages.length < MIN_MESSAGES_FOR_PROFILE) {
      console.log(`   ⚠️  Not enough messages (need at least ${MIN_MESSAGES_FOR_PROFILE})`);
      
      // Create a placeholder profile
      userVoiceProfile = {
        userId,
        userName,
        userEmail,
        styleProfile: createDefaultStyleProfile(userId, userName, userEmail),
        channelStyles: {},
        messagesAnalyzed: allSentMessages.length,
        messagesByChannel,
        createdAt: new Date(),
        updatedAt: new Date(),
        confidence: Math.round((allSentMessages.length / MIN_MESSAGES_FOR_PROFILE) * 30),
        isReady: false,
      };
      
      return userVoiceProfile;
    }

    // ─── Analyze ALL messages for overall style ───────────
    console.log('   🔍 Analyzing writing style...');
    
    // Create fake "contact" messages for the style analyzer
    // (The analyzer expects messages TO a contact, but we're analyzing FROM the user)
    const analysisMessages: UnifiedMessage[] = allSentMessages.map(msg => ({
      ...msg,
      // Swap from/to so the analyzer sees these as "from" the user
      from: userName,
      fromEmail: userEmail,
    }));

    const { profiles } = await StyleAnalyzer.analyzeMessages(analysisMessages);
    
    // The analyzer groups by contact, but we want a unified profile
    // Merge all profiles into one master profile
    const masterProfile = mergeProfiles(profiles, userId, userName, userEmail);

    // ─── Analyze channel-specific styles ──────────────────
    const channelStyles: UserVoiceProfile['channelStyles'] = {};

    // Email style
    const emailMessages = allSentMessages.filter(m => m.channel === 'email');
    if (emailMessages.length >= 5) {
      const { profiles: emailProfiles } = await StyleAnalyzer.analyzeMessages(
        emailMessages.map(m => ({ ...m, from: userName, fromEmail: userEmail }))
      );
      if (emailProfiles.length > 0) {
        channelStyles.email = emailProfiles[0];
        console.log(`   ✓ Email style analyzed (${emailMessages.length} messages)`);
      }
    }

    // Slack style
    const slackMessages = allSentMessages.filter(m => m.channel === 'slack');
    if (slackMessages.length >= 5) {
      const { profiles: slackProfiles } = await StyleAnalyzer.analyzeMessages(
        slackMessages.map(m => ({ ...m, from: userName, fromEmail: userEmail }))
      );
      if (slackProfiles.length > 0) {
        channelStyles.slack = slackProfiles[0];
        console.log(`   ✓ Slack style analyzed (${slackMessages.length} messages)`);
      }
    }

    // ─── Calculate confidence ────────────────────────────
    const confidence = Math.min(
      98,
      Math.round(
        (allSentMessages.length / IDEAL_MESSAGES_FOR_PROFILE) * 70 +
        (Object.keys(channelStyles).length * 10) +
        masterProfile.styleConfidence * 0.2
      )
    );

    // ─── Build the user voice profile ────────────────────
    userVoiceProfile = {
      userId,
      userName,
      userEmail,
      styleProfile: masterProfile,
      channelStyles,
      messagesAnalyzed: allSentMessages.length,
      messagesByChannel,
      createdAt: userVoiceProfile?.createdAt || new Date(),
      updatedAt: new Date(),
      confidence,
      isReady: true,
    };

    console.log(`\n✅ Voice profile ready!`);
    console.log(`   Confidence: ${confidence}%`);
    console.log(`   Formality: ${masterProfile.formality}`);
    console.log(`   Length: ${masterProfile.averageLength}`);
    console.log(`   Contractions: ${masterProfile.usesContractions}`);
    console.log(`   Emoji: ${masterProfile.emojiUsage}`);

    return userVoiceProfile;
  },

  /**
   * Get the current user voice profile.
   * Returns null if no profile has been learned yet.
   */
  getProfile(): UserVoiceProfile | null {
    return userVoiceProfile;
  },

  /**
   * Check if a voice profile is ready for use.
   */
  isReady(): boolean {
    return userVoiceProfile?.isReady ?? false;
  },

  /**
   * Get the style prompt for the AI engine.
   * This is the critical output that tells the AI exactly how to write.
   */
  getStylePrompt(channel?: 'email' | 'slack' | 'teams'): string | null {
    if (!userVoiceProfile || !userVoiceProfile.isReady) {
      return null;
    }

    // Use channel-specific style if available, otherwise use master profile
    const profile = channel && userVoiceProfile.channelStyles[channel]
      ? { ...userVoiceProfile.styleProfile, ...userVoiceProfile.channelStyles[channel] }
      : userVoiceProfile.styleProfile;

    return StyleAnalyzer.getStylePromptForContact(profile as StyleProfile);
  },

  /**
   * Get a summary of the learned voice for display to the user.
   */
  getVoiceSummary(): {
    isReady: boolean;
    confidence: number;
    messagesAnalyzed: number;
    keyTraits: string[];
    channelsCovered: string[];
  } {
    if (!userVoiceProfile) {
      return {
        isReady: false,
        confidence: 0,
        messagesAnalyzed: 0,
        keyTraits: [],
        channelsCovered: [],
      };
    }

    const keyTraits: string[] = [];
    const sp = userVoiceProfile.styleProfile;

    // Build human-readable traits
    keyTraits.push(`${sp.formality.replace(/_/g, ' ')} tone`);
    keyTraits.push(`${sp.averageLength} message length`);
    if (sp.usesContractions) keyTraits.push('uses contractions');
    else keyTraits.push('formal language (no contractions)');
    if (sp.emojiUsage !== 'none') keyTraits.push(`${sp.emojiUsage} emoji use`);
    if (sp.asksFollowUpQuestions) keyTraits.push('asks follow-up questions');
    if (sp.humorStyle !== 'none') keyTraits.push(`${sp.humorStyle.replace(/_/g, ' ')} humor`);
    if (sp.endsWithActionItems) keyTraits.push('ends with action items');

    const channelsCovered: string[] = [];
    if (userVoiceProfile.messagesByChannel.email > 0) channelsCovered.push('Email');
    if (userVoiceProfile.messagesByChannel.slack > 0) channelsCovered.push('Slack');
    if (userVoiceProfile.messagesByChannel.teams > 0) channelsCovered.push('Teams');

    return {
      isReady: userVoiceProfile.isReady,
      confidence: userVoiceProfile.confidence,
      messagesAnalyzed: userVoiceProfile.messagesAnalyzed,
      keyTraits,
      channelsCovered,
    };
  },

  /**
   * Clear the learned profile (for testing or user request).
   */
  clearProfile(): void {
    userVoiceProfile = null;
    console.log('🗑️  User voice profile cleared');
  },
};

/* ─── Helper: Merge multiple profiles into one ─────────── */

function mergeProfiles(
  profiles: StyleProfile[],
  userId: string,
  userName: string,
  userEmail?: string
): StyleProfile {
  if (profiles.length === 0) {
    return createDefaultStyleProfile(userId, userName, userEmail);
  }

  if (profiles.length === 1) {
    return {
      ...profiles[0],
      contactId: userId,
      contactName: userName,
      contactEmail: userEmail,
    };
  }

  // For multiple profiles, take the most common values
  const first = profiles[0];
  
  // Simple merge: weight by message count
  const totalMessages = profiles.reduce((sum, p) => sum + p.messageCount, 0);
  
  // Weighted average for numeric values
  const avgWords = Math.round(
    profiles.reduce((sum, p) => sum + p.avgWordsPerMessage * p.messageCount, 0) / totalMessages
  );
  const avgConfidence = Math.round(
    profiles.reduce((sum, p) => sum + p.styleConfidence * p.messageCount, 0) / totalMessages
  );

  // Most common formality
  const formalityCounts = new Map<string, number>();
  for (const p of profiles) {
    formalityCounts.set(p.formality, (formalityCounts.get(p.formality) || 0) + p.messageCount);
  }
  let formality = first.formality;
  let maxFormalityCount = 0;
  for (const [f, count] of formalityCounts) {
    if (count > maxFormalityCount) {
      maxFormalityCount = count;
      formality = f as StyleProfile['formality'];
    }
  }

  // Merge common transitions and hedge words
  const allTransitions = new Set<string>();
  const allHedgeWords = new Set<string>();
  for (const p of profiles) {
    p.commonTransitions.forEach(t => allTransitions.add(t));
    p.hedgeWords.forEach(h => allHedgeWords.add(h));
  }

  return {
    ...first,
    contactId: userId,
    contactName: userName,
    contactEmail: userEmail,
    formality,
    avgWordsPerMessage: avgWords,
    styleConfidence: avgConfidence,
    messageCount: totalMessages,
    commonTransitions: [...allTransitions].slice(0, 10),
    hedgeWords: [...allHedgeWords].slice(0, 10),
    analyzedAt: new Date(),
  };
}

/* ─── Helper: Create a default profile ─────────────────── */

function createDefaultStyleProfile(
  userId: string,
  userName: string,
  userEmail?: string
): StyleProfile {
  return {
    contactId: userId,
    contactName: userName,
    contactEmail: userEmail,
    formality: 'neutral',
    averageLength: 'moderate',
    emojiUsage: 'minimal',
    greetingStyle: 'Hi [name],',
    closingStyle: 'Best,',
    vocabularyLevel: 'moderate',
    sentenceStructure: 'balanced',
    usesSlang: false,
    usesBulletPoints: false,
    typicalCategories: [],
    relationship: 'peer',
    usesContractions: true,
    capitalization: 'standard',
    punctuation: {
      exclamationFrequency: 'rare',
      usesEllipsis: false,
      usesEmDash: false,
      questionMarkUsage: 'sometimes',
      usesSemicolons: false,
      usesParentheses: false,
    },
    commonTransitions: [],
    hedgeWords: [],
    pronounPreference: 'mixed',
    asksFollowUpQuestions: false,
    humorStyle: 'none',
    paragraphStyle: 'well_structured',
    timeAwareness: false,
    endsWithActionItems: false,
    acknowledgmentStyle: 'Thanks',
    signOffName: userName.split(' ')[0],
    avgWordsPerMessage: 50,
    avgSentencesPerMessage: 3,
    styleConfidence: 30,
    sampleCount: 0,
    analyzedAt: new Date(),
    messageCount: 0
  };
}

