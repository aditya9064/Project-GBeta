/* ═══════════════════════════════════════════════════════════
   DevTools Service — Backend engine for all developer-focused
   features: codebase analysis, code intelligence, test loops,
   git automation, sub-agents, project context, hooks, plugins,
   code search, and shell execution.
   ═══════════════════════════════════════════════════════════ */

import { execSync, spawn, ChildProcess } from 'child_process';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, relative, extname, basename, dirname } from 'path';
import { logger } from './logger.js';
import { AIEngine } from './ai-engine.js';

/* ─── Types ─────────────────────────────────────────────── */

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  extension?: string;
  children?: FileNode[];
  language?: string;
}

export interface CodebaseAnalysis {
  rootPath: string;
  totalFiles: number;
  totalDirectories: number;
  totalLines: number;
  languages: Record<string, { files: number; lines: number }>;
  tree: FileNode[];
  summary: string;
  entryPoints: string[];
  dependencies: Record<string, string>;
}

export interface DiagnosticItem {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  source?: string;
  code?: string;
}

export interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration?: number;
  error?: string;
  file?: string;
}

export interface TestRunResult {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  results: TestResult[];
  output: string;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  modified: string[];
  untracked: string[];
  conflicts: string[];
  clean: boolean;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
}

export interface SubAgentState {
  id: string;
  goal: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  result?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
  parentId?: string;
  isolatedContext: Record<string, any>;
}

export interface HookDefinition {
  id: string;
  name: string;
  event: 'pre_tool_use' | 'post_tool_use' | 'pre_execution' | 'post_execution' | 'on_error' | 'on_approval' | 'on_schedule';
  script: string;
  enabled: boolean;
  matcher?: string;
  createdAt: string;
  lastTriggered?: string;
  triggerCount: number;
}

export interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  type: 'tools' | 'hooks' | 'mcp' | 'theme' | 'workflow';
  entryPoint: string;
  config: Record<string, any>;
  enabled: boolean;
  installedAt: string;
  tools?: string[];
  hooks?: string[];
}

export interface SearchResult {
  file: string;
  line: number;
  column: number;
  content: string;
  matchLength: number;
  context?: { before: string; after: string };
}

export interface ShellSession {
  id: string;
  command: string;
  output: string;
  exitCode: number | null;
  status: 'running' | 'completed' | 'failed' | 'killed';
  startedAt: string;
  completedAt?: string;
  cwd: string;
  pid?: number;
}

/* ─── Extension → Language mapping ──────────────────────── */

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript',
  '.py': 'Python', '.rb': 'Ruby', '.go': 'Go', '.rs': 'Rust', '.java': 'Java',
  '.cpp': 'C++', '.c': 'C', '.h': 'C', '.hpp': 'C++', '.cs': 'C#',
  '.swift': 'Swift', '.kt': 'Kotlin', '.scala': 'Scala', '.php': 'PHP',
  '.vue': 'Vue', '.svelte': 'Svelte', '.html': 'HTML', '.css': 'CSS',
  '.scss': 'SCSS', '.less': 'LESS', '.json': 'JSON', '.yaml': 'YAML',
  '.yml': 'YAML', '.md': 'Markdown', '.sql': 'SQL', '.sh': 'Shell',
  '.bash': 'Shell', '.zsh': 'Shell', '.fish': 'Shell',
};

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
  '__pycache__', '.venv', 'venv', 'coverage', '.cache',
  '.turbo', '.vercel', '.firebase', 'public/workflows',
]);

const IGNORE_FILES = new Set([
  '.DS_Store', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
]);

/* ─── In-memory stores ──────────────────────────────────── */

const shellSessions = new Map<string, ShellSession>();
const shellProcesses = new Map<string, ChildProcess>();
const subAgents = new Map<string, SubAgentState>();
const hookStore = new Map<string, HookDefinition>();
const pluginStore = new Map<string, PluginDefinition>();
const projectContextStore = new Map<string, string>();
const iterativeLoops = new Map<string, { running: boolean; iterations: number; maxIterations: number }>();

/* ═══════════════════════════════════════════════════════════
   Feature 1: Deep Codebase Understanding
   ═══════════════════════════════════════════════════════════ */

function countLines(filePath: string): number {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
  } catch { return 0; }
}

function buildFileTree(dirPath: string, depth = 0, maxDepth = 6): FileNode[] {
  if (depth > maxDepth) return [];
  const nodes: FileNode[] = [];

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name) || IGNORE_FILES.has(entry.name)) continue;
      if (entry.name.startsWith('.') && depth === 0 && entry.name !== '.env.example') continue;

      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const children = buildFileTree(fullPath, depth + 1, maxDepth);
        nodes.push({
          name: entry.name,
          path: fullPath,
          type: 'directory',
          children,
        });
      } else {
        const ext = extname(entry.name);
        const stats = statSync(fullPath);
        nodes.push({
          name: entry.name,
          path: fullPath,
          type: 'file',
          size: stats.size,
          extension: ext,
          language: LANGUAGE_MAP[ext],
        });
      }
    }
  } catch { /* permission error or unreadable dir */ }

  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function flattenTree(nodes: FileNode[]): FileNode[] {
  const flat: FileNode[] = [];
  for (const node of nodes) {
    flat.push(node);
    if (node.children) flat.push(...flattenTree(node.children));
  }
  return flat;
}

export function analyzeCodebase(rootPath: string): CodebaseAnalysis {
  const tree = buildFileTree(rootPath);
  const allFiles = flattenTree(tree);
  const files = allFiles.filter(n => n.type === 'file');
  const dirs = allFiles.filter(n => n.type === 'directory');
  const languages: Record<string, { files: number; lines: number }> = {};
  let totalLines = 0;

  for (const file of files) {
    if (file.language) {
      if (!languages[file.language]) languages[file.language] = { files: 0, lines: 0 };
      languages[file.language].files++;
      const lines = countLines(file.path);
      languages[file.language].lines += lines;
      totalLines += lines;
    }
  }

  const entryPoints: string[] = [];
  for (const file of files) {
    const name = file.name.toLowerCase();
    if (['main.ts', 'main.tsx', 'index.ts', 'index.tsx', 'app.ts', 'app.tsx',
         'main.py', 'manage.py', 'main.go', 'main.rs', 'server.ts'].includes(name)) {
      entryPoints.push(relative(rootPath, file.path));
    }
  }

  let dependencies: Record<string, string> = {};
  const pkgPath = join(rootPath, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
    } catch { /* invalid json */ }
  }

  const sortedLangs = Object.entries(languages).sort((a, b) => b[1].lines - a[1].lines);
  const topLangs = sortedLangs.slice(0, 5).map(([l, s]) => `${l} (${s.files} files, ${s.lines.toLocaleString()} lines)`).join(', ');
  const summary = `Codebase at ${rootPath}: ${files.length} files in ${dirs.length} directories, ${totalLines.toLocaleString()} total lines. Top languages: ${topLangs}.`;

  return {
    rootPath,
    totalFiles: files.length,
    totalDirectories: dirs.length,
    totalLines,
    languages,
    tree,
    summary,
    entryPoints,
    dependencies,
  };
}

export function readFileContent(filePath: string, startLine?: number, endLine?: number): { content: string; totalLines: number } {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  if (startLine !== undefined && endLine !== undefined) {
    const sliced = lines.slice(Math.max(0, startLine - 1), endLine);
    return { content: sliced.join('\n'), totalLines: lines.length };
  }
  return { content, totalLines: lines.length };
}

export async function explainCodebase(rootPath: string): Promise<string> {
  const analysis = analyzeCodebase(rootPath);
  const prompt = `Analyze this codebase structure and provide a concise architectural overview:

${analysis.summary}

Entry points: ${analysis.entryPoints.join(', ')}
Top dependencies: ${Object.keys(analysis.dependencies).slice(0, 20).join(', ')}

Directory structure (top 2 levels):
${analysis.tree.map(n => formatTreeNode(n, 0, 2)).join('\n')}

Provide: 1) What this project does 2) Architecture pattern 3) Key components 4) Tech stack summary`;

  try {
    const result = await AIEngine.processAutomation(prompt, undefined, undefined, {
      model: 'gpt-4o-mini', temperature: 0.3, maxTokens: 1500,
    });
    return result.response;
  } catch (err: any) {
    return analysis.summary;
  }
}

function formatTreeNode(node: FileNode, depth: number, maxDepth: number): string {
  if (depth > maxDepth) return '';
  const indent = '  '.repeat(depth);
  const icon = node.type === 'directory' ? '📁' : '📄';
  let line = `${indent}${icon} ${node.name}`;
  if (node.children && depth < maxDepth) {
    line += '\n' + node.children.map(c => formatTreeNode(c, depth + 1, maxDepth)).filter(Boolean).join('\n');
  }
  return line;
}

/* ═══════════════════════════════════════════════════════════
   Feature 2: Code Intelligence (LSP-like)
   ═══════════════════════════════════════════════════════════ */

export function runDiagnostics(rootPath: string, files?: string[]): DiagnosticItem[] {
  const diagnostics: DiagnosticItem[] = [];

  // TypeScript diagnostics via tsc --noEmit
  const tsconfigPath = join(rootPath, 'tsconfig.json');
  if (existsSync(tsconfigPath)) {
    try {
      const fileArgs = files?.length ? files.join(' ') : '';
      const cmd = fileArgs
        ? `npx tsc --noEmit --pretty false ${fileArgs} 2>&1`
        : `npx tsc --noEmit --pretty false 2>&1`;
      const output = execSync(cmd, { cwd: rootPath, encoding: 'utf-8', timeout: 60_000 });
      diagnostics.push(...parseTscOutput(output, rootPath));
    } catch (err: any) {
      const output = err.stdout || err.stderr || '';
      diagnostics.push(...parseTscOutput(output, rootPath));
    }
  }

  // ESLint diagnostics
  try {
    const eslintTarget = files?.length ? files.join(' ') : 'src/';
    const output = execSync(
      `npx eslint ${eslintTarget} --format json --no-error-on-unmatched-pattern 2>/dev/null`,
      { cwd: rootPath, encoding: 'utf-8', timeout: 60_000 },
    );
    const results = JSON.parse(output);
    for (const result of results) {
      for (const msg of result.messages || []) {
        diagnostics.push({
          file: relative(rootPath, result.filePath),
          line: msg.line || 1,
          column: msg.column || 1,
          severity: msg.severity === 2 ? 'error' : 'warning',
          message: msg.message,
          source: 'eslint',
          code: msg.ruleId || undefined,
        });
      }
    }
  } catch { /* eslint not configured or failed */ }

  return diagnostics;
}

function parseTscOutput(output: string, rootPath: string): DiagnosticItem[] {
  const items: DiagnosticItem[] = [];
  const regex = /^(.+)\((\d+),(\d+)\):\s+(error|warning)\s+TS(\d+):\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(output)) !== null) {
    items.push({
      file: relative(rootPath, match[1]),
      line: parseInt(match[2]),
      column: parseInt(match[3]),
      severity: match[4] as 'error' | 'warning',
      message: match[6],
      source: 'typescript',
      code: `TS${match[5]}`,
    });
  }
  return items;
}

export function findDefinition(rootPath: string, symbol: string): SearchResult[] {
  const results: SearchResult[] = [];
  try {
    const patterns = [
      `(export\\s+)?(function|class|interface|type|enum|const|let|var)\\s+${escapeRegex(symbol)}`,
      `export\\s+default\\s+(function|class)\\s+${escapeRegex(symbol)}`,
      `${escapeRegex(symbol)}\\s*[:=]\\s*(function|class|\\()`,
    ];
    for (const pattern of patterns) {
      results.push(...searchCode(rootPath, pattern, { regex: true, maxResults: 20 }));
    }
  } catch { /* search failed */ }
  return results;
}

export function findReferences(rootPath: string, symbol: string): SearchResult[] {
  return searchCode(rootPath, symbol, { maxResults: 100 });
}

/* ═══════════════════════════════════════════════════════════
   Feature 3: Iterative Test-Driven Loops
   ═══════════════════════════════════════════════════════════ */

export function detectTestFramework(rootPath: string): { framework: string; command: string } | null {
  const pkgPath = join(rootPath, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const scripts = pkg.scripts || {};

      if (deps.vitest || scripts.test?.includes('vitest')) return { framework: 'vitest', command: 'npx vitest run --reporter=json' };
      if (deps.jest || scripts.test?.includes('jest')) return { framework: 'jest', command: 'npx jest --json --no-coverage' };
      if (deps.mocha || scripts.test?.includes('mocha')) return { framework: 'mocha', command: 'npx mocha --reporter json' };
      if (scripts.test) return { framework: 'npm', command: 'npm test -- --reporter=json 2>&1' };
    } catch { /* */ }
  }

  if (existsSync(join(rootPath, 'pytest.ini')) || existsSync(join(rootPath, 'pyproject.toml'))) {
    return { framework: 'pytest', command: 'python -m pytest --tb=short -q 2>&1' };
  }
  if (existsSync(join(rootPath, 'Cargo.toml'))) {
    return { framework: 'cargo', command: 'cargo test 2>&1' };
  }
  if (existsSync(join(rootPath, 'go.mod'))) {
    return { framework: 'go', command: 'go test ./... -json 2>&1' };
  }

  return null;
}

export function runTests(rootPath: string, testFile?: string, testName?: string): TestRunResult {
  const framework = detectTestFramework(rootPath);
  if (!framework) {
    return { total: 0, passed: 0, failed: 0, skipped: 0, duration: 0, results: [], output: 'No test framework detected' };
  }

  let command = framework.command;
  if (testFile) command += ` ${testFile}`;
  if (testName && (framework.framework === 'jest' || framework.framework === 'vitest')) {
    command += ` -t "${testName}"`;
  }

  const start = Date.now();
  let output = '';
  let exitCode = 0;

  try {
    output = execSync(command, { cwd: rootPath, encoding: 'utf-8', timeout: 120_000, env: { ...process.env, CI: 'true', FORCE_COLOR: '0' } });
  } catch (err: any) {
    output = (err.stdout || '') + (err.stderr || '');
    exitCode = err.status || 1;
  }

  const duration = Date.now() - start;
  const results = parseTestOutput(output, framework.framework);

  return {
    total: results.length || (exitCode === 0 ? 1 : 1),
    passed: results.filter(r => r.status === 'passed').length,
    failed: results.filter(r => r.status === 'failed').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    duration,
    results,
    output: output.substring(0, 10000),
  };
}

function parseTestOutput(output: string, framework: string): TestResult[] {
  const results: TestResult[] = [];

  if (framework === 'jest' || framework === 'vitest') {
    try {
      const json = JSON.parse(output);
      for (const suite of json.testResults || []) {
        for (const test of suite.testResults || suite.assertionResults || []) {
          results.push({
            name: test.fullName || test.title || test.name,
            status: test.status === 'passed' ? 'passed' : test.status === 'pending' ? 'skipped' : 'failed',
            duration: test.duration,
            error: test.failureMessages?.join('\n'),
            file: suite.testFilePath || suite.name,
          });
        }
      }
    } catch {
      // Fall back to regex parsing
      const passRegex = /✓|✔|PASS|passed/g;
      const failRegex = /✗|✘|FAIL|failed/g;
      const passCount = (output.match(passRegex) || []).length;
      const failCount = (output.match(failRegex) || []).length;
      if (passCount > 0) results.push({ name: 'Tests', status: 'passed' });
      if (failCount > 0) results.push({ name: 'Tests', status: 'failed', error: output.substring(0, 2000) });
    }
  } else {
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('PASS') || line.includes('✓') || line.includes('ok')) {
        results.push({ name: line.trim(), status: 'passed' });
      } else if (line.includes('FAIL') || line.includes('✗') || line.includes('FAILED')) {
        results.push({ name: line.trim(), status: 'failed', error: line.trim() });
      }
    }
  }

  return results;
}

export function startIterativeLoop(
  id: string,
  rootPath: string,
  testFile: string | undefined,
  maxIterations: number,
): { loopId: string } {
  iterativeLoops.set(id, { running: true, iterations: 0, maxIterations });
  return { loopId: id };
}

export function getLoopStatus(id: string) {
  return iterativeLoops.get(id) || null;
}

export function stopIterativeLoop(id: string): boolean {
  const loop = iterativeLoops.get(id);
  if (loop) { loop.running = false; return true; }
  return false;
}

/* ═══════════════════════════════════════════════════════════
   Feature 4: Git Workflow Automation
   ═══════════════════════════════════════════════════════════ */

export function getGitStatus(rootPath: string): GitStatus {
  const run = (cmd: string) => {
    try { return execSync(cmd, { cwd: rootPath, encoding: 'utf-8', timeout: 10_000 }).trim(); }
    catch { return ''; }
  };

  const branch = run('git branch --show-current') || 'detached';
  const aheadBehind = run('git rev-list --left-right --count HEAD...@{u} 2>/dev/null').split('\t');
  const statusOutput = run('git status --porcelain');
  const lines = statusOutput.split('\n').filter(Boolean);

  const staged: string[] = [];
  const modified: string[] = [];
  const untracked: string[] = [];
  const conflicts: string[] = [];

  for (const line of lines) {
    const x = line[0], y = line[1];
    const file = line.substring(3);
    if (x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')) {
      conflicts.push(file);
    } else if (x !== ' ' && x !== '?') {
      staged.push(file);
    }
    if (y === 'M' || y === 'D') modified.push(file);
    if (x === '?' && y === '?') untracked.push(file);
  }

  return {
    branch,
    ahead: parseInt(aheadBehind[0]) || 0,
    behind: parseInt(aheadBehind[1]) || 0,
    staged,
    modified,
    untracked,
    conflicts,
    clean: lines.length === 0,
  };
}

export function gitLog(rootPath: string, count = 20): GitCommit[] {
  try {
    const output = execSync(
      `git log --oneline --format="%H|||%h|||%an|||%ad|||%s" -${count}`,
      { cwd: rootPath, encoding: 'utf-8', timeout: 10_000 },
    );
    return output.trim().split('\n').filter(Boolean).map(line => {
      const [hash, shortHash, author, date, message] = line.split('|||');
      return { hash, shortHash, author, date, message };
    });
  } catch { return []; }
}

export function gitDiff(rootPath: string, staged = false, file?: string): string {
  try {
    let cmd = staged ? 'git diff --cached' : 'git diff';
    if (file) cmd += ` -- ${file}`;
    return execSync(cmd, { cwd: rootPath, encoding: 'utf-8', timeout: 10_000 });
  } catch { return ''; }
}

export function gitCommit(rootPath: string, message: string, files?: string[]): { success: boolean; hash?: string; error?: string } {
  try {
    if (files?.length) {
      execSync(`git add ${files.join(' ')}`, { cwd: rootPath, encoding: 'utf-8', timeout: 10_000 });
    } else {
      execSync('git add -A', { cwd: rootPath, encoding: 'utf-8', timeout: 10_000 });
    }
    const output = execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: rootPath, encoding: 'utf-8', timeout: 10_000 });
    const hashMatch = output.match(/\[.+\s([a-f0-9]+)\]/);
    return { success: true, hash: hashMatch?.[1] };
  } catch (err: any) {
    return { success: false, error: err.stderr || err.message };
  }
}

export function gitBranch(rootPath: string, action: 'create' | 'switch' | 'list' | 'delete', branchName?: string): { success: boolean; data?: any; error?: string } {
  try {
    switch (action) {
      case 'list': {
        const output = execSync('git branch -a', { cwd: rootPath, encoding: 'utf-8', timeout: 10_000 });
        return { success: true, data: output.trim().split('\n').map(b => b.trim()) };
      }
      case 'create':
        if (!branchName) return { success: false, error: 'Branch name required' };
        execSync(`git checkout -b ${branchName}`, { cwd: rootPath, encoding: 'utf-8', timeout: 10_000 });
        return { success: true, data: `Created and switched to ${branchName}` };
      case 'switch':
        if (!branchName) return { success: false, error: 'Branch name required' };
        execSync(`git checkout ${branchName}`, { cwd: rootPath, encoding: 'utf-8', timeout: 10_000 });
        return { success: true, data: `Switched to ${branchName}` };
      case 'delete':
        if (!branchName) return { success: false, error: 'Branch name required' };
        execSync(`git branch -d ${branchName}`, { cwd: rootPath, encoding: 'utf-8', timeout: 10_000 });
        return { success: true, data: `Deleted ${branchName}` };
    }
  } catch (err: any) {
    return { success: false, error: err.stderr || err.message };
  }
}

export function gitStash(rootPath: string, action: 'push' | 'pop' | 'list', message?: string): { success: boolean; data?: any; error?: string } {
  try {
    switch (action) {
      case 'push': {
        const cmd = message ? `git stash push -m "${message}"` : 'git stash push';
        execSync(cmd, { cwd: rootPath, encoding: 'utf-8', timeout: 10_000 });
        return { success: true, data: 'Changes stashed' };
      }
      case 'pop':
        execSync('git stash pop', { cwd: rootPath, encoding: 'utf-8', timeout: 10_000 });
        return { success: true, data: 'Stash applied and removed' };
      case 'list': {
        const output = execSync('git stash list', { cwd: rootPath, encoding: 'utf-8', timeout: 10_000 });
        return { success: true, data: output.trim().split('\n').filter(Boolean) };
      }
    }
  } catch (err: any) {
    return { success: false, error: err.stderr || err.message };
  }
}

/* ═══════════════════════════════════════════════════════════
   Feature 5: Sub-Agent Delegation
   ═══════════════════════════════════════════════════════════ */

export function createSubAgent(parentId: string, goal: string): SubAgentState {
  const id = `subagent-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const agent: SubAgentState = {
    id,
    goal,
    status: 'pending',
    progress: 0,
    startedAt: new Date().toISOString(),
    parentId,
    isolatedContext: {},
  };
  subAgents.set(id, agent);
  return agent;
}

export function getSubAgents(parentId?: string): SubAgentState[] {
  const all = Array.from(subAgents.values());
  return parentId ? all.filter(a => a.parentId === parentId) : all;
}

export function getSubAgent(id: string): SubAgentState | undefined {
  return subAgents.get(id);
}

export function updateSubAgent(id: string, update: Partial<SubAgentState>): SubAgentState | null {
  const agent = subAgents.get(id);
  if (!agent) return null;
  Object.assign(agent, update);
  return agent;
}

export function cancelSubAgent(id: string): boolean {
  const agent = subAgents.get(id);
  if (agent && (agent.status === 'pending' || agent.status === 'running')) {
    agent.status = 'cancelled';
    agent.completedAt = new Date().toISOString();
    return true;
  }
  return false;
}

/* ═══════════════════════════════════════════════════════════
   Feature 6: Persistent Project Context
   ═══════════════════════════════════════════════════════════ */

export function getProjectContext(projectPath: string): { context: string; source: string } | null {
  // Check for OPERON.md, CLAUDE.md, or .ai/context.md
  const contextFiles = ['OPERON.md', 'CLAUDE.md', '.ai/context.md', '.cursor/rules/context.md'];
  for (const file of contextFiles) {
    const fullPath = join(projectPath, file);
    if (existsSync(fullPath)) {
      return { context: readFileSync(fullPath, 'utf-8'), source: file };
    }
  }

  const memoryCtx = projectContextStore.get(projectPath);
  if (memoryCtx) return { context: memoryCtx, source: 'memory' };

  return null;
}

export function setProjectContext(projectPath: string, content: string, fileName = 'OPERON.md'): { success: boolean; path: string } {
  const fullPath = join(projectPath, fileName);
  const dir = dirname(fullPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(fullPath, content, 'utf-8');
  projectContextStore.set(projectPath, content);
  return { success: true, path: fullPath };
}

export function generateProjectContext(rootPath: string): string {
  const analysis = analyzeCodebase(rootPath);
  const topLangs = Object.entries(analysis.languages)
    .sort((a, b) => b[1].lines - a[1].lines)
    .slice(0, 3)
    .map(([l]) => l)
    .join(', ');

  return `# Project Context

## Overview
This project is located at \`${rootPath}\`.

## Tech Stack
Primary languages: ${topLangs}

## Structure
- ${analysis.totalFiles} files across ${analysis.totalDirectories} directories
- ${analysis.totalLines.toLocaleString()} total lines of code
- Entry points: ${analysis.entryPoints.join(', ') || 'Not detected'}

## Conventions
- Follow existing code style and patterns
- Run tests before committing
- Keep commits atomic and well-described

## Key Dependencies
${Object.entries(analysis.dependencies).slice(0, 15).map(([k, v]) => `- ${k}: ${v}`).join('\n')}
`;
}

/* ═══════════════════════════════════════════════════════════
   Feature 7: Hook System
   ═══════════════════════════════════════════════════════════ */

export function createHook(hook: Omit<HookDefinition, 'id' | 'createdAt' | 'triggerCount'>): HookDefinition {
  const id = `hook-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const newHook: HookDefinition = {
    ...hook,
    id,
    createdAt: new Date().toISOString(),
    triggerCount: 0,
  };
  hookStore.set(id, newHook);
  return newHook;
}

export function getHooks(event?: string): HookDefinition[] {
  const all = Array.from(hookStore.values());
  return event ? all.filter(h => h.event === event) : all;
}

export function updateHook(id: string, update: Partial<HookDefinition>): HookDefinition | null {
  const hook = hookStore.get(id);
  if (!hook) return null;
  Object.assign(hook, update);
  return hook;
}

export function deleteHook(id: string): boolean {
  return hookStore.delete(id);
}

export async function triggerHooks(event: HookDefinition['event'], context: Record<string, any>): Promise<Array<{ hookId: string; success: boolean; output?: string; error?: string }>> {
  const hooks = getHooks(event).filter(h => h.enabled);
  const results: Array<{ hookId: string; success: boolean; output?: string; error?: string }> = [];

  for (const hook of hooks) {
    if (hook.matcher) {
      const toolName = context.toolName || '';
      const matcherRegex = new RegExp(hook.matcher.replace(/\*/g, '.*'));
      if (!matcherRegex.test(toolName)) continue;
    }

    try {
      const fn = new Function('context', `"use strict"; ${hook.script}`);
      const output = fn(context);
      hook.triggerCount++;
      hook.lastTriggered = new Date().toISOString();
      results.push({ hookId: hook.id, success: true, output: String(output) });
    } catch (err: any) {
      results.push({ hookId: hook.id, success: false, error: err.message });
    }
  }

  return results;
}

/* ═══════════════════════════════════════════════════════════
   Feature 8: Plugin Ecosystem
   ═══════════════════════════════════════════════════════════ */

export function installPlugin(plugin: Omit<PluginDefinition, 'id' | 'installedAt'>): PluginDefinition {
  const id = `plugin-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const installed: PluginDefinition = {
    ...plugin,
    id,
    installedAt: new Date().toISOString(),
  };
  pluginStore.set(id, installed);
  return installed;
}

export function getPlugins(type?: string): PluginDefinition[] {
  const all = Array.from(pluginStore.values());
  return type ? all.filter(p => p.type === type) : all;
}

export function getPlugin(id: string): PluginDefinition | undefined {
  return pluginStore.get(id);
}

export function togglePlugin(id: string, enabled: boolean): PluginDefinition | null {
  const plugin = pluginStore.get(id);
  if (!plugin) return null;
  plugin.enabled = enabled;
  return plugin;
}

export function uninstallPlugin(id: string): boolean {
  return pluginStore.delete(id);
}

const BUILTIN_PLUGINS: Array<Omit<PluginDefinition, 'id' | 'installedAt'>> = [
  {
    name: 'Gmail Integration',
    version: '1.0.0',
    description: 'Send, read, search, and draft emails via Gmail API',
    author: 'OperonAI',
    type: 'tools',
    entryPoint: 'gmail',
    config: {},
    enabled: true,
    tools: ['gmail_send', 'gmail_read', 'gmail_reply', 'gmail_search', 'gmail_draft'],
  },
  {
    name: 'Slack Integration',
    version: '1.0.0',
    description: 'Send messages, read channels, and list channels via Slack API',
    author: 'OperonAI',
    type: 'tools',
    entryPoint: 'slack',
    config: {},
    enabled: true,
    tools: ['slack_send', 'slack_read', 'slack_list_channels'],
  },
  {
    name: 'Google Workspace',
    version: '1.0.0',
    description: 'Drive, Calendar, Sheets, Docs integration',
    author: 'OperonAI',
    type: 'tools',
    entryPoint: 'gws',
    config: {},
    enabled: true,
    tools: ['google_drive', 'google_calendar', 'google_sheets', 'google_docs', 'google_workspace'],
  },
  {
    name: 'Browser Vision Agent',
    version: '1.0.0',
    description: 'AI-driven browser navigation and data extraction',
    author: 'OperonAI',
    type: 'tools',
    entryPoint: 'browser',
    config: {},
    enabled: true,
    tools: ['browser_navigate'],
  },
  {
    name: 'CI/CD Hook Pack',
    version: '1.0.0',
    description: 'Pre-configured hooks for common CI/CD events',
    author: 'OperonAI',
    type: 'hooks',
    entryPoint: 'cicd',
    config: {},
    enabled: false,
    hooks: ['pre_commit_lint', 'post_deploy_notify', 'on_test_failure'],
  },
];

export function getBuiltinPlugins() {
  return BUILTIN_PLUGINS;
}

/* ═══════════════════════════════════════════════════════════
   Feature 9: Code Search at Scale
   ═══════════════════════════════════════════════════════════ */

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function searchCode(
  rootPath: string,
  query: string,
  options: { regex?: boolean; caseSensitive?: boolean; fileGlob?: string; maxResults?: number; contextLines?: number } = {},
): SearchResult[] {
  const { regex = false, caseSensitive = false, fileGlob, maxResults = 50, contextLines = 2 } = options;
  const results: SearchResult[] = [];

  try {
    let cmd = 'rg';
    if (!caseSensitive) cmd += ' -i';
    if (!regex) cmd += ' -F';
    cmd += ` --line-number --column --no-heading`;
    cmd += ` -C ${contextLines}`;
    cmd += ` --max-count ${maxResults}`;
    if (fileGlob) cmd += ` --glob '${fileGlob}'`;
    cmd += ` -- '${query.replace(/'/g, "'\\''")}'`;

    const output = execSync(cmd, { cwd: rootPath, encoding: 'utf-8', timeout: 30_000, maxBuffer: 10 * 1024 * 1024 });
    const lines = output.split('\n');
    const matchRegex = /^(.+):(\d+):(\d+):(.+)$/;

    for (const line of lines) {
      const match = matchRegex.exec(line);
      if (match && results.length < maxResults) {
        results.push({
          file: match[1],
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          content: match[4],
          matchLength: regex ? query.length : query.length,
        });
      }
    }
  } catch (err: any) {
    // rg returns exit code 1 when no matches found
    if (err.status !== 1) {
      // Fallback to grep
      try {
        let cmd = `grep -rn`;
        if (!caseSensitive) cmd += ' -i';
        if (!regex) cmd += ' -F';
        cmd += ` --include='*.{ts,tsx,js,jsx,py,go,rs,java,cpp,c,rb}' '${query.replace(/'/g, "'\\''")}'`;
        const output = execSync(cmd, { cwd: rootPath, encoding: 'utf-8', timeout: 30_000, maxBuffer: 10 * 1024 * 1024 });
        const lines = output.split('\n');
        for (const line of lines) {
          const grMatch = /^(.+):(\d+):(.+)$/.exec(line);
          if (grMatch && results.length < maxResults) {
            results.push({
              file: grMatch[1],
              line: parseInt(grMatch[2]),
              column: 1,
              content: grMatch[3],
              matchLength: query.length,
            });
          }
        }
      } catch { /* no results */ }
    }
  }

  return results;
}

export function searchFiles(rootPath: string, pattern: string): string[] {
  try {
    const output = execSync(
      `find . -type f -name '${pattern}' -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' | head -100`,
      { cwd: rootPath, encoding: 'utf-8', timeout: 10_000 },
    );
    return output.trim().split('\n').filter(Boolean);
  } catch { return []; }
}

/* ═══════════════════════════════════════════════════════════
   Feature 10: Shell Execution with Iterative Debugging
   ═══════════════════════════════════════════════════════════ */

export function executeShell(command: string, cwd: string): ShellSession {
  const id = `shell-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const session: ShellSession = {
    id,
    command,
    output: '',
    exitCode: null,
    status: 'running',
    startedAt: new Date().toISOString(),
    cwd,
  };

  shellSessions.set(id, session);

  try {
    const output = execSync(command, {
      cwd,
      encoding: 'utf-8',
      timeout: 120_000,
      env: { ...process.env, FORCE_COLOR: '0' },
      maxBuffer: 10 * 1024 * 1024,
    });
    session.output = output;
    session.exitCode = 0;
    session.status = 'completed';
  } catch (err: any) {
    session.output = (err.stdout || '') + '\n' + (err.stderr || '');
    session.exitCode = err.status || 1;
    session.status = 'failed';
  }

  session.completedAt = new Date().toISOString();
  return session;
}

export function executeShellAsync(command: string, cwd: string): ShellSession {
  const id = `shell-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const session: ShellSession = {
    id,
    command,
    output: '',
    exitCode: null,
    status: 'running',
    startedAt: new Date().toISOString(),
    cwd,
  };

  shellSessions.set(id, session);

  const proc = spawn('sh', ['-c', command], {
    cwd,
    env: { ...process.env, FORCE_COLOR: '0' },
  });

  session.pid = proc.pid;
  shellProcesses.set(id, proc);

  proc.stdout?.on('data', (data: Buffer) => {
    session.output += data.toString();
    if (session.output.length > 500_000) {
      session.output = session.output.slice(-400_000);
    }
  });

  proc.stderr?.on('data', (data: Buffer) => {
    session.output += data.toString();
  });

  proc.on('close', (code: number | null) => {
    session.exitCode = code;
    session.status = code === 0 ? 'completed' : 'failed';
    session.completedAt = new Date().toISOString();
    shellProcesses.delete(id);
  });

  proc.on('error', (err: Error) => {
    session.output += `\nProcess error: ${err.message}`;
    session.status = 'failed';
    session.completedAt = new Date().toISOString();
    shellProcesses.delete(id);
  });

  return session;
}

export function getShellSession(id: string): ShellSession | undefined {
  return shellSessions.get(id);
}

export function getShellSessions(): ShellSession[] {
  return Array.from(shellSessions.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
}

export function killShellSession(id: string): boolean {
  const proc = shellProcesses.get(id);
  const session = shellSessions.get(id);
  if (proc && session) {
    proc.kill('SIGTERM');
    session.status = 'killed';
    session.completedAt = new Date().toISOString();
    shellProcesses.delete(id);
    return true;
  }
  return false;
}
