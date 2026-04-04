/* ═══════════════════════════════════════════════════════════
   Display Tools — In-process MCP server providing GUI control
   tools to the Claude Agent SDK.

   Each agent gets its own server instance bound to a specific
   virtual display. The tools wrap VirtualDisplayManager calls
   and return SDK-compatible content blocks (text, image).

   Usage:
     const server = createDisplayToolServer(mgr, displayId, 'agent-0');
     // pass to query({ options: { mcpServers: { display: server } } })
   ═══════════════════════════════════════════════════════════ */

import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { VirtualDisplayManager, DisplayBounds } from './virtualDisplayManager.js';

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function errorResult(text: string) {
  return { content: [{ type: 'text' as const, text }], isError: true };
}

export function createDisplayToolServer(
  dm: VirtualDisplayManager,
  displayId: number,
  clipboardName: string,
) {
  let displayBounds: DisplayBounds | null = null;
  let activeApp: string | null = null;

  async function getBounds(): Promise<DisplayBounds> {
    if (!displayBounds) {
      displayBounds = await dm.getDisplayBounds(displayId);
    }
    return displayBounds;
  }

  const screenshot = tool(
    'screenshot',
    'Capture the current screen. Returns a JPEG screenshot of your virtual display.',
    { quality: z.number().min(0.1).max(1.0).default(0.5).describe('JPEG quality (0.1-1.0)') },
    async (args) => {
      try {
        const cap = await dm.captureDisplay(displayId, args.quality);
        return {
          content: [{ type: 'image' as const, data: cap.base64, mimeType: 'image/jpeg' }],
        };
      } catch (err: any) {
        return errorResult(`Screenshot failed: ${err.message}`);
      }
    },
    { annotations: { readOnlyHint: true } },
  );

  const click = tool(
    'click',
    'Click at (x, y) coordinates on the screen. Coordinates are relative to your virtual display (0,0 is top-left).',
    {
      x: z.number().describe('X coordinate'),
      y: z.number().describe('Y coordinate'),
      button: z.enum(['left', 'right']).default('left').describe('Mouse button'),
      count: z.number().int().min(1).max(3).default(1).describe('Click count (2=double-click)'),
    },
    async (args) => {
      try {
        const b = await getBounds();
        const screenX = b.x + args.x;
        const screenY = b.y + args.y;
        await dm.click(screenX, screenY, { button: args.button, count: args.count });
        return textResult(`Clicked at (${args.x}, ${args.y}) [${args.button}${args.count > 1 ? ` x${args.count}` : ''}]`);
      } catch (err: any) {
        return errorResult(`Click failed: ${err.message}`);
      }
    },
  );

  const typeText = tool(
    'type_text',
    'Type text into the currently focused application. The text is sent as keystrokes.',
    {
      text: z.string().describe('Text to type'),
    },
    async (args) => {
      if (!activeApp) return errorResult('No app is active. Use open_app first.');
      try {
        await dm.typeToProcess(activeApp, args.text);
        return textResult(`Typed "${args.text.length > 50 ? args.text.slice(0, 50) + '...' : args.text}" into ${activeApp}`);
      } catch (err: any) {
        return errorResult(`Type failed: ${err.message}`);
      }
    },
  );

  const keyCombo = tool(
    'key_combo',
    'Send a key or key combination to the active app. For special keys (Return, Tab, Escape, arrow keys, F1-F12, Delete, Space, Home, End, PageUp, PageDown), pass just the key name. For combinations, provide modifiers.',
    {
      key: z.string().describe('Key name (e.g. "a", "Return", "Tab", "Escape", "up", "down", "left", "right", "F1", "Delete", "Space")'),
      modifiers: z.array(z.enum(['command', 'control', 'option', 'shift'])).default([]).describe('Modifier keys'),
    },
    async (args) => {
      if (!activeApp) return errorResult('No app is active. Use open_app first.');
      try {
        await dm.keyToProcess(activeApp, args.key, args.modifiers);
        const combo = args.modifiers.length > 0
          ? `${args.modifiers.join('+')}+${args.key}`
          : args.key;
        return textResult(`Sent ${combo} to ${activeApp}`);
      } catch (err: any) {
        return errorResult(`Key combo failed: ${err.message}`);
      }
    },
  );

  const openApp = tool(
    'open_app',
    'Open a macOS application on your virtual display. Creates a new window and moves it to your screen. Sets it as the active app for keyboard input.',
    {
      app_name: z.string().describe('Application name (e.g. "Safari", "Figma", "Terminal", "Notes")'),
    },
    async (args) => {
      try {
        const result = await dm.openAppWindow(args.app_name, displayId);
        activeApp = args.app_name;
        return textResult(`Opened ${args.app_name} (window ${result.windowId}: "${result.title}"). It is now the active app.`);
      } catch (err: any) {
        return errorResult(`Failed to open ${args.app_name}: ${err.message}`);
      }
    },
  );

  const switchApp = tool(
    'switch_app',
    'Switch focus to a different app that is already open on your display. Use list_windows to see available apps.',
    {
      app_name: z.string().describe('Application name to switch to'),
    },
    async (args) => {
      try {
        const windows = await dm.listAppWindows(args.app_name, displayId);
        if (windows.length === 0) {
          return errorResult(`No windows found for "${args.app_name}" on your display. Use open_app to open it.`);
        }
        await dm.raiseWindow(windows[0].windowId);
        activeApp = args.app_name;
        return textResult(`Switched to ${args.app_name} (window ${windows[0].windowId})`);
      } catch (err: any) {
        return errorResult(`Switch failed: ${err.message}`);
      }
    },
  );

  const listWindows = tool(
    'list_windows',
    'List all application windows on your virtual display.',
    {},
    async () => {
      try {
        const windows = await dm.listAppWindows('', displayId);
        if (windows.length === 0) return textResult('No windows on your display. Use open_app to open an application.');
        const lines = windows.map(w => `• ${w.title || '(untitled)'} [window ${w.windowId}] (${w.bounds.width}x${w.bounds.height})`);
        return textResult(`Windows on your display:\n${lines.join('\n')}`);
      } catch (err: any) {
        return errorResult(`List failed: ${err.message}`);
      }
    },
    { annotations: { readOnlyHint: true } },
  );

  const scroll = tool(
    'scroll',
    'Scroll at a specific position on screen. Positive deltaY scrolls down, negative scrolls up.',
    {
      x: z.number().describe('X coordinate to scroll at'),
      y: z.number().describe('Y coordinate to scroll at'),
      deltaY: z.number().default(-3).describe('Vertical scroll amount (negative=up, positive=down)'),
      deltaX: z.number().default(0).describe('Horizontal scroll amount'),
    },
    async (args) => {
      try {
        const b = await getBounds();
        await dm.scroll(b.x + args.x, b.y + args.y, args.deltaY, args.deltaX);
        const dir = args.deltaY < 0 ? 'up' : 'down';
        return textResult(`Scrolled ${dir} at (${args.x}, ${args.y})`);
      } catch (err: any) {
        return errorResult(`Scroll failed: ${err.message}`);
      }
    },
  );

  const drag = tool(
    'drag',
    'Drag from one point to another on the screen.',
    {
      startX: z.number().describe('Start X coordinate'),
      startY: z.number().describe('Start Y coordinate'),
      endX: z.number().describe('End X coordinate'),
      endY: z.number().describe('End Y coordinate'),
    },
    async (args) => {
      try {
        const b = await getBounds();
        await dm.drag(
          b.x + args.startX, b.y + args.startY,
          b.x + args.endX, b.y + args.endY,
        );
        return textResult(`Dragged from (${args.startX},${args.startY}) to (${args.endX},${args.endY})`);
      } catch (err: any) {
        return errorResult(`Drag failed: ${err.message}`);
      }
    },
  );

  const clipboardRead = tool(
    'clipboard_read',
    'Read text from your isolated clipboard.',
    {},
    async () => {
      try {
        const text = await dm.clipboardRead(clipboardName);
        return textResult(text || '(clipboard is empty)');
      } catch (err: any) {
        return errorResult(`Clipboard read failed: ${err.message}`);
      }
    },
    { annotations: { readOnlyHint: true } },
  );

  const clipboardWrite = tool(
    'clipboard_write',
    'Write text to your isolated clipboard.',
    {
      text: z.string().describe('Text to write to clipboard'),
    },
    async (args) => {
      try {
        await dm.clipboardWrite(clipboardName, args.text);
        return textResult('Written to clipboard');
      } catch (err: any) {
        return errorResult(`Clipboard write failed: ${err.message}`);
      }
    },
  );

  return createSdkMcpServer({
    name: 'display',
    version: '1.0.0',
    tools: [
      screenshot,
      click,
      typeText,
      keyCombo,
      openApp,
      switchApp,
      listWindows,
      scroll,
      drag,
      clipboardRead,
      clipboardWrite,
    ],
  });
}
