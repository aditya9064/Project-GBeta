/* ═══════════════════════════════════════════════════════════
   Browser Tools — In-process MCP server providing browser
   automation tools to the Claude Agent SDK.

   Each agent can get its own browser instance with isolated
   session data. Tools wrap Puppeteer calls and return
   SDK-compatible content blocks (text, image).

   Usage:
     const server = createBrowserToolServer(browserManager, sessionId);
     // pass to query({ options: { mcpServers: { browser: server } } })
   ═══════════════════════════════════════════════════════════ */

import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { BrowserSession } from './browserAgent.js';

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function errorResult(text: string) {
  return { content: [{ type: 'text' as const, text }], isError: true };
}

export function createBrowserToolServer(session: BrowserSession) {
  const navigate = tool(
    'navigate',
    'Navigate the browser to a URL. Waits for the page to finish loading.',
    {
      url: z.string().describe('Full URL to navigate to (including https://)'),
      waitForSelector: z.string().optional().describe('CSS selector to wait for after navigation'),
    },
    async (args) => {
      try {
        const page = session.page;
        if (!page) return errorResult('Browser session not initialized');
        await page.goto(args.url, { waitUntil: 'networkidle2', timeout: 30000 });
        if (args.waitForSelector) {
          await page.waitForSelector(args.waitForSelector, { timeout: 10000 });
        }
        const title = await page.title();
        const url = page.url();
        return textResult(`Navigated to: ${title}\nURL: ${url}`);
      } catch (err: any) {
        return errorResult(`Navigation failed: ${err.message}`);
      }
    },
  );

  const screenshot = tool(
    'screenshot',
    'Take a screenshot of the current browser page. Returns a JPEG image.',
    {
      fullPage: z.boolean().default(false).describe('Capture the full scrollable page'),
    },
    async (args) => {
      try {
        const page = session.page;
        if (!page) return errorResult('Browser session not initialized');
        const buffer = await page.screenshot({
          type: 'jpeg',
          quality: 70,
          fullPage: args.fullPage,
        });
        const base64 = Buffer.from(buffer).toString('base64');
        return {
          content: [{ type: 'image' as const, data: base64, mimeType: 'image/jpeg' }],
        };
      } catch (err: any) {
        return errorResult(`Screenshot failed: ${err.message}`);
      }
    },
    { annotations: { readOnlyHint: true } },
  );

  const clickElement = tool(
    'click_element',
    'Click on an element identified by a CSS selector. Scrolls to the element first if needed.',
    {
      selector: z.string().describe('CSS selector of the element to click'),
      button: z.enum(['left', 'right', 'middle']).default('left').describe('Mouse button'),
    },
    async (args) => {
      try {
        const page = session.page;
        if (!page) return errorResult('Browser session not initialized');
        await page.waitForSelector(args.selector, { timeout: 10000, visible: true });
        await page.click(args.selector, { button: args.button });
        await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});
        return textResult(`Clicked element: ${args.selector}`);
      } catch (err: any) {
        return errorResult(`Click failed: ${err.message}`);
      }
    },
  );

  const fillForm = tool(
    'fill_form',
    'Fill form fields by CSS selector. Clears existing content before typing.',
    {
      fields: z.array(z.object({
        selector: z.string().describe('CSS selector of the input field'),
        value: z.string().describe('Value to type into the field'),
      })).describe('Array of field selectors and values to fill'),
    },
    async (args) => {
      try {
        const page = session.page;
        if (!page) return errorResult('Browser session not initialized');
        const results: string[] = [];
        for (const field of args.fields) {
          await page.waitForSelector(field.selector, { timeout: 10000, visible: true });
          await page.click(field.selector, { clickCount: 3 });
          await page.type(field.selector, field.value, { delay: 30 });
          results.push(`Filled ${field.selector}`);
        }
        return textResult(results.join('\n'));
      } catch (err: any) {
        return errorResult(`Form fill failed: ${err.message}`);
      }
    },
  );

  const extractData = tool(
    'extract_data',
    'Extract text content, attributes, or structured data from the page using CSS selectors.',
    {
      selector: z.string().describe('CSS selector to extract data from'),
      attribute: z.string().optional().describe('Element attribute to extract (e.g. "href", "src"). If omitted, extracts textContent.'),
      all: z.boolean().default(false).describe('If true, extracts from all matching elements'),
    },
    async (args) => {
      try {
        const page = session.page;
        if (!page) return errorResult('Browser session not initialized');

        if (args.all) {
          const data = await page.$$eval(args.selector, (elements, attr) => {
            return elements.map(el => {
              if (attr) return el.getAttribute(attr) || '';
              return (el as HTMLElement).innerText || el.textContent || '';
            });
          }, args.attribute || null);
          return textResult(JSON.stringify(data, null, 2));
        } else {
          const data = await page.$eval(args.selector, (el, attr) => {
            if (attr) return el.getAttribute(attr) || '';
            return (el as HTMLElement).innerText || el.textContent || '';
          }, args.attribute || null);
          return textResult(data);
        }
      } catch (err: any) {
        return errorResult(`Data extraction failed: ${err.message}`);
      }
    },
    { annotations: { readOnlyHint: true } },
  );

  const waitForElement = tool(
    'wait_for_element',
    'Wait for an element to appear on the page.',
    {
      selector: z.string().describe('CSS selector to wait for'),
      timeout: z.number().default(10000).describe('Maximum wait time in milliseconds'),
      hidden: z.boolean().default(false).describe('If true, waits for element to be hidden/removed'),
    },
    async (args) => {
      try {
        const page = session.page;
        if (!page) return errorResult('Browser session not initialized');
        await page.waitForSelector(args.selector, {
          timeout: args.timeout,
          hidden: args.hidden,
        });
        return textResult(`Element ${args.hidden ? 'hidden' : 'found'}: ${args.selector}`);
      } catch (err: any) {
        return errorResult(`Wait failed: ${err.message}`);
      }
    },
    { annotations: { readOnlyHint: true } },
  );

  const getPageInfo = tool(
    'get_page_info',
    'Get current page URL, title, and visible text content.',
    {},
    async () => {
      try {
        const page = session.page;
        if (!page) return errorResult('Browser session not initialized');
        const title = await page.title();
        const url = page.url();
        const text = await page.evaluate(() => {
          const body = document.body;
          if (!body) return '';
          return body.innerText.slice(0, 5000);
        });
        return textResult(`Title: ${title}\nURL: ${url}\n\nVisible text:\n${text}`);
      } catch (err: any) {
        return errorResult(`Page info failed: ${err.message}`);
      }
    },
    { annotations: { readOnlyHint: true } },
  );

  const scroll = tool(
    'scroll',
    'Scroll the page up or down.',
    {
      direction: z.enum(['up', 'down']).describe('Scroll direction'),
      amount: z.number().default(500).describe('Pixels to scroll'),
    },
    async (args) => {
      try {
        const page = session.page;
        if (!page) return errorResult('Browser session not initialized');
        const delta = args.direction === 'down' ? args.amount : -args.amount;
        await page.evaluate((d) => window.scrollBy(0, d), delta);
        return textResult(`Scrolled ${args.direction} by ${args.amount}px`);
      } catch (err: any) {
        return errorResult(`Scroll failed: ${err.message}`);
      }
    },
  );

  const typeText = tool(
    'type_text',
    'Type text using the keyboard. Useful for search boxes or forms without clear selectors.',
    {
      text: z.string().describe('Text to type'),
      pressEnter: z.boolean().default(false).describe('Press Enter after typing'),
    },
    async (args) => {
      try {
        const page = session.page;
        if (!page) return errorResult('Browser session not initialized');
        await page.keyboard.type(args.text, { delay: 30 });
        if (args.pressEnter) {
          await page.keyboard.press('Enter');
        }
        return textResult(`Typed: "${args.text}"${args.pressEnter ? ' + Enter' : ''}`);
      } catch (err: any) {
        return errorResult(`Type failed: ${err.message}`);
      }
    },
  );

  const pressKey = tool(
    'press_key',
    'Press a keyboard key or key combination.',
    {
      key: z.string().describe('Key to press (e.g. "Enter", "Tab", "Escape", "ArrowDown")'),
      modifiers: z.array(z.enum(['Shift', 'Control', 'Alt', 'Meta'])).default([]).describe('Modifier keys to hold'),
    },
    async (args) => {
      try {
        const page = session.page;
        if (!page) return errorResult('Browser session not initialized');
        for (const mod of args.modifiers) {
          await page.keyboard.down(mod);
        }
        await page.keyboard.press(args.key as any);
        for (const mod of args.modifiers.reverse()) {
          await page.keyboard.up(mod);
        }
        return textResult(`Pressed: ${args.modifiers.length ? args.modifiers.join('+') + '+' : ''}${args.key}`);
      } catch (err: any) {
        return errorResult(`Key press failed: ${err.message}`);
      }
    },
  );

  return createSdkMcpServer(
    'browser',
    [navigate, screenshot, clickElement, fillForm, extractData, waitForElement, getPageInfo, scroll, typeText, pressKey],
  );
}
