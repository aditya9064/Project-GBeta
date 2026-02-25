/* ═══════════════════════════════════════════════════════════
   n8n Proxy Routes — Relays requests to the self-hosted n8n
   
   The frontend never talks to n8n directly. All communication
   goes through our Express server, which adds the API key and
   handles error formatting.
   
   GET  /api/n8n/status               — Check n8n connectivity
   POST /api/n8n/workflows            — Push a workflow to n8n
   GET  /api/n8n/workflows/:id        — Get workflow details
   POST /api/n8n/workflows/:id/activate   — Activate a workflow
   POST /api/n8n/workflows/:id/deactivate — Deactivate a workflow
   POST /api/n8n/workflows/:id/run    — Execute a workflow
   GET  /api/n8n/executions/:id       — Get execution result
   GET  /api/n8n/credentials/schemas  — List available credential types
   GET  /api/n8n/editor-url/:id       — Get the n8n editor URL
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';

const router = Router();

/* ─── Helpers ─────────────────────────────────────────── */

function getN8nBaseUrl(): string {
  return process.env.N8N_BASE_URL || 'http://localhost:5678';
}

function getN8nApiKey(): string {
  return process.env.N8N_API_KEY || '';
}

async function n8nFetch(path: string, options: RequestInit = {}): Promise<any> {
  const apiKey = getN8nApiKey();
  const baseUrl = getN8nBaseUrl();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (apiKey) {
    headers['X-N8N-API-KEY'] = apiKey;
  }

  const url = `${baseUrl}${path}`;
  console.log(`[n8n API] ${options.method || 'GET'} ${url}`);

  const resp = await fetch(url, {
    ...options,
    headers,
  });

  if (!resp.ok) {
    const errorText = await resp.text().catch(() => 'Unknown error');
    throw new Error(`n8n API error (${resp.status}): ${errorText}`);
  }

  return resp.json();
}

/* ─── GET /api/n8n/status ─────────────────────────────── */
/** Check if n8n is running and accessible */

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const baseUrl = getN8nBaseUrl();
    const apiKey = getN8nApiKey();

    // Try to hit the n8n health endpoint
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const healthResp = await fetch(`${baseUrl}/healthz`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (healthResp.ok) {
        // Also check API key by listing workflows
        let apiKeyValid = false;
        let workflowCount = 0;

        if (apiKey) {
          try {
            const wfResp = await n8nFetch('/api/v1/workflows?limit=0');
            apiKeyValid = true;
            workflowCount = wfResp.count ?? wfResp.data?.length ?? 0;
          } catch {
            apiKeyValid = false;
          }
        }

        res.json({
          success: true,
          data: {
            connected: true,
            baseUrl,
            apiKeyConfigured: !!apiKey,
            apiKeyValid,
            workflowCount,
            editorUrl: baseUrl,
          },
        });
        return;
      }
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        // Timeout
      }
    }

    res.json({
      success: true,
      data: {
        connected: false,
        baseUrl,
        apiKeyConfigured: !!apiKey,
        apiKeyValid: false,
        workflowCount: 0,
        editorUrl: baseUrl,
        hint: 'Run "docker compose up -d" to start n8n',
      },
    });
  } catch (err) {
    console.error('[n8n] Status check error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to check n8n status',
    });
  }
});

/* ─── POST /api/n8n/workflows ─────────────────────────── */
/** Create or import a workflow into n8n */

router.post('/workflows', async (req: Request, res: Response) => {
  try {
    const n8nWorkflow = req.body;

    if (!n8nWorkflow || !n8nWorkflow.nodes) {
      res.status(400).json({ success: false, error: 'Invalid workflow: missing nodes' });
      return;
    }

    // Clean up the workflow for n8n API
    const payload = {
      name: n8nWorkflow.name || 'Imported Workflow',
      nodes: n8nWorkflow.nodes,
      connections: n8nWorkflow.connections || {},
      settings: n8nWorkflow.settings || { executionOrder: 'v1' },
      staticData: n8nWorkflow.staticData || null,
    };

    const result = await n8nFetch('/api/v1/workflows', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    res.json({
      success: true,
      data: {
        id: result.id,
        name: result.name,
        active: result.active,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        editorUrl: `${getN8nBaseUrl()}/workflow/${result.id}`,
      },
    });
  } catch (err) {
    console.error('[n8n] Create workflow error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create workflow in n8n',
    });
  }
});

/* ─── GET /api/n8n/workflows/:id ──────────────────────── */
/** Get workflow details from n8n */

router.get('/workflows/:id', async (req: Request, res: Response) => {
  try {
    const result = await n8nFetch(`/api/v1/workflows/${req.params.id}`);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[n8n] Get workflow error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get workflow from n8n',
    });
  }
});

/* ─── POST /api/n8n/workflows/:id/activate ────────────── */
/** Activate a workflow in n8n (enables triggers) */

router.post('/workflows/:id/activate', async (req: Request, res: Response) => {
  try {
    const result = await n8nFetch(`/api/v1/workflows/${req.params.id}/activate`, {
      method: 'POST',
    });
    res.json({
      success: true,
      data: { id: result.id, active: result.active },
    });
  } catch (err) {
    console.error('[n8n] Activate workflow error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to activate workflow',
    });
  }
});

/* ─── POST /api/n8n/workflows/:id/deactivate ──────────── */
/** Deactivate a workflow in n8n (disables triggers) */

router.post('/workflows/:id/deactivate', async (req: Request, res: Response) => {
  try {
    const result = await n8nFetch(`/api/v1/workflows/${req.params.id}/deactivate`, {
      method: 'POST',
    });
    res.json({
      success: true,
      data: { id: result.id, active: result.active },
    });
  } catch (err) {
    console.error('[n8n] Deactivate workflow error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to deactivate workflow',
    });
  }
});

/* ─── POST /api/n8n/workflows/:id/run ─────────────────── */
/** Execute a workflow in n8n and return results */

router.post('/workflows/:id/run', async (req: Request, res: Response) => {
  try {
    const workflowId = req.params.id;
    const triggerData = req.body.data || {};

    // n8n's test execution endpoint (works for manual trigger workflows)
    // This uses the internal API that the n8n editor uses for "Execute Workflow"
    const baseUrl = getN8nBaseUrl();
    const apiKey = getN8nApiKey();

    // First, get the workflow to understand its structure
    const workflow = await n8nFetch(`/api/v1/workflows/${workflowId}`);

    // Try the public API run endpoint first (n8n >= 1.50)
    try {
      const result = await n8nFetch(`/api/v1/workflows/${workflowId}/run`, {
        method: 'POST',
        body: JSON.stringify({ data: triggerData }),
      });

      res.json({
        success: true,
        data: {
          executionId: result.data?.id || result.id,
          status: result.data?.status || result.status || 'running',
          finished: result.data?.finished ?? result.finished ?? false,
          data: result.data?.data || result.data || null,
          workflowId,
          workflowName: workflow.name,
          startedAt: result.data?.startedAt || new Date().toISOString(),
          stoppedAt: result.data?.stoppedAt || null,
        },
      });
      return;
    } catch (runErr) {
      console.log('[n8n] Public run API not available, trying webhook approach');
    }

    // Fallback: Check if workflow has a webhook trigger and call it
    const webhookNode = workflow.nodes?.find((n: any) =>
      n.type === 'n8n-nodes-base.webhook' || n.type === 'n8n-nodes-base.formTrigger'
    );

    if (webhookNode && webhookNode.webhookId) {
      const webhookPath = webhookNode.parameters?.path || webhookNode.webhookId;
      const webhookUrl = `${baseUrl}/webhook/${webhookPath}`;

      const webhookResp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(triggerData),
      });

      const webhookResult = await webhookResp.json().catch(() => ({}));

      res.json({
        success: true,
        data: {
          executionId: 'webhook-triggered',
          status: webhookResp.ok ? 'success' : 'error',
          finished: true,
          data: webhookResult,
          workflowId,
          workflowName: workflow.name,
          triggeredVia: 'webhook',
          startedAt: new Date().toISOString(),
          stoppedAt: new Date().toISOString(),
        },
      });
      return;
    }

    // Fallback: Use the n8n internal execute endpoint
    // This mimics what the n8n editor does when you click "Execute Workflow"
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) headers['X-N8N-API-KEY'] = apiKey;

    // Get a cookie/session for the internal API
    const executeResp = await fetch(`${baseUrl}/rest/workflows/${workflowId}/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        startNodes: [],
        runData: {},
        destinationNode: '',
      }),
    });

    if (executeResp.ok) {
      const executeResult = await executeResp.json();
      res.json({
        success: true,
        data: {
          executionId: executeResult.data?.executionId || 'internal',
          status: 'success',
          finished: true,
          data: executeResult.data,
          workflowId,
          workflowName: workflow.name,
          triggeredVia: 'internal-api',
          startedAt: new Date().toISOString(),
          stoppedAt: new Date().toISOString(),
        },
      });
      return;
    }

    // If all approaches fail, return an informative error
    res.status(422).json({
      success: false,
      error: 'Could not execute workflow. Make sure credentials are configured in n8n.',
      hint: `Open ${getN8nBaseUrl()}/workflow/${workflowId} to configure and test the workflow in n8n.`,
      editorUrl: `${getN8nBaseUrl()}/workflow/${workflowId}`,
    });

  } catch (err) {
    console.error('[n8n] Execute workflow error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to execute workflow',
    });
  }
});

/* ─── GET /api/n8n/executions/:id ─────────────────────── */
/** Get execution details/results from n8n */

router.get('/executions/:id', async (req: Request, res: Response) => {
  try {
    const result = await n8nFetch(`/api/v1/executions/${req.params.id}`);
    res.json({
      success: true,
      data: {
        id: result.id,
        finished: result.finished,
        status: result.status || (result.finished ? 'success' : 'running'),
        mode: result.mode,
        startedAt: result.startedAt,
        stoppedAt: result.stoppedAt,
        workflowId: result.workflowId,
        data: result.data,
      },
    });
  } catch (err) {
    console.error('[n8n] Get execution error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get execution',
    });
  }
});

/* ─── GET /api/n8n/editor-url/:id ─────────────────────── */
/** Returns the n8n editor URL for a given workflow */

router.get('/editor-url/:id', (_req: Request, res: Response) => {
  const editorUrl = `${getN8nBaseUrl()}/workflow/${_req.params.id}`;
  res.json({ success: true, data: { editorUrl } });
});

export { router as n8nRouter };


