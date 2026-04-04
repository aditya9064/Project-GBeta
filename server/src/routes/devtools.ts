/* ═══════════════════════════════════════════════════════════
   DevTools Routes — REST endpoints for developer features

   /api/devtools/codebase/*     — Codebase analysis & exploration
   /api/devtools/intelligence/* — Code intelligence (diagnostics, definitions)
   /api/devtools/tests/*        — Test runner & iterative loops
   /api/devtools/git/*          — Git workflow automation
   /api/devtools/subagents/*    — Sub-agent delegation
   /api/devtools/context/*      — Persistent project context
   /api/devtools/hooks/*        — Hook system
   /api/devtools/plugins/*      — Plugin ecosystem
   /api/devtools/search/*       — Code search at scale
   /api/devtools/shell/*        — Shell execution
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import {
  analyzeCodebase, readFileContent, explainCodebase,
  runDiagnostics, findDefinition, findReferences,
  detectTestFramework, runTests, startIterativeLoop, getLoopStatus, stopIterativeLoop,
  getGitStatus, gitLog, gitDiff, gitCommit, gitBranch, gitStash,
  createSubAgent, getSubAgents, getSubAgent, updateSubAgent, cancelSubAgent,
  getProjectContext, setProjectContext, generateProjectContext,
  createHook, getHooks, updateHook, deleteHook, triggerHooks,
  installPlugin, getPlugins, getPlugin, togglePlugin, uninstallPlugin, getBuiltinPlugins,
  searchCode, searchFiles,
  executeShell, executeShellAsync, getShellSession, getShellSessions, killShellSession,
} from '../services/devToolsService.js';
import { logger } from '../services/logger.js';

const router = Router();

/* ═══════════════════════════════════════════════════════════
   Feature 1: Codebase Analysis & Exploration
   ═══════════════════════════════════════════════════════════ */

router.post('/codebase/analyze', async (req: Request, res: Response) => {
  try {
    const { rootPath } = req.body;
    if (!rootPath) { res.status(400).json({ success: false, error: 'rootPath required' }); return; }
    const analysis = analyzeCodebase(rootPath);
    res.json({ success: true, data: analysis });
  } catch (err: any) {
    logger.error('[DevTools] Codebase analysis failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/codebase/explain', async (req: Request, res: Response) => {
  try {
    const { rootPath } = req.body;
    if (!rootPath) { res.status(400).json({ success: false, error: 'rootPath required' }); return; }
    const explanation = await explainCodebase(rootPath);
    res.json({ success: true, data: { explanation } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/codebase/read-file', (req: Request, res: Response) => {
  try {
    const { filePath, startLine, endLine } = req.body;
    if (!filePath) { res.status(400).json({ success: false, error: 'filePath required' }); return; }
    const result = readFileContent(filePath, startLine, endLine);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════
   Feature 2: Code Intelligence
   ═══════════════════════════════════════════════════════════ */

router.post('/intelligence/diagnostics', (req: Request, res: Response) => {
  try {
    const { rootPath, files } = req.body;
    if (!rootPath) { res.status(400).json({ success: false, error: 'rootPath required' }); return; }
    const diagnostics = runDiagnostics(rootPath, files);
    res.json({ success: true, data: { diagnostics, total: diagnostics.length } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/intelligence/definition', (req: Request, res: Response) => {
  try {
    const { rootPath, symbol } = req.body;
    if (!rootPath || !symbol) { res.status(400).json({ success: false, error: 'rootPath and symbol required' }); return; }
    const results = findDefinition(rootPath, symbol);
    res.json({ success: true, data: { results, total: results.length } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/intelligence/references', (req: Request, res: Response) => {
  try {
    const { rootPath, symbol } = req.body;
    if (!rootPath || !symbol) { res.status(400).json({ success: false, error: 'rootPath and symbol required' }); return; }
    const results = findReferences(rootPath, symbol);
    res.json({ success: true, data: { results, total: results.length } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════
   Feature 3: Test Runner & Iterative Loops
   ═══════════════════════════════════════════════════════════ */

router.post('/tests/detect', (req: Request, res: Response) => {
  try {
    const { rootPath } = req.body;
    const framework = detectTestFramework(rootPath);
    res.json({ success: true, data: framework });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/tests/run', (req: Request, res: Response) => {
  try {
    const { rootPath, testFile, testName } = req.body;
    if (!rootPath) { res.status(400).json({ success: false, error: 'rootPath required' }); return; }
    const result = runTests(rootPath, testFile, testName);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/tests/iterative/start', (req: Request, res: Response) => {
  try {
    const { rootPath, testFile, maxIterations = 10 } = req.body;
    const id = `loop-${Date.now()}`;
    const result = startIterativeLoop(id, rootPath, testFile, maxIterations);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/tests/iterative/:id', (req: Request, res: Response) => {
  const status = getLoopStatus(req.params.id);
  if (!status) { res.status(404).json({ success: false, error: 'Loop not found' }); return; }
  res.json({ success: true, data: status });
});

router.post('/tests/iterative/:id/stop', (req: Request, res: Response) => {
  const stopped = stopIterativeLoop(req.params.id);
  res.json({ success: stopped, data: stopped ? 'Loop stopped' : 'Loop not found' });
});

/* ═══════════════════════════════════════════════════════════
   Feature 4: Git Workflow Automation
   ═══════════════════════════════════════════════════════════ */

router.post('/git/status', (req: Request, res: Response) => {
  try {
    const { rootPath } = req.body;
    if (!rootPath) { res.status(400).json({ success: false, error: 'rootPath required' }); return; }
    const status = getGitStatus(rootPath);
    res.json({ success: true, data: status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/git/log', (req: Request, res: Response) => {
  try {
    const { rootPath, count } = req.body;
    if (!rootPath) { res.status(400).json({ success: false, error: 'rootPath required' }); return; }
    const commits = gitLog(rootPath, count);
    res.json({ success: true, data: commits });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/git/diff', (req: Request, res: Response) => {
  try {
    const { rootPath, staged, file } = req.body;
    if (!rootPath) { res.status(400).json({ success: false, error: 'rootPath required' }); return; }
    const diff = gitDiff(rootPath, staged, file);
    res.json({ success: true, data: { diff } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/git/commit', (req: Request, res: Response) => {
  try {
    const { rootPath, message, files } = req.body;
    if (!rootPath || !message) { res.status(400).json({ success: false, error: 'rootPath and message required' }); return; }
    const result = gitCommit(rootPath, message, files);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/git/branch', (req: Request, res: Response) => {
  try {
    const { rootPath, action, branchName } = req.body;
    if (!rootPath || !action) { res.status(400).json({ success: false, error: 'rootPath and action required' }); return; }
    const result = gitBranch(rootPath, action, branchName);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/git/stash', (req: Request, res: Response) => {
  try {
    const { rootPath, action, message } = req.body;
    if (!rootPath || !action) { res.status(400).json({ success: false, error: 'rootPath and action required' }); return; }
    const result = gitStash(rootPath, action, message);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════
   Feature 5: Sub-Agent Delegation
   ═══════════════════════════════════════════════════════════ */

router.post('/subagents/create', (req: Request, res: Response) => {
  try {
    const { parentId, goal } = req.body;
    if (!goal) { res.status(400).json({ success: false, error: 'goal required' }); return; }
    const agent = createSubAgent(parentId || 'root', goal);
    res.json({ success: true, data: agent });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/subagents', (req: Request, res: Response) => {
  const parentId = req.query.parentId as string | undefined;
  const agents = getSubAgents(parentId);
  res.json({ success: true, data: agents });
});

router.get('/subagents/:id', (req: Request, res: Response) => {
  const agent = getSubAgent(req.params.id);
  if (!agent) { res.status(404).json({ success: false, error: 'Sub-agent not found' }); return; }
  res.json({ success: true, data: agent });
});

router.patch('/subagents/:id', (req: Request, res: Response) => {
  const agent = updateSubAgent(req.params.id, req.body);
  if (!agent) { res.status(404).json({ success: false, error: 'Sub-agent not found' }); return; }
  res.json({ success: true, data: agent });
});

router.post('/subagents/:id/cancel', (req: Request, res: Response) => {
  const cancelled = cancelSubAgent(req.params.id);
  res.json({ success: cancelled });
});

/* ═══════════════════════════════════════════════════════════
   Feature 6: Persistent Project Context
   ═══════════════════════════════════════════════════════════ */

router.post('/context/get', (req: Request, res: Response) => {
  try {
    const { projectPath } = req.body;
    if (!projectPath) { res.status(400).json({ success: false, error: 'projectPath required' }); return; }
    const context = getProjectContext(projectPath);
    res.json({ success: true, data: context });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/context/set', (req: Request, res: Response) => {
  try {
    const { projectPath, content, fileName } = req.body;
    if (!projectPath || !content) { res.status(400).json({ success: false, error: 'projectPath and content required' }); return; }
    const result = setProjectContext(projectPath, content, fileName);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/context/generate', (req: Request, res: Response) => {
  try {
    const { projectPath } = req.body;
    if (!projectPath) { res.status(400).json({ success: false, error: 'projectPath required' }); return; }
    const context = generateProjectContext(projectPath);
    res.json({ success: true, data: { context } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════
   Feature 7: Hook System
   ═══════════════════════════════════════════════════════════ */

router.post('/hooks', (req: Request, res: Response) => {
  try {
    const hook = createHook(req.body);
    res.json({ success: true, data: hook });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/hooks', (req: Request, res: Response) => {
  const event = req.query.event as string | undefined;
  const hooks = getHooks(event);
  res.json({ success: true, data: hooks });
});

router.patch('/hooks/:id', (req: Request, res: Response) => {
  const hook = updateHook(req.params.id, req.body);
  if (!hook) { res.status(404).json({ success: false, error: 'Hook not found' }); return; }
  res.json({ success: true, data: hook });
});

router.delete('/hooks/:id', (req: Request, res: Response) => {
  const deleted = deleteHook(req.params.id);
  res.json({ success: deleted });
});

router.post('/hooks/trigger', async (req: Request, res: Response) => {
  try {
    const { event, context } = req.body;
    if (!event) { res.status(400).json({ success: false, error: 'event required' }); return; }
    const results = await triggerHooks(event, context || {});
    res.json({ success: true, data: results });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════
   Feature 8: Plugin Ecosystem
   ═══════════════════════════════════════════════════════════ */

router.post('/plugins/install', (req: Request, res: Response) => {
  try {
    const plugin = installPlugin(req.body);
    res.json({ success: true, data: plugin });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/plugins', (req: Request, res: Response) => {
  const type = req.query.type as string | undefined;
  const plugins = getPlugins(type);
  res.json({ success: true, data: plugins });
});

router.get('/plugins/builtin', (_req: Request, res: Response) => {
  res.json({ success: true, data: getBuiltinPlugins() });
});

router.get('/plugins/:id', (req: Request, res: Response) => {
  const plugin = getPlugin(req.params.id);
  if (!plugin) { res.status(404).json({ success: false, error: 'Plugin not found' }); return; }
  res.json({ success: true, data: plugin });
});

router.patch('/plugins/:id/toggle', (req: Request, res: Response) => {
  const { enabled } = req.body;
  const plugin = togglePlugin(req.params.id, enabled);
  if (!plugin) { res.status(404).json({ success: false, error: 'Plugin not found' }); return; }
  res.json({ success: true, data: plugin });
});

router.delete('/plugins/:id', (req: Request, res: Response) => {
  const deleted = uninstallPlugin(req.params.id);
  res.json({ success: deleted });
});

/* ═══════════════════════════════════════════════════════════
   Feature 9: Code Search at Scale
   ═══════════════════════════════════════════════════════════ */

router.post('/search/code', (req: Request, res: Response) => {
  try {
    const { rootPath, query, regex, caseSensitive, fileGlob, maxResults, contextLines } = req.body;
    if (!rootPath || !query) { res.status(400).json({ success: false, error: 'rootPath and query required' }); return; }
    const results = searchCode(rootPath, query, { regex, caseSensitive, fileGlob, maxResults, contextLines });
    res.json({ success: true, data: { results, total: results.length } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/search/files', (req: Request, res: Response) => {
  try {
    const { rootPath, pattern } = req.body;
    if (!rootPath || !pattern) { res.status(400).json({ success: false, error: 'rootPath and pattern required' }); return; }
    const files = searchFiles(rootPath, pattern);
    res.json({ success: true, data: { files, total: files.length } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════
   Feature 10: Shell Execution
   ═══════════════════════════════════════════════════════════ */

router.post('/shell/execute', (req: Request, res: Response) => {
  try {
    const { command, cwd, async: isAsync } = req.body;
    if (!command) { res.status(400).json({ success: false, error: 'command required' }); return; }
    const workDir = cwd || process.cwd();
    const session = isAsync ? executeShellAsync(command, workDir) : executeShell(command, workDir);
    res.json({ success: true, data: session });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/shell/sessions', (_req: Request, res: Response) => {
  const sessions = getShellSessions();
  res.json({ success: true, data: sessions });
});

router.get('/shell/:id', (req: Request, res: Response) => {
  const session = getShellSession(req.params.id);
  if (!session) { res.status(404).json({ success: false, error: 'Session not found' }); return; }
  res.json({ success: true, data: session });
});

router.post('/shell/:id/kill', (req: Request, res: Response) => {
  const killed = killShellSession(req.params.id);
  res.json({ success: killed });
});

export { router as devtoolsRouter };
