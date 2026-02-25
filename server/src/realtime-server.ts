import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

app.use(cors({ origin: true, credentials: true }));
app.use(express.text({ type: ['application/sdp', 'text/plain'] }));
app.use(express.json());

app.post('/api/realtime/session', async (req, res) => {
  if (!OPENAI_API_KEY) {
    res.status(500).json({ error: 'OPENAI_API_KEY not set' });
    return;
  }

  try {
    const clientSdp = typeof req.body === 'string' ? req.body : req.body?.sdp || '';
    if (!clientSdp) {
      res.status(400).json({ error: 'Missing SDP offer' });
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
      res.status(openaiRes.status).send(errText);
      return;
    }

    const answerSdp = await openaiRes.text();
    res.type('application/sdp').send(answerSdp);
  } catch (err) {
    console.error('Session error:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', openai: OPENAI_API_KEY ? 'configured' : 'missing' });
});

app.listen(PORT, () => {
  console.log(`\n  Realtime voice server running on http://localhost:${PORT}`);
  console.log(`  OpenAI: ${OPENAI_API_KEY ? 'configured' : 'MISSING — set OPENAI_API_KEY in .env'}\n`);
});
