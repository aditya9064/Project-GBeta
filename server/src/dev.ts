/* ═══════════════════════════════════════════════════════════
   Local Development Server
   
   Run with: npm run dev (in server/)
   This starts a standalone Express server for local development.
   NOT used in Firebase Functions runtime.
   ═══════════════════════════════════════════════════════════ */

import { app } from './app.js';
import { config } from './config.js';

app.listen(config.port, '0.0.0.0', () => {
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
  console.log(`   └─ GET  /api/health\n`);
});


