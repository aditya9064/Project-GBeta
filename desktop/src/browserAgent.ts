/* ═══════════════════════════════════════════════════════════
   Browser Agent — Puppeteer-based browser automation

   Manages browser sessions for web-based workflow tasks.
   Each session gets its own browser context with isolated
   cookies, storage, and state.

   Usage by the swarm orchestrator:
   - Workers assigned "browser_action" tasks get browser tools
   - Sessions are created on demand and cleaned up after tasks
   ═══════════════════════════════════════════════════════════ */

import puppeteer from 'puppeteer';
import type { Browser, Page, BrowserContext } from 'puppeteer';

export interface BrowserSession {
  id: string;
  context: BrowserContext;
  page: Page;
  createdAt: string;
}

export class BrowserManager {
  private browser: Browser | null = null;
  private sessions = new Map<string, BrowserSession>();

  async ensureBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.connected) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--window-size=1280,900',
        ],
        defaultViewport: { width: 1280, height: 900 },
      });
    }
    return this.browser;
  }

  async createSession(id?: string): Promise<BrowserSession> {
    const browser = await this.ensureBrowser();
    const context = await browser.createBrowserContext();
    const page = await context.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const sessionId = id || `browser-${Date.now()}`;
    const session: BrowserSession = {
      id: sessionId,
      context,
      page,
      createdAt: new Date().toISOString(),
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): BrowserSession | null {
    return this.sessions.get(sessionId) || null;
  }

  async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        await session.context.close();
      } catch { /* best effort */ }
      this.sessions.delete(sessionId);
    }
  }

  async destroyAll(): Promise<void> {
    for (const sessionId of [...this.sessions.keys()]) {
      await this.destroySession(sessionId);
    }
    if (this.browser) {
      try { await this.browser.close(); } catch { /* best effort */ }
      this.browser = null;
    }
  }

  get sessionCount(): number {
    return this.sessions.size;
  }

  get isRunning(): boolean {
    return !!this.browser && this.browser.connected;
  }
}
