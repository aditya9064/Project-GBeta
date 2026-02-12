/* ═══════════════════════════════════════════════════════════
   AI Engine Routes — Personalized Voice Learning
   
   POST /api/ai/analyze       — Analyze a message (intent, sentiment, etc.)
   POST /api/ai/generate      — Generate a response using user's voice
   GET  /api/ai/config        — Get AI engine configuration
   PUT  /api/ai/config        — Update AI engine configuration
   POST /api/ai/learn-voice   — Learn user's voice from their sent messages
   GET  /api/ai/voice-profile — Get current voice profile status
   DELETE /api/ai/voice-profile — Clear the learned voice profile
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { AIEngine } from '../services/ai-engine.js';
import { StyleAnalyzer } from '../services/style-analyzer.js';
import { UserVoiceService } from '../services/user-voice.service.js';
import type { UnifiedMessage, AIResponseConfig } from '../types.js';

const router = Router();

/* ─── POST /api/ai/analyze ─────────────────────────────── */

router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const message = req.body.message as UnifiedMessage;
    if (!message) {
      res.status(400).json({ success: false, error: 'Message is required' });
      return;
    }

    // Use quick analysis (heuristic) for speed, or full analysis with AI
    const useAI = req.query.full === 'true';
    const analysis = useAI
      ? await AIEngine.analyze(message)
      : AIEngine.quickAnalyze(message);

    res.json({ success: true, data: analysis });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Analysis failed',
    });
  }
});

/* ─── POST /api/ai/generate ────────────────────────────── */

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { message, feedback } = req.body;
    if (!message) {
      res.status(400).json({ success: false, error: 'Message is required' });
      return;
    }

    const result = feedback
      ? await AIEngine.regenerateWithFeedback(message, feedback)
      : await AIEngine.generateResponse(message);

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Generation failed',
    });
  }
});

/* ─── GET /api/ai/config ──────────────────────────────── */

router.get('/config', (_req: Request, res: Response) => {
  res.json({ success: true, data: AIEngine.getConfig() });
});

/* ─── PUT /api/ai/config ──────────────────────────────── */

router.put('/config', (req: Request, res: Response) => {
  try {
    const updates = req.body as Partial<AIResponseConfig>;
    AIEngine.updateConfig(updates);
    res.json({ success: true, data: AIEngine.getConfig() });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update config',
    });
  }
});

/* ─── POST /api/ai/analyze-style ──────────────────────── */

router.post('/analyze-style', async (req: Request, res: Response) => {
  try {
    const messages = req.body.messages as UnifiedMessage[];
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ success: false, error: 'Messages array is required' });
      return;
    }

    const { profiles, result } = await StyleAnalyzer.analyzeMessages(messages);

    // Store profiles in the AI engine for future draft generation
    AIEngine.setStyleProfiles(profiles);

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Style analysis failed',
    });
  }
});

/* ═══════════════════════════════════════════════════════════
   USER VOICE LEARNING — Learn from user's sent messages
   
   This is what makes this a CUSTOM AI, not a ChatGPT wrapper:
   - Fetches user's SENT messages from Gmail, Slack, Teams
   - Analyzes their writing style across 20+ dimensions
   - Builds a persistent voice fingerprint
   - All future AI drafts match the user's actual voice
   ═══════════════════════════════════════════════════════════ */

/* ─── POST /api/ai/learn-voice ─────────────────────────── */
/**
 * Trigger voice learning from the user's sent messages.
 * This fetches sent messages from all connected channels and
 * builds a comprehensive voice profile.
 * 
 * Body (optional):
 * - userId: string — User identifier
 * - userName: string — User's display name
 * - userEmail: string — User's email
 * - maxMessagesPerChannel: number — Max messages to analyze per channel (default 100)
 */
router.post('/learn-voice', async (req: Request, res: Response) => {
  try {
    const { userId, userName, userEmail, maxMessagesPerChannel } = req.body;

    console.log('\n🎓 Starting voice learning...');
    
    const profile = await UserVoiceService.learnUserVoice({
      userId,
      userName,
      userEmail,
      maxMessagesPerChannel,
    });

    res.json({
      success: true,
      data: {
        isReady: profile.isReady,
        confidence: profile.confidence,
        messagesAnalyzed: profile.messagesAnalyzed,
        messagesByChannel: profile.messagesByChannel,
        summary: UserVoiceService.getVoiceSummary(),
      },
    });
  } catch (err) {
    console.error('Voice learning error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Voice learning failed',
    });
  }
});

/* ─── GET /api/ai/voice-profile ────────────────────────── */
/**
 * Get the current voice profile status and summary.
 * Returns whether a profile is ready, confidence level, and key traits.
 */
router.get('/voice-profile', (_req: Request, res: Response) => {
  const profile = UserVoiceService.getProfile();
  const summary = UserVoiceService.getVoiceSummary();

  res.json({
    success: true,
    data: {
      hasProfile: !!profile,
      ...summary,
      // Include detailed profile info if ready
      ...(profile?.isReady ? {
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        formality: profile.styleProfile.formality,
        averageLength: profile.styleProfile.averageLength,
        usesContractions: profile.styleProfile.usesContractions,
        emojiUsage: profile.styleProfile.emojiUsage,
        greetingStyle: profile.styleProfile.greetingStyle,
        closingStyle: profile.styleProfile.closingStyle,
      } : {}),
    },
  });
});

/* ─── DELETE /api/ai/voice-profile ─────────────────────── */
/**
 * Clear the learned voice profile.
 * Used for testing or when user wants to start fresh.
 */
router.delete('/voice-profile', (_req: Request, res: Response) => {
  UserVoiceService.clearProfile();
  res.json({ success: true, message: 'Voice profile cleared' });
});

/* ─── GET /api/ai/voice-prompt ─────────────────────────── */
/**
 * Get the style prompt that would be used for a given channel.
 * Useful for debugging and understanding what the AI sees.
 */
router.get('/voice-prompt', (req: Request, res: Response) => {
  const channel = req.query.channel as 'email' | 'slack' | 'teams' | undefined;
  const prompt = UserVoiceService.getStylePrompt(channel);

  if (!prompt) {
    res.json({
      success: true,
      data: {
        hasPrompt: false,
        message: 'No voice profile learned yet. Connect Gmail/Slack and call POST /api/ai/learn-voice',
      },
    });
    return;
  }

  res.json({
    success: true,
    data: {
      hasPrompt: true,
      channel: channel || 'default',
      prompt,
    },
  });
});

export { router as aiRouter };

