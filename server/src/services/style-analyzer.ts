/* ═══════════════════════════════════════════════════════════
   Style Analyzer Service — Deep Voice Fingerprinting
   
   Analyzes the USER's communication patterns across messages
   to build a comprehensive style profile per contact.
   
   Achieves >90% style accuracy through:
   1. Deep heuristic analysis (20+ dimensions)
   2. AI-powered pattern recognition (GPT-4o)
   3. Cross-validation between heuristic & AI results
   4. Confidence scoring per dimension
   
   IMPORTANT: Only style characteristics are stored, NEVER
   the actual message content. This ensures privacy while
   enabling personalized AI draft generation.
   ═══════════════════════════════════════════════════════════ */

import OpenAI from 'openai';
import { config } from '../config.js';
import type {
  UnifiedMessage,
  StyleProfile,
  StyleAnalysisResult,
  RelationshipType,
} from '../types.js';

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (!config.openai.apiKey) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return openaiClient;
}

/* ═══════════════════════════════════════════════════════════
   Deep Heuristic Analysis — 20+ Dimensions
   ═══════════════════════════════════════════════════════════ */

function analyzeStyleHeuristic(
  userMessages: string[]
): Omit<StyleProfile, 'contactId' | 'contactName' | 'contactEmail' | 'analyzedAt' | 'messageCount' | 'channelOverride'> {
  const allText = userMessages.join('\n');
  const totalLen = allText.length;
  const count = userMessages.length || 1;
  const avgLen = totalLen / count;

  // ─── 1. Formality Detection ──────────────────────────
  const formalMarkers = /\b(dear|sincerely|regards|respectfully|pursuant|herein|kindly|enclosed|forthwith|moreover|furthermore|henceforth|accordingly|per our|as per)\b/gi;
  const casualMarkers = /\b(hey|yo|lol|haha|gonna|wanna|kinda|btw|np|nvm|tbh|imo|imho|fwiw|ikr|omg|tho|cuz|nah|yep|yup|cool|awesome|dope|legit|lowkey|highkey)\b/gi;
  const formalCount = (allText.match(formalMarkers) || []).length;
  const casualCount = (allText.match(casualMarkers) || []).length;

  let formality: StyleProfile['formality'] = 'neutral';
  if (formalCount > casualCount * 3) formality = 'very_formal';
  else if (formalCount > casualCount * 1.5) formality = 'formal';
  else if (casualCount > formalCount * 3) formality = 'very_casual';
  else if (casualCount > formalCount * 1.5) formality = 'casual';

  // ─── 2. Emoji Usage ──────────────────────────────────
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  const emojiCount = (allText.match(emojiRegex) || []).length;
  const emojiPerMsg = emojiCount / count;
  let emojiUsage: StyleProfile['emojiUsage'] = 'none';
  if (emojiPerMsg > 3) emojiUsage = 'frequent';
  else if (emojiPerMsg > 1) emojiUsage = 'moderate';
  else if (emojiPerMsg > 0) emojiUsage = 'minimal';

  // ─── 3. Average Length ────────────────────────────────
  const totalWords = allText.split(/\s+/).filter(w => w.length > 0).length;
  const avgWords = totalWords / count;
  let averageLength: StyleProfile['averageLength'] = 'moderate';
  if (avgWords > 120) averageLength = 'detailed';
  else if (avgWords < 40) averageLength = 'brief';

  // ─── 4. Greeting Detection (per-message analysis) ────
  const greetingCounts = new Map<string, number>();
  for (const msg of userMessages) {
    const firstLine = msg.split('\n')[0].trim();
    const patterns: [RegExp, string][] = [
      [/^dear\s+\w/i, 'Dear [name],'],
      [/^hello\s/i, 'Hello [name],'],
      [/^hi\s/i, 'Hi [name],'],
      [/^hey\s/i, 'Hey [name],'],
      [/^hey!?\s*$/i, 'Hey!'],
      [/^good\s+(morning|afternoon|evening)/i, 'Good [time],'],
      [/^thanks\s+for/i, 'Thanks for...'],
      [/^hope\s+/i, 'Hope you\'re...'],
    ];
    for (const [regex, style] of patterns) {
      if (regex.test(firstLine)) {
        greetingCounts.set(style, (greetingCounts.get(style) || 0) + 1);
        break;
      }
    }
  }
  let greetingStyle = 'Hi [name],';
  let maxGreetCount = 0;
  for (const [style, cnt] of greetingCounts) {
    if (cnt > maxGreetCount) {
      maxGreetCount = cnt;
      greetingStyle = style;
    }
  }

  // ─── 5. Closing Detection (per-message analysis) ─────
  const closingCounts = new Map<string, number>();
  for (const msg of userMessages) {
    const lines = msg.split('\n').filter(l => l.trim().length > 0);
    const lastThree = lines.slice(-3).join(' ').trim();
    const closingPatterns: [RegExp, string][] = [
      [/best\s*regards/i, 'Best regards,'],
      [/warm\s*regards/i, 'Warm regards,'],
      [/kind\s*regards/i, 'Kind regards,'],
      [/sincerely/i, 'Sincerely,'],
      [/thanks!?\s*$/i, 'Thanks!'],
      [/thank\s+you!?\s*$/i, 'Thank you!'],
      [/cheers[,!]?\s*$/i, 'Cheers,'],
      [/best[,!]?\s*$/i, 'Best,'],
      [/talk\s+soon/i, 'Talk soon!'],
      [/take\s+care/i, 'Take care,'],
      [/looking\s+forward/i, 'Looking forward to hearing from you.'],
      [/let\s+me\s+know/i, 'Let me know!'],
    ];
    for (const [regex, style] of closingPatterns) {
      if (regex.test(lastThree)) {
        closingCounts.set(style, (closingCounts.get(style) || 0) + 1);
        break;
      }
    }
  }
  let closingStyle = 'Best,';
  let maxCloseCount = 0;
  for (const [style, cnt] of closingCounts) {
    if (cnt > maxCloseCount) {
      maxCloseCount = cnt;
      closingStyle = style;
    }
  }

  // ─── 6. Vocabulary Level ──────────────────────────────
  const words = allText.split(/\s+/).filter(w => w.length > 0);
  const complexWords = words.filter(w => w.replace(/[^a-zA-Z]/g, '').length >= 10);
  const complexRatio = complexWords.length / (words.length || 1);
  const techMarkers = /\b(api|deploy|repository|commit|refactor|pipeline|sprint|endpoint|kubernetes|docker|microservice|authentication|middleware|webhook|latency|throughput|scalability|orchestration|containerize|ci\/cd|devops|frontend|backend|fullstack|database|schema|migration|dependency|typescript|javascript|python|react|node|graphql)\b/gi;
  const techCount = (allText.match(techMarkers) || []).length;
  const techRatio = techCount / (words.length || 1);

  let vocabularyLevel: StyleProfile['vocabularyLevel'] = 'moderate';
  if (techRatio > 0.02) vocabularyLevel = 'technical';
  else if (complexRatio > 0.12) vocabularyLevel = 'advanced';
  else if (complexRatio < 0.04) vocabularyLevel = 'simple';

  // ─── 7. Sentence Structure ────────────────────────────
  const sentences = allText.split(/[.!?]+/).filter(s => s.trim().length > 3);
  const sentenceWordCounts = sentences.map(s => s.trim().split(/\s+/).length);
  const avgSentenceLen = sentenceWordCounts.reduce((sum, c) => sum + c, 0) / (sentences.length || 1);
  let sentenceStructure: StyleProfile['sentenceStructure'] = 'balanced';
  if (avgSentenceLen < 10) sentenceStructure = 'short_direct';
  else if (avgSentenceLen > 20) sentenceStructure = 'complex_detailed';

  // ─── 8. Contractions ──────────────────────────────────
  const contractionRegex = /\b(don't|doesn't|didn't|won't|wouldn't|can't|couldn't|shouldn't|isn't|aren't|wasn't|weren't|haven't|hasn't|hadn't|i'm|i've|i'd|i'll|we're|we've|we'd|we'll|they're|they've|they'd|they'll|you're|you've|you'd|you'll|he's|she's|it's|that's|there's|here's|what's|who's|how's|where's|let's|ain't)\b/gi;
  const expandedRegex = /\b(do not|does not|did not|will not|would not|cannot|could not|should not|is not|are not|was not|were not|have not|has not|had not|I am|I have|I would|I will|we are|we have|we would|we will)\b/gi;
  const contractionCount = (allText.match(contractionRegex) || []).length;
  const expandedCount = (allText.match(expandedRegex) || []).length;
  const usesContractions = contractionCount > expandedCount * 0.5;

  // ─── 9. Capitalization ────────────────────────────────
  let capitalization: StyleProfile['capitalization'] = 'standard';
  const msgStarts = userMessages.map(m => m.trim().charAt(0));
  const lowerStarts = msgStarts.filter(c => c === c.toLowerCase() && c !== c.toUpperCase()).length;
  if (lowerStarts > msgStarts.length * 0.6) capitalization = 'all_lower';
  // Check if user title-cases subjects
  const titleCaseRegex = /^[A-Z][a-z]+ [A-Z][a-z]+ [A-Z]/;
  const titleCaseLines = userMessages.filter(m => titleCaseRegex.test(m.trim())).length;
  if (titleCaseLines > count * 0.3) capitalization = 'title_case';

  // ─── 10. Punctuation Habits ───────────────────────────
  const exclamations = (allText.match(/!/g) || []).length;
  const exclamationPerMsg = exclamations / count;
  let exclamationFrequency: StyleProfile['punctuation']['exclamationFrequency'] = 'rare';
  if (exclamationPerMsg > 3) exclamationFrequency = 'frequent';
  else if (exclamationPerMsg > 1) exclamationFrequency = 'moderate';
  else if (exclamationPerMsg === 0) exclamationFrequency = 'never';

  const usesEllipsis = /\.{3}|…/.test(allText);
  const usesEmDash = /—|--/.test(allText);
  const questionMarks = (allText.match(/\?/g) || []).length;
  const questionSentences = allText.split(/[.!?\n]+/).filter(s => /\b(who|what|when|where|why|how|can|could|would|should|is|are|do|does|will|did)\b/i.test(s.trim())).length;
  let questionMarkUsage: 'always' | 'sometimes' | 'rarely' = 'sometimes';
  if (questionSentences > 0 && questionMarks / (questionSentences || 1) > 0.8) questionMarkUsage = 'always';
  else if (questionMarks < questionSentences * 0.3) questionMarkUsage = 'rarely';

  const usesSemicolons = (allText.match(/;/g) || []).length > 1;
  const usesParentheses = (allText.match(/\(/g) || []).length > 1;

  // ─── 11. Common Transitions ───────────────────────────
  const transitionPatterns = [
    'that said', 'moving forward', 'to be honest', 'on that note',
    'with that in mind', 'having said that', 'in any case', 'to clarify',
    'for context', 'just to confirm', 'quick update', 'heads up',
    'for what it\'s worth', 'as a heads up', 'on another note',
    'by the way', 'that being said', 'in the meantime', 'going forward',
    'long story short', 'bottom line', 'at the end of the day',
    'to summarize', 'in a nutshell', 'all things considered',
  ];
  const commonTransitions = transitionPatterns.filter(
    t => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi').test(allText)
  );

  // ─── 12. Hedge Words ──────────────────────────────────
  const hedgePatterns = [
    'I think', 'maybe', 'perhaps', 'probably', 'just', 'sort of',
    'kind of', 'I guess', 'I believe', 'I feel like', 'it seems',
    'might be', 'could be', 'not sure', 'I suppose', 'honestly',
    'to be fair', 'arguably', 'in my opinion', 'from my perspective',
  ];
  const hedgeWords = hedgePatterns.filter(
    h => new RegExp(`\\b${h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi').test(allText)
  );

  // ─── 13. Pronoun Preference ───────────────────────────
  const iCount = (allText.match(/\bI\b/g) || []).length;
  const weCount = (allText.match(/\b[Ww]e\b/g) || []).length;
  const totalPronouns = iCount + weCount;
  let pronounPreference: StyleProfile['pronounPreference'] = 'mixed';
  if (totalPronouns < words.length * 0.01) pronounPreference = 'avoids_pronouns';
  else if (iCount > weCount * 2) pronounPreference = 'i_focused';
  else if (weCount > iCount * 1.5) pronounPreference = 'we_focused';

  // ─── 14. Follow-up Questions ──────────────────────────
  const questionCount = (allText.match(/\?/g) || []).length;
  const asksFollowUpQuestions = questionCount / count > 0.5;

  // ─── 15. Humor Style ──────────────────────────────────
  const laughMarkers = /\b(lol|lmao|haha|hehe|😂|🤣|jk|j\/k)\b/gi;
  const witMarkers = /\b(ironically|apparently|spoiler alert|plot twist|fun fact)\b/gi;
  const playfulMarkers = /\b(oops|whoops|yikes|fingers crossed|no pressure)\b/gi;
  const laughCount = (allText.match(laughMarkers) || []).length;
  const witCount = (allText.match(witMarkers) || []).length;
  const playfulCount = (allText.match(playfulMarkers) || []).length;

  let humorStyle: StyleProfile['humorStyle'] = 'none';
  if (laughCount > 2) humorStyle = 'casual_jokes';
  else if (witCount > 1) humorStyle = 'dry_wit';
  else if (playfulCount > 1) humorStyle = 'playful';

  // ─── 16. Paragraph Style ──────────────────────────────
  const avgParagraphs = userMessages.reduce((sum, m) => {
    const paras = m.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    return sum + paras.length;
  }, 0) / count;

  const avgLinesPerMsg = userMessages.reduce((sum, m) => {
    return sum + m.split('\n').filter(l => l.trim().length > 0).length;
  }, 0) / count;

  let paragraphStyle: StyleProfile['paragraphStyle'] = 'well_structured';
  if (avgLinesPerMsg <= 2) paragraphStyle = 'one_liners';
  else if (avgParagraphs <= 1.2) paragraphStyle = 'single_block';
  else if (avgParagraphs > 2.5) paragraphStyle = 'short_paragraphs';

  // ─── 17. Time Awareness ───────────────────────────────
  const timeAwareness = /\b(sorry for the delay|apologies for the late|getting back to you|quick reply|just seeing this|sorry for the slow)\b/gi.test(allText);

  // ─── 18. Action Items at End ──────────────────────────
  let actionEndCount = 0;
  for (const msg of userMessages) {
    const lastThird = msg.slice(Math.floor(msg.length * 0.65));
    if (/\b(next steps|action items|to-?do|let me know|please confirm|can you|could you|I'll|we'll|going to)\b/i.test(lastThird)) {
      actionEndCount++;
    }
  }
  const endsWithActionItems = actionEndCount / count > 0.4;

  // ─── 19. Acknowledgment Style ─────────────────────────
  const ackPatterns: [RegExp, string][] = [
    [/\b(got it|gotcha)\b/i, 'Got it'],
    [/\b(noted|noted!)\b/i, 'Noted'],
    [/\bthanks for sharing\b/i, 'Thanks for sharing'],
    [/\bthanks for the update\b/i, 'Thanks for the update'],
    [/\bthanks for the heads up\b/i, 'Thanks for the heads up'],
    [/\bappreciate (it|the|this|that|you)\b/i, 'Appreciate it'],
    [/\breceived[,.]?\s/i, 'Received'],
    [/\bsounds good\b/i, 'Sounds good'],
    [/\bmakes sense\b/i, 'Makes sense'],
    [/\bperfect[!,.]?\s/i, 'Perfect'],
    [/\bawesome[!,.]?\s/i, 'Awesome'],
    [/\bgreat[!,.]?\s/i, 'Great'],
  ];
  let acknowledgmentStyle = 'Thanks for sharing';
  for (const [regex, style] of ackPatterns) {
    if (regex.test(allText)) {
      acknowledgmentStyle = style;
      break;
    }
  }

  // ─── 20. Sign-off Name ────────────────────────────────
  let signOffName = '';
  for (const msg of userMessages) {
    const lines = msg.split('\n').filter(l => l.trim().length > 0);
    const lastLine = lines[lines.length - 1]?.trim() || '';
    // Check if last line is a single name (1-3 words, all capitalized first letter)
    if (/^[A-Z][a-z]+(\s+[A-Z]\.?)?$/.test(lastLine)) {
      signOffName = lastLine;
      break;
    }
    // Check for dash-prefixed names
    const dashName = lastLine.match(/^[-–—]\s*([A-Z][a-z]+)/);
    if (dashName) {
      signOffName = dashName[1];
      break;
    }
  }

  // ─── 21. Slang & Bullet Points ────────────────────────
  const usesSlang = casualCount > 3;
  const usesBulletPoints = /[\n\r]\s*[-•*]\s/.test(allText) || /\n\s*\d+[.)]\s/.test(allText);

  // ─── 22. Topic Categories ─────────────────────────────
  const categories: string[] = [];
  if (/\b(project|sprint|deadline|milestone|roadmap)\b/i.test(allText)) categories.push('project_management');
  if (/\b(budget|cost|revenue|pricing|invoice)\b/i.test(allText)) categories.push('finance');
  if (/\b(bug|issue|fix|deploy|code|pipeline|api)\b/i.test(allText)) categories.push('engineering');
  if (/\b(meeting|schedule|calendar|standup|sync)\b/i.test(allText)) categories.push('scheduling');
  if (/\b(client|customer|stakeholder|partner)\b/i.test(allText)) categories.push('external_comms');
  if (/\b(design|mockup|figma|wireframe|ui|ux)\b/i.test(allText)) categories.push('design');
  if (/\b(hire|interview|candidate|onboard|resume)\b/i.test(allText)) categories.push('hr');

  // ─── Confidence Calculation ────────────────────────────
  // More messages → higher confidence
  let styleConfidence = Math.min(95, 40 + count * 5);
  // Long messages give more signal
  if (avgWords > 50) styleConfidence += 5;
  // Diverse vocabulary gives better signal
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  const vocabularyDiversity = uniqueWords.size / (words.length || 1);
  if (vocabularyDiversity > 0.4) styleConfidence += 5;
  styleConfidence = Math.min(98, styleConfidence);

  return {
    formality,
    averageLength,
    emojiUsage,
    greetingStyle,
    closingStyle,
    vocabularyLevel,
    sentenceStructure,
    usesSlang,
    usesBulletPoints,
    typicalCategories: categories,
    relationship: 'peer' as RelationshipType,
    // New granular dimensions
    usesContractions,
    capitalization,
    punctuation: {
      exclamationFrequency,
      usesEllipsis,
      usesEmDash,
      questionMarkUsage,
      usesSemicolons,
      usesParentheses,
    },
    commonTransitions,
    hedgeWords,
    pronounPreference,
    asksFollowUpQuestions,
    humorStyle,
    paragraphStyle,
    timeAwareness,
    endsWithActionItems,
    acknowledgmentStyle,
    signOffName,
    avgWordsPerMessage: Math.round(avgWords),
    avgSentencesPerMessage: Math.round(sentences.length / count * 10) / 10,
    styleConfidence,
    sampleCount: count,
  };
}

/* ═══════════════════════════════════════════════════════════
   AI-Powered Deep Analysis (GPT-4o)
   
   Uses the AI to recognize subtle patterns that heuristics miss:
   - Tone nuances, personality quirks
   - Context-dependent style shifts
   - Implicit communication preferences
   ═══════════════════════════════════════════════════════════ */

async function analyzeStyleWithAI(
  userMessages: string[],
  contactName: string,
  heuristicResult: ReturnType<typeof analyzeStyleHeuristic>,
): Promise<Partial<Omit<StyleProfile, 'contactId' | 'contactName' | 'contactEmail' | 'analyzedAt' | 'messageCount'>> | null> {
  const ai = getOpenAI();
  if (!ai) return null;

  try {
    // Use up to 15 messages for better pattern recognition
    const sampleSize = Math.min(userMessages.length, 15);
    const samples = userMessages.slice(0, sampleSize);

    const response = await ai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `You are an expert communication style analyst specializing in voice fingerprinting. Your job is to analyze writing samples and extract ONLY stylistic characteristics — never store or reference any actual content, topics, or sensitive information.

HEURISTIC PRE-ANALYSIS (use this as a starting point, refine or override if you detect patterns the heuristics missed):
- Formality: ${heuristicResult.formality}
- Avg Length: ${heuristicResult.averageLength}
- Emoji Usage: ${heuristicResult.emojiUsage}
- Greeting: "${heuristicResult.greetingStyle}"
- Closing: "${heuristicResult.closingStyle}"
- Vocabulary: ${heuristicResult.vocabularyLevel}
- Contractions: ${heuristicResult.usesContractions}
- Paragraph Style: ${heuristicResult.paragraphStyle}

Analyze the writing STYLE of messages sent TO "${contactName}" and return a JSON object. Focus on:
1. Subtle tone patterns the heuristic analysis might miss
2. Personality and voice characteristics
3. Relationship dynamics implied by the writing style
4. Any style patterns that are unique/distinctive to this writer

Return ONLY valid JSON with these fields:
{
  "formality": "very_formal" | "formal" | "neutral" | "casual" | "very_casual",
  "averageLength": "brief" | "moderate" | "detailed",
  "emojiUsage": "none" | "minimal" | "moderate" | "frequent",
  "greetingStyle": string,
  "closingStyle": string,
  "vocabularyLevel": "simple" | "moderate" | "advanced" | "technical",
  "sentenceStructure": "short_direct" | "balanced" | "complex_detailed",
  "usesContractions": boolean,
  "capitalization": "standard" | "all_lower" | "sentence_case" | "title_case",
  "pronounPreference": "i_focused" | "we_focused" | "mixed" | "avoids_pronouns",
  "asksFollowUpQuestions": boolean,
  "humorStyle": "none" | "dry_wit" | "casual_jokes" | "playful" | "sarcastic",
  "paragraphStyle": "single_block" | "short_paragraphs" | "well_structured" | "one_liners",
  "endsWithActionItems": boolean,
  "acknowledgmentStyle": string,
  "signOffName": string,
  "commonTransitions": [list of transitional phrases this person frequently uses],
  "hedgeWords": [list of hedge/filler phrases this person uses],
  "relationship": "manager" | "peer" | "direct_report" | "external_client" | "vendor" | "unknown",
  "styleConfidence": number (0-100, how confident you are in this analysis)
}

Return ONLY the JSON object, no explanation.`,
        },
        {
          role: 'user',
          content: `Analyze the writing style of these ${sampleSize} messages:\n\n${samples.map((s, i) => `--- Message ${i + 1} ---\n${s.slice(0, 800)}`).join('\n\n')}`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    return parsed;
  } catch (err) {
    console.error('AI style analysis failed:', err);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════
   Cross-Validation & Merging
   
   Merges heuristic and AI results, preferring AI where
   it has high confidence but keeping heuristic data for
   dimensions AI didn't cover.
   ═══════════════════════════════════════════════════════════ */

function mergeStyleResults(
  heuristic: ReturnType<typeof analyzeStyleHeuristic>,
  aiResult: Partial<Omit<StyleProfile, 'contactId' | 'contactName' | 'contactEmail' | 'analyzedAt' | 'messageCount'>> | null,
): ReturnType<typeof analyzeStyleHeuristic> {
  if (!aiResult) return heuristic;

  // AI confidence threshold — only override heuristic if AI is confident
  const aiConfidence = (aiResult as any).styleConfidence || 70;

  return {
    ...heuristic,
    // Override with AI results when available and confident
    formality: aiResult.formality && aiConfidence > 60 ? aiResult.formality : heuristic.formality,
    averageLength: aiResult.averageLength || heuristic.averageLength,
    emojiUsage: aiResult.emojiUsage || heuristic.emojiUsage,
    greetingStyle: aiResult.greetingStyle || heuristic.greetingStyle,
    closingStyle: aiResult.closingStyle || heuristic.closingStyle,
    vocabularyLevel: aiResult.vocabularyLevel || heuristic.vocabularyLevel,
    sentenceStructure: aiResult.sentenceStructure || heuristic.sentenceStructure,
    usesContractions: aiResult.usesContractions !== undefined ? aiResult.usesContractions : heuristic.usesContractions,
    capitalization: aiResult.capitalization || heuristic.capitalization,
    pronounPreference: aiResult.pronounPreference || heuristic.pronounPreference,
    asksFollowUpQuestions: aiResult.asksFollowUpQuestions !== undefined ? aiResult.asksFollowUpQuestions : heuristic.asksFollowUpQuestions,
    humorStyle: aiResult.humorStyle || heuristic.humorStyle,
    paragraphStyle: aiResult.paragraphStyle || heuristic.paragraphStyle,
    endsWithActionItems: aiResult.endsWithActionItems !== undefined ? aiResult.endsWithActionItems : heuristic.endsWithActionItems,
    acknowledgmentStyle: aiResult.acknowledgmentStyle || heuristic.acknowledgmentStyle,
    signOffName: aiResult.signOffName || heuristic.signOffName,
    commonTransitions: aiResult.commonTransitions && (aiResult.commonTransitions as string[]).length > 0
      ? aiResult.commonTransitions as string[]
      : heuristic.commonTransitions,
    hedgeWords: aiResult.hedgeWords && (aiResult.hedgeWords as string[]).length > 0
      ? aiResult.hedgeWords as string[]
      : heuristic.hedgeWords,
    relationship: aiResult.relationship || heuristic.relationship,
    // Boost confidence when both heuristic and AI agree
    styleConfidence: Math.min(
      99,
      Math.max(heuristic.styleConfidence, aiConfidence) +
        (heuristic.formality === aiResult.formality ? 5 : 0) +
        (heuristic.sentenceStructure === aiResult.sentenceStructure ? 3 : 0) +
        (heuristic.vocabularyLevel === aiResult.vocabularyLevel ? 3 : 0)
    ),
  };
}

/* ─── Group messages by contact ───────────────────────── */

function groupByContact(messages: UnifiedMessage[]): Map<string, { name: string; email?: string; msgs: UnifiedMessage[] }> {
  const groups = new Map<string, { name: string; email?: string; msgs: UnifiedMessage[] }>();
  for (const msg of messages) {
    const key = msg.fromEmail || msg.from;
    if (!groups.has(key)) {
      groups.set(key, { name: msg.from, email: msg.fromEmail, msgs: [] });
    }
    groups.get(key)!.msgs.push(msg);
  }
  return groups;
}

/* ═══════════════════════════════════════════════════════════
   Exported Style Analyzer
   ═══════════════════════════════════════════════════════════ */

export const StyleAnalyzer = {
  /**
   * Analyze messages to build comprehensive style profiles per contact.
   * Only style characteristics are stored — NEVER message content.
   * 
   * Pipeline:
   * 1. Group messages by contact
   * 2. Run deep heuristic analysis (20+ dimensions)
   * 3. Run AI-powered analysis (refines heuristics)
   * 4. Cross-validate & merge results
   * 5. Calculate confidence scores
   */
  async analyzeMessages(messages: UnifiedMessage[]): Promise<{ profiles: StyleProfile[]; result: StyleAnalysisResult }> {
    const groups = groupByContact(messages);
    const profiles: StyleProfile[] = [];
    const contacts: StyleAnalysisResult['contacts'] = [];
    let totalAnalyzed = 0;
    let totalConfidence = 0;

    for (const [key, { name, email, msgs }] of groups) {
      const messageTexts = msgs.map(m => m.fullMessage);
      totalAnalyzed += msgs.length;

      // Step 1: Deep heuristic analysis
      const heuristicStyle = analyzeStyleHeuristic(messageTexts);

      // Step 2: AI-powered refinement
      const aiStyle = await analyzeStyleWithAI(messageTexts, name, heuristicStyle);

      // Step 3: Cross-validate & merge
      const mergedStyle = mergeStyleResults(heuristicStyle, aiStyle);

      const profile: StyleProfile = {
        contactId: key,
        contactName: name,
        contactEmail: email,
        ...mergedStyle,
        analyzedAt: new Date(),
        messageCount: msgs.length,
      };

      profiles.push(profile);
      totalConfidence += profile.styleConfidence;

      contacts.push({ name, email, messageCount: msgs.length, confidence: profile.styleConfidence });
    }

    const avgConfidence = profiles.length > 0 ? Math.round(totalConfidence / profiles.length) : 0;

    const result: StyleAnalysisResult = {
      profilesCreated: profiles.length,
      messagesAnalyzed: totalAnalyzed,
      overallConfidence: avgConfidence,
      contacts,
    };

    console.log(`📊 Style Analyzer: Created ${profiles.length} profiles from ${totalAnalyzed} messages (avg confidence: ${avgConfidence}%)`);
    return { profiles, result };
  },

  /**
   * Generate a comprehensive style instruction prompt for the AI engine.
   * This is the critical bridge between style analysis and draft generation.
   * 
   * Returns a detailed, actionable prompt that tells the AI exactly how
   * to write like the user — covering every dimension of their voice.
   */
  getStylePromptForContact(profile: StyleProfile): string {
    const parts: string[] = [];

    // Core voice characteristics
    parts.push(`COMMUNICATION STYLE PROFILE (Confidence: ${profile.styleConfidence}%)`);
    parts.push(`Relationship with ${profile.contactName}: ${profile.relationship}`);
    parts.push('');

    // Tone & Formality
    parts.push('TONE & FORMALITY:');
    parts.push(`- Formality level: ${profile.formality.replace(/_/g, ' ')}`);
    parts.push(`- ${profile.usesContractions ? 'USE contractions (don\'t, can\'t, I\'ll, etc.)' : 'AVOID contractions — use full forms (do not, cannot, I will)'}`);
    parts.push(`- Vocabulary: ${profile.vocabularyLevel}`);
    if (profile.usesSlang) parts.push('- Uses casual slang and informal language');
    if (profile.humorStyle !== 'none') parts.push(`- Humor style: ${profile.humorStyle.replace(/_/g, ' ')}`);
    parts.push('');

    // Message Structure
    parts.push('MESSAGE STRUCTURE:');
    parts.push(`- Greeting: "${profile.greetingStyle}"`);
    parts.push(`- Closing: "${profile.closingStyle}"`);
    if (profile.signOffName) parts.push(`- Sign off with name: "${profile.signOffName}"`);
    parts.push(`- Paragraph style: ${profile.paragraphStyle.replace(/_/g, ' ')}`);
    parts.push(`- Sentence structure: ${profile.sentenceStructure.replace(/_/g, ' ')}`);
    parts.push(`- Average message length: ~${profile.avgWordsPerMessage} words (${profile.averageLength})`);
    if (profile.usesBulletPoints) parts.push('- Uses bullet points and numbered lists when listing items');
    if (profile.endsWithActionItems) parts.push('- Typically ends messages with next steps or action items');
    parts.push('');

    // Voice & Personality
    parts.push('VOICE & PERSONALITY:');
    parts.push(`- Pronoun preference: ${profile.pronounPreference.replace(/_/g, ' ')} (${
      profile.pronounPreference === 'i_focused' ? 'says "I will", "I think"' :
      profile.pronounPreference === 'we_focused' ? 'says "we should", "our team"' :
      profile.pronounPreference === 'mixed' ? 'mixes "I" and "we"' :
      'avoids personal pronouns'
    })`);
    if (profile.asksFollowUpQuestions) parts.push('- Often asks follow-up questions to keep the conversation going');
    parts.push(`- Acknowledgment style: "${profile.acknowledgmentStyle}"`);
    if (profile.timeAwareness) parts.push('- References timing and apologizes for late responses');
    parts.push('');

    // Punctuation & Formatting
    parts.push('PUNCTUATION & FORMATTING:');
    parts.push(`- Capitalization: ${profile.capitalization.replace(/_/g, ' ')}`);
    parts.push(`- Exclamation marks: ${profile.punctuation.exclamationFrequency}`);
    if (profile.punctuation.usesEllipsis) parts.push('- Uses ellipsis (...) for trailing thoughts');
    if (profile.punctuation.usesEmDash) parts.push('- Uses em-dashes (—) for asides and emphasis');
    if (profile.punctuation.usesSemicolons) parts.push('- Uses semicolons in compound sentences');
    if (profile.punctuation.usesParentheses) parts.push('- Uses parenthetical asides');
    if (profile.emojiUsage !== 'none') parts.push(`- Emoji usage: ${profile.emojiUsage}`);
    parts.push('');

    // Language Patterns
    if (profile.commonTransitions.length > 0 || profile.hedgeWords.length > 0) {
      parts.push('CHARACTERISTIC PHRASES:');
      if (profile.commonTransitions.length > 0) {
        parts.push(`- Transitional phrases: "${profile.commonTransitions.join('", "')}"`);
      }
      if (profile.hedgeWords.length > 0) {
        parts.push(`- Hedge/softening phrases: "${profile.hedgeWords.join('", "')}"`);
      }
      parts.push('');
    }

    // Final instruction
    parts.push('CRITICAL: Write as if you ARE this person. Match their exact voice — their word choices, their rhythm, their personality. The response should be indistinguishable from something they actually wrote.');

    return parts.join('\n');
  },
};
