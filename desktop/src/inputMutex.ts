/* @deprecated — No longer needed. The Swift VirtualDisplayServer
   handles all input directly via JSON-RPC, and each agent operates
   on its own virtual display (no shared cursor).

   ═══════════════════════════════════════════════════════════
   InputMutex — Serializes mouse actions + parallel AppleScript input

   When multiple agents run concurrently, keyboard input can be
   sent to specific apps via AppleScript (truly parallel), but
   mouse clicks must be serialized because there is only one
   physical cursor on macOS.
   ═══════════════════════════════════════════════════════════ */

import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

/* ─── Mutex for serializing mouse/cursor actions ────────── */

export class InputMutex {
  private queue: Array<{ resolve: () => void }> = [];
  private locked = false;

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    return new Promise<void>(resolve => {
      this.queue.push({ resolve });
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      next.resolve();
    } else {
      this.locked = false;
    }
  }
}

/* ─── AppleScript helpers (parallel-safe, no cursor needed) ─ */

function escapeAppleScript(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function runOsascript(script: string, timeoutMs = 10000): Promise<string> {
  const escaped = script.replace(/'/g, "'\\''");
  return execAsync(`osascript -e '${escaped}'`, {
    timeout: timeoutMs,
    encoding: 'utf-8',
  }).then(r => r.stdout.trim());
}

/**
 * Send a keystroke to a specific app process without requiring focus.
 * Parallel-safe: multiple agents can call this for different apps simultaneously.
 */
export async function appKeystroke(appName: string, text: string): Promise<void> {
  const escaped = escapeAppleScript(text);
  await runOsascript(
    `tell application "System Events" to tell process "${appName}" to keystroke "${escaped}"`
  );
}

/**
 * Send a key combo (e.g. Cmd+C) to a specific app process.
 * modifiers: array of 'command', 'control', 'option', 'shift'
 */
export async function appKeyCombo(
  appName: string,
  key: string,
  modifiers: string[],
): Promise<void> {
  const modStr = modifiers
    .map(m => {
      const lower = m.toLowerCase();
      if (['cmd', 'command', 'super', 'meta'].includes(lower)) return 'command down';
      if (['ctrl', 'control'].includes(lower)) return 'control down';
      if (['alt', 'option'].includes(lower)) return 'option down';
      if (lower === 'shift') return 'shift down';
      return `${lower} down`;
    })
    .join(', ');

  const mappedKey = mapAppleScriptKey(key);
  if (mappedKey.isKeyCode) {
    await runOsascript(
      `tell application "System Events" to tell process "${appName}" to key code ${mappedKey.value} using {${modStr}}`
    );
  } else {
    await runOsascript(
      `tell application "System Events" to tell process "${appName}" to keystroke "${escapeAppleScript(mappedKey.value)}" using {${modStr}}`
    );
  }
}

/**
 * Press a single special key (Return, Tab, Escape, arrows) in a specific app.
 */
export async function appSpecialKey(appName: string, keyName: string): Promise<void> {
  const mapped = mapAppleScriptKey(keyName);
  if (mapped.isKeyCode) {
    await runOsascript(
      `tell application "System Events" to tell process "${appName}" to key code ${mapped.value}`
    );
  } else {
    await runOsascript(
      `tell application "System Events" to tell process "${appName}" to keystroke "${escapeAppleScript(mapped.value)}"`
    );
  }
}

/**
 * Bring an app window to front, click at absolute coordinates, then release mutex.
 * Must be called with the mutex already acquired.
 */
export async function activateApp(appName: string): Promise<void> {
  await runOsascript(`tell application "${appName}" to activate`);
  await new Promise(r => setTimeout(r, 100));
}

/* ─── Key mapping for AppleScript key codes ──────────────── */

interface MappedKey {
  value: string;
  isKeyCode: boolean;
}

function mapAppleScriptKey(key: string): MappedKey {
  const keyCodes: Record<string, number> = {
    'return': 36, 'enter': 36,
    'tab': 48,
    'escape': 53, 'esc': 53,
    'delete': 51, 'backspace': 51,
    'fwd-delete': 117, 'forwarddelete': 117,
    'space': 49,
    'up': 126, 'arrow-up': 126,
    'down': 125, 'arrow-down': 125,
    'left': 123, 'arrow-left': 123,
    'right': 124, 'arrow-right': 124,
    'home': 115, 'end': 119,
    'page_up': 116, 'pageup': 116,
    'page_down': 121, 'pagedown': 121,
    'f1': 122, 'f2': 120, 'f3': 99, 'f4': 118,
    'f5': 96, 'f6': 97, 'f7': 98, 'f8': 100,
    'f9': 101, 'f10': 109, 'f11': 103, 'f12': 111,
  };

  const lower = key.toLowerCase();
  if (lower in keyCodes) {
    return { value: String(keyCodes[lower]), isKeyCode: true };
  }
  return { value: key, isKeyCode: false };
}
