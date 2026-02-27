/* ═══════════════════════════════════════════════════════════
   Local Development Server
   
   Run with: npm run dev (in server/)
   This starts a standalone Express server for local development.
   NOT used in Firebase Functions runtime.
   ═══════════════════════════════════════════════════════════ */

import { app } from './app.js';
import { config } from './config.js';
import { runScheduledTick } from './services/agentScheduler.js';
import { GmailService } from './services/gmail.service.js';

// Scheduler state
let schedulerInterval: NodeJS.Timeout | null = null;
let schedulerRunning = false;
const POLL_INTERVAL_MS = 30000; // Poll every 30 seconds

async function startScheduler(): Promise<void> {
  if (schedulerInterval) return;
  
  console.log(`\n⏰ Starting email scheduler (polling every ${POLL_INTERVAL_MS / 1000}s)...`);
  
  // Initial run after a short delay to let services initialize
  setTimeout(async () => {
    await runSchedulerTick();
  }, 5000);
  
  // Then run on interval
  schedulerInterval = setInterval(async () => {
    await runSchedulerTick();
  }, POLL_INTERVAL_MS);
}

async function runSchedulerTick(): Promise<void> {
  if (schedulerRunning) {
    console.log('⏰ Scheduler: Previous tick still running, skipping...');
    return;
  }
  
  schedulerRunning = true;
  try {
    const result = await runScheduledTick();
    if (result.newEmails > 0 || result.agentsTriggered > 0 || result.scheduledRuns > 0) {
      console.log(`⏰ Scheduler tick: ${result.emailsChecked} emails checked, ${result.newEmails} new, ${result.agentsTriggered} agents triggered, ${result.scheduledRuns} scheduled runs`);
    }
    if (result.errors.length > 0) {
      console.error('⏰ Scheduler errors:', result.errors);
    }
  } catch (err: any) {
    console.error('⏰ Scheduler tick failed:', err.message);
  } finally {
    schedulerRunning = false;
  }
}

// Add scheduler API endpoints
app.get('/api/scheduler/status', (_req, res) => {
  res.json({
    success: true,
    data: {
      running: !!schedulerInterval,
      pollIntervalMs: POLL_INTERVAL_MS,
    },
  });
});

app.post('/api/scheduler/trigger', async (_req, res) => {
  try {
    console.log('⏰ Manual scheduler trigger requested');
    const result = await runScheduledTick();
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/scheduler/start', (_req, res) => {
  startScheduler();
  res.json({ success: true, message: 'Scheduler started' });
});

app.post('/api/scheduler/stop', (_req, res) => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('⏰ Scheduler stopped');
  }
  res.json({ success: true, message: 'Scheduler stopped' });
});

app.listen(config.port, '0.0.0.0', async () => {
  console.log(`\n🚀 Communications AI Agent Server (local dev)`);
  console.log(`   Running on http://localhost:${config.port}`);
  console.log(`   Frontend:  ${config.frontendUrl}\n`);
  console.log(`   Services:`);
  console.log(`   ├─ AI Engine:  ${config.openai.apiKey ? '✅ Ready' : '⚠️  Set OPENAI_API_KEY'}`);
  console.log(`   ├─ Gmail:     ${config.google.clientId ? '✅ Ready' : '⚠️  Set GOOGLE_CLIENT_ID'}`);
  console.log(`   ├─ Slack:     ${config.slack.botToken ? '✅ Ready' : '⚠️  Set SLACK_BOT_TOKEN'}`);
  console.log(`   ├─ Teams:     ${config.microsoft.clientId ? '✅ Ready' : '⚠️  Set MS_CLIENT_ID'}`);
  console.log(`   ├─ n8n:       ${config.n8n.apiKey ? '✅ Ready' : '⚠️  Set N8N_API_KEY'} (${config.n8n.baseUrl})`);
  console.log(`   └─ Browser:   ✅ Puppeteer (headful Chrome)`);
  console.log(`\n   API routes:`);
  console.log(`   ├─ GET  /api/messages`);
  console.log(`   ├─ POST /api/messages/:id/draft`);
  console.log(`   ├─ POST /api/messages/:id/send`);
  console.log(`   ├─ POST /api/messages/sync`);
  console.log(`   ├─ POST /api/messages/draft-all`);
  console.log(`   ├─ GET  /api/connections`);
  console.log(`   ├─ POST /api/ai/analyze`);
  console.log(`   ├─ POST /api/ai/generate`);
  console.log(`   ├─ GET  /api/n8n/status`);
  console.log(`   ├─ POST /api/n8n/workflows`);
  console.log(`   ├─ POST /api/n8n/workflows/:id/run`);
  console.log(`   ├─ POST /api/browser/session`);
  console.log(`   ├─ POST /api/browser/action`);
  console.log(`   ├─ GET  /api/browser/sessions`);
  console.log(`   ├─ GET  /api/browser/status`);
  console.log(`   ├─ GET  /api/scheduler/status`);
  console.log(`   ├─ POST /api/scheduler/trigger`);
  console.log(`   ├─ POST /api/scheduler/start`);
  console.log(`   ├─ POST /api/scheduler/stop`);
  console.log(`   └─ GET  /api/health\n`);
  
  // Restore Gmail connection and start scheduler
  try {
    await GmailService.restoreFromStore();
    const conn = GmailService.getConnection();
    if (conn.status === 'connected') {
      console.log(`   📧 Gmail connected: ${conn.accountEmail}`);
      // Start the scheduler automatically if Gmail is connected
      startScheduler();
    } else {
      console.log(`   📧 Gmail not connected - connect via /api/connections/gmail to enable email triggers`);
    }
  } catch (err) {
    console.log('   📧 Gmail restore failed - scheduler will not auto-start');
  }
});


