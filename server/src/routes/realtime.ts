/* ═══════════════════════════════════════════════════════════
   Realtime API Proxy — Session creation for voice assistant
   
   Uses the OpenAI Realtime API unified interface:
   1. Browser creates WebRTC offer and POSTs SDP here
   2. This server forwards SDP + session config to OpenAI
   3. Returns OpenAI's SDP answer back to the browser
   
   The API key stays server-side; the browser never sees it.
   ═══════════════════════════════════════════════════════════ */

import { Router } from 'express';
import { config } from '../config.js';

export const realtimeRouter = Router();

realtimeRouter.post('/session', async (req, res) => {
  const apiKey = config.openai.apiKey;
  if (!apiKey) {
    res.status(500).json({ error: 'OpenAI API key not configured' });
    return;
  }

  try {
    const clientSdp = typeof req.body === 'string'
      ? req.body
      : req.body?.sdp || '';

    if (!clientSdp) {
      res.status(400).json({ error: 'Missing SDP offer in request body' });
      return;
    }

    const sessionConfig = JSON.stringify({
      type: 'realtime',
      model: 'gpt-realtime',
      audio: {
        output: { voice: 'alloy' },
      },
    });

    const fd = new FormData();
    fd.set('sdp', clientSdp);
    fd.set('session', sessionConfig);

    const openaiResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: fd,
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI Realtime API error:', openaiResponse.status, errorText);
      res.status(openaiResponse.status).send(errorText);
      return;
    }

    const answerSdp = await openaiResponse.text();
    res.type('application/sdp').send(answerSdp);
  } catch (error) {
    console.error('Realtime session creation error:', error);
    res.status(500).json({
      error: 'Failed to create realtime session',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
