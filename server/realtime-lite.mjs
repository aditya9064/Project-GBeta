import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually
try {
  const envFile = readFileSync(join(__dirname, '.env'), 'utf-8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const PORT = 3001;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

function parseBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
  });
}

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.url === '/api/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', openai: OPENAI_API_KEY ? 'configured' : 'missing' }));
    return;
  }

  if (req.url === '/api/realtime/session' && req.method === 'POST') {
    if (!OPENAI_API_KEY) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'OPENAI_API_KEY not set' }));
      return;
    }

    try {
      const body = await parseBody(req);
      let clientSdp = body;
      try { const parsed = JSON.parse(body); clientSdp = parsed.sdp || body; } catch {}

      if (!clientSdp) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing SDP offer' }));
        return;
      }

      const sessionConfig = JSON.stringify({
        type: 'realtime',
        model: 'gpt-4o-mini-realtime-preview',
        audio: { output: { voice: 'alloy' } },
      });

      const fd = new FormData();
      fd.set('sdp', clientSdp);
      fd.set('session', sessionConfig);

      const openaiRes = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: fd,
      });

      if (!openaiRes.ok) {
        const errText = await openaiRes.text();
        console.error('OpenAI error:', openaiRes.status, errText);
        res.writeHead(openaiRes.status, { 'Content-Type': 'text/plain' });
        res.end(errText);
        return;
      }

      const answerSdp = await openaiRes.text();
      res.writeHead(200, { 'Content-Type': 'application/sdp' });
      res.end(answerSdp);
    } catch (err) {
      console.error('Session error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to create session' }));
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n  Realtime voice server running on http://localhost:${PORT}`);
  console.log(`  OpenAI: ${OPENAI_API_KEY ? 'configured' : 'MISSING — set OPENAI_API_KEY in .env'}\n`);
});
