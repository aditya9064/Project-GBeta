/* ═══════════════════════════════════════════════════════════
   Browser Automation Service — Puppeteer
   
   Manages headful browser sessions so each agent gets its own
   visible Chrome window that won't interfere with the user's
   browsing. Sessions are identified by a sessionId (typically
   the agentId or executionId).
   
   Key design decisions:
   - Non-headless: the user can watch what the agent is doing
   - Separate user-data-dir per session: cookies/state isolated
   - Configurable viewport, timeouts, and navigation wait
   - Screenshots returned as base64 for the frontend to render
   - Graceful cleanup on session close
   ═══════════════════════════════════════════════════════════ */

import puppeteer, { Browser, Page, type LaunchOptions } from 'puppeteer';
import path from 'path';
import fs from 'fs';
import os from 'os';

export interface BrowserSession {
  id: string;
  browser: Browser;
  page: Page;
  createdAt: Date;
  lastActivityAt: Date;
  status: 'active' | 'idle' | 'closed';
  currentUrl: string;
}

export interface BrowserActionResult {
  success: boolean;
  action: string;
  data?: any;
  screenshot?: string;
  error?: string;
  url?: string;
  title?: string;
  timestamp: string;
}

const SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes idle → auto-close

class BrowserServiceImpl {
  private sessions = new Map<string, BrowserSession>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanupIdleSessions(), 60_000);
  }

  /* ─── Session lifecycle ─────────────────────────────── */

  async createSession(sessionId: string, options?: {
    headless?: boolean;
    width?: number;
    height?: number;
  }): Promise<BrowserSession> {
    if (this.sessions.has(sessionId)) {
      const existing = this.sessions.get(sessionId)!;
      if (existing.status !== 'closed') {
        existing.lastActivityAt = new Date();
        return existing;
      }
      this.sessions.delete(sessionId);
    }

    const userDataDir = path.join(os.tmpdir(), 'gbeta-browser-sessions', sessionId);
    fs.mkdirSync(userDataDir, { recursive: true });

    const width = options?.width || 1280;
    const height = options?.height || 900;

    const launchOptions: LaunchOptions = {
      headless: options?.headless ?? false,
      defaultViewport: { width, height },
      userDataDir,
      args: [
        `--window-size=${width},${height}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-infobars',
        '--disable-extensions',
        '--disable-popup-blocking',
      ],
    };

    const browser = await puppeteer.launch(launchOptions);
    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();

    await page.setViewport({ width, height });

    const session: BrowserSession = {
      id: sessionId,
      browser,
      page,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      status: 'active',
      currentUrl: 'about:blank',
    };

    this.sessions.set(sessionId, session);
    console.log(`[Browser] Session "${sessionId}" created (headless: ${options?.headless ?? false})`);
    return session;
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      session.status = 'closed';
      await session.browser.close();
    } catch {
      // browser may already be closed
    }
    this.sessions.delete(sessionId);
    console.log(`[Browser] Session "${sessionId}" closed`);
  }

  getSession(sessionId: string): BrowserSession | undefined {
    return this.sessions.get(sessionId);
  }

  listSessions(): { id: string; status: string; url: string; createdAt: Date; lastActivityAt: Date }[] {
    return Array.from(this.sessions.values()).map(s => ({
      id: s.id,
      status: s.status,
      url: s.currentUrl,
      createdAt: s.createdAt,
      lastActivityAt: s.lastActivityAt,
    }));
  }

  /* ─── Page actions ──────────────────────────────────── */

  async navigate(sessionId: string, url: string, opts?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2' }): Promise<BrowserActionResult> {
    const session = await this.ensureSession(sessionId);
    try {
      await session.page.goto(url, {
        waitUntil: opts?.waitUntil || 'domcontentloaded',
        timeout: 30_000,
      });
      session.currentUrl = session.page.url();
      session.lastActivityAt = new Date();

      const title = await session.page.title();
      return this.ok('navigate', { url: session.currentUrl, title });
    } catch (err: any) {
      return this.fail('navigate', err);
    }
  }

  async click(sessionId: string, selector: string, opts?: { waitForNav?: boolean }): Promise<BrowserActionResult> {
    const session = await this.ensureSession(sessionId);
    try {
      await session.page.waitForSelector(selector, { timeout: 10_000 });

      if (opts?.waitForNav) {
        await Promise.all([
          session.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {}),
          session.page.click(selector),
        ]);
      } else {
        await session.page.click(selector);
      }

      session.currentUrl = session.page.url();
      session.lastActivityAt = new Date();
      return this.ok('click', { selector, url: session.currentUrl });
    } catch (err: any) {
      return this.fail('click', err);
    }
  }

  async type(sessionId: string, selector: string, text: string, opts?: { clearFirst?: boolean; delay?: number }): Promise<BrowserActionResult> {
    const session = await this.ensureSession(sessionId);
    try {
      await session.page.waitForSelector(selector, { timeout: 10_000 });

      if (opts?.clearFirst) {
        await session.page.click(selector, { count: 3 });
        await session.page.keyboard.press('Backspace');
      }

      await session.page.type(selector, text, { delay: opts?.delay || 50 });
      session.lastActivityAt = new Date();
      return this.ok('type', { selector, textLength: text.length });
    } catch (err: any) {
      return this.fail('type', err);
    }
  }

  async select(sessionId: string, selector: string, value: string): Promise<BrowserActionResult> {
    const session = await this.ensureSession(sessionId);
    try {
      await session.page.waitForSelector(selector, { timeout: 10_000 });
      const values = await session.page.select(selector, value);
      session.lastActivityAt = new Date();
      return this.ok('select', { selector, selected: values });
    } catch (err: any) {
      return this.fail('select', err);
    }
  }

  async scroll(sessionId: string, direction: 'up' | 'down' = 'down', pixels = 500): Promise<BrowserActionResult> {
    const session = await this.ensureSession(sessionId);
    try {
      const y = direction === 'down' ? pixels : -pixels;
      await session.page.evaluate((scrollY: number) => window.scrollBy(0, scrollY), y);
      session.lastActivityAt = new Date();
      return this.ok('scroll', { direction, pixels });
    } catch (err: any) {
      return this.fail('scroll', err);
    }
  }

  async waitFor(sessionId: string, selectorOrMs: string | number): Promise<BrowserActionResult> {
    const session = await this.ensureSession(sessionId);
    try {
      if (typeof selectorOrMs === 'number') {
        await new Promise(resolve => setTimeout(resolve, Math.min(selectorOrMs, 30_000)));
      } else {
        await session.page.waitForSelector(selectorOrMs, { timeout: 15_000 });
      }
      session.lastActivityAt = new Date();
      return this.ok('wait', { waited: selectorOrMs });
    } catch (err: any) {
      return this.fail('wait', err);
    }
  }

  async screenshot(sessionId: string, opts?: { fullPage?: boolean }): Promise<BrowserActionResult> {
    const session = await this.ensureSession(sessionId);
    try {
      const buffer = await session.page.screenshot({
        encoding: 'base64',
        fullPage: opts?.fullPage || false,
      });
      session.lastActivityAt = new Date();
      return this.ok('screenshot', { screenshot: buffer as string });
    } catch (err: any) {
      return this.fail('screenshot', err);
    }
  }

  async extract(sessionId: string, selector: string, attribute?: string): Promise<BrowserActionResult> {
    const session = await this.ensureSession(sessionId);
    try {
      await session.page.waitForSelector(selector, { timeout: 10_000 });

      const data = await session.page.$$eval(selector, (elements, attr) => {
        return elements.map(el => {
          if (attr) return el.getAttribute(attr) || '';
          return el.textContent?.trim() || '';
        });
      }, attribute || '');

      session.lastActivityAt = new Date();
      return this.ok('extract', { selector, results: data, count: data.length });
    } catch (err: any) {
      return this.fail('extract', err);
    }
  }

  async submit(sessionId: string, selector?: string): Promise<BrowserActionResult> {
    const session = await this.ensureSession(sessionId);
    try {
      const formSelector = selector || 'form';
      await session.page.waitForSelector(formSelector, { timeout: 10_000 });

      await Promise.all([
        session.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {}),
        session.page.evaluate((sel: string) => {
          const form = document.querySelector(sel);
          if (form && form instanceof HTMLFormElement) form.submit();
        }, formSelector),
      ]);

      session.currentUrl = session.page.url();
      session.lastActivityAt = new Date();
      return this.ok('submit', { selector: formSelector, url: session.currentUrl });
    } catch (err: any) {
      return this.fail('submit', err);
    }
  }

  async evaluate(sessionId: string, script: string): Promise<BrowserActionResult> {
    const session = await this.ensureSession(sessionId);
    try {
      const result = await session.page.evaluate(script);
      session.lastActivityAt = new Date();
      return this.ok('evaluate', { result });
    } catch (err: any) {
      return this.fail('evaluate', err);
    }
  }

  async getPageInfo(sessionId: string): Promise<BrowserActionResult> {
    const session = await this.ensureSession(sessionId);
    try {
      const url = session.page.url();
      const title = await session.page.title();
      const cookies = await session.page.cookies();
      session.lastActivityAt = new Date();
      return this.ok('page_info', { url, title, cookieCount: cookies.length });
    } catch (err: any) {
      return this.fail('page_info', err);
    }
  }

  /* ─── Composite actions (multi-step shortcuts) ──────── */

  async login(sessionId: string, url: string, credentials: {
    usernameSelector: string;
    passwordSelector: string;
    username: string;
    password: string;
    submitSelector?: string;
  }): Promise<BrowserActionResult> {
    const session = await this.ensureSession(sessionId);
    try {
      await session.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await session.page.waitForSelector(credentials.usernameSelector, { timeout: 10_000 });
      await session.page.type(credentials.usernameSelector, credentials.username, { delay: 50 });
      await session.page.type(credentials.passwordSelector, credentials.password, { delay: 50 });

      const submitSel = credentials.submitSelector || 'button[type="submit"]';
      await Promise.all([
        session.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {}),
        session.page.click(submitSel),
      ]);

      session.currentUrl = session.page.url();
      session.lastActivityAt = new Date();
      const title = await session.page.title();
      return this.ok('login', { url: session.currentUrl, title, loggedIn: true });
    } catch (err: any) {
      return this.fail('login', err);
    }
  }

  async search(sessionId: string, url: string, searchSelector: string, query: string, submitSelector?: string): Promise<BrowserActionResult> {
    const session = await this.ensureSession(sessionId);
    try {
      if (url) {
        await session.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      }
      await session.page.waitForSelector(searchSelector, { timeout: 10_000 });
      await session.page.type(searchSelector, query, { delay: 30 });

      if (submitSelector) {
        await Promise.all([
          session.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {}),
          session.page.click(submitSelector),
        ]);
      } else {
        await Promise.all([
          session.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {}),
          session.page.keyboard.press('Enter'),
        ]);
      }

      session.currentUrl = session.page.url();
      session.lastActivityAt = new Date();
      const title = await session.page.title();
      return this.ok('search', { url: session.currentUrl, title, query });
    } catch (err: any) {
      return this.fail('search', err);
    }
  }

  /* ─── Internal helpers ──────────────────────────────── */

  private async ensureSession(sessionId: string): Promise<BrowserSession> {
    let session = this.sessions.get(sessionId);
    if (!session || session.status === 'closed') {
      session = await this.createSession(sessionId);
    }
    return session;
  }

  private ok(action: string, data: any): BrowserActionResult {
    const { screenshot, ...rest } = data;
    return {
      success: true,
      action,
      data: rest,
      screenshot,
      url: data.url,
      title: data.title,
      timestamp: new Date().toISOString(),
    };
  }

  private fail(action: string, err: Error): BrowserActionResult {
    return {
      success: false,
      action,
      error: err.message,
      timestamp: new Date().toISOString(),
    };
  }

  private async cleanupIdleSessions(): Promise<void> {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (session.status === 'closed') {
        this.sessions.delete(id);
        continue;
      }
      if (now - session.lastActivityAt.getTime() > SESSION_TIMEOUT_MS) {
        console.log(`[Browser] Auto-closing idle session "${id}"`);
        await this.closeSession(id);
      }
    }
  }

  async shutdownAll(): Promise<void> {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    for (const id of this.sessions.keys()) {
      await this.closeSession(id);
    }
  }
}

export const BrowserService = new BrowserServiceImpl();
