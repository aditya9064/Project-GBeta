/* ═══════════════════════════════════════════════════════════
   Virtual Display Manager — TypeScript bridge to the native
   Swift VirtualDisplayServer process.

   Spawns the server as a child process, communicates via
   JSON-RPC over stdin/stdout, and provides an async API
   for creating/destroying virtual displays, capturing
   screenshots, sending input, and managing windows.
   ═══════════════════════════════════════════════════════════ */

import { spawn, type ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import path from 'path';

export interface DisplayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VirtualDisplay {
  displayId: number;
  name: string;
  width: number;
  height: number;
  bounds: DisplayBounds;
}

export interface CaptureResult {
  base64: string;
  width: number;
  height: number;
  bytes: number;
}

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class VirtualDisplayManager {
  private process: ChildProcess | null = null;
  private pending = new Map<number, PendingRequest>();
  private nextId = 1;
  private ready = false;
  private nativePath: string;

  constructor(nativePath?: string) {
    this.nativePath = nativePath || path.join(
      import.meta.dirname, '../native/operon-display-server'
    );
  }

  /* ─── Lifecycle ──────────────────────────────────────── */

  async start(): Promise<void> {
    if (this.process && !this.process.killed) return;

    this.process = spawn(this.nativePath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const rl = createInterface({ input: this.process.stdout! });
    rl.on('line', (line) => {
      try {
        const msg = JSON.parse(line);
        const pending = this.pending.get(msg.id);
        if (!pending) return;
        this.pending.delete(msg.id);
        clearTimeout(pending.timer);

        if (msg.error) {
          pending.reject(new Error(msg.error));
        } else {
          pending.resolve(msg.result);
        }
      } catch { /* non-JSON line, ignore */ }
    });

    this.process.stderr?.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().trim().split('\n');
      for (const line of lines) {
        console.log('[VirtualDisplay]', line.replace('[DisplayServer] ', ''));
      }
    });

    this.process.on('exit', (code) => {
      console.log('[VirtualDisplay] Server exited with code', code);
      this.ready = false;
      for (const [, req] of this.pending) {
        clearTimeout(req.timer);
        req.reject(new Error('Display server exited'));
      }
      this.pending.clear();
    });

    // Verify server is alive
    await this.call('ping', {});
    this.ready = true;
    console.log('[VirtualDisplay] Server started');
  }

  async stop(): Promise<void> {
    if (!this.process) return;
    this.process.kill();
    this.process = null;
    this.ready = false;
  }

  get isRunning(): boolean {
    return this.ready && !!this.process && !this.process.killed;
  }

  /* ─── JSON-RPC Call ─────────────────────────────────── */

  private call(method: string, params: Record<string, any>, timeoutMs = 15000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process || !this.process.stdin) {
        reject(new Error('Display server not running'));
        return;
      }

      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Display server call '${method}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });

      const msg = JSON.stringify({ id, method, params }) + '\n';
      this.process.stdin.write(msg);
    });
  }

  /* ─── Display Management ────────────────────────────── */

  async createDisplay(opts?: {
    width?: number;
    height?: number;
    name?: string;
  }): Promise<VirtualDisplay> {
    if (!this.isRunning) await this.start();
    return this.call('create_display', {
      width: opts?.width || 1280,
      height: opts?.height || 900,
      name: opts?.name || 'Operon Agent',
    });
  }

  async destroyDisplay(displayId: number): Promise<{ success: boolean }> {
    return this.call('destroy_display', { displayId });
  }

  async listDisplays(): Promise<VirtualDisplay[]> {
    const result = await this.call('list_displays', {});
    return result.displays || [];
  }

  /* ─── Screen Capture ────────────────────────────────── */

  async captureDisplay(displayId: number, quality = 0.5): Promise<CaptureResult> {
    return this.call('capture_display', { displayId, quality });
  }

  /* ─── Input ─────────────────────────────────────────── */

  async click(x: number, y: number, opts?: {
    count?: number;
    button?: 'left' | 'right';
  }): Promise<void> {
    await this.call('click', {
      x, y,
      count: opts?.count || 1,
      button: opts?.button || 'left',
    });
  }

  async doubleClick(x: number, y: number): Promise<void> {
    await this.click(x, y, { count: 2 });
  }

  async rightClick(x: number, y: number): Promise<void> {
    await this.click(x, y, { button: 'right' });
  }

  async drag(startX: number, startY: number, endX: number, endY: number): Promise<void> {
    await this.call('drag', { startX, startY, endX, endY });
  }

  async scroll(x: number, y: number, deltaY: number, deltaX = 0): Promise<void> {
    await this.call('scroll', { x, y, deltaY, deltaX });
  }

  /* ─── Window Management ─────────────────────────────── */

  async openApp(appName: string, opts?: {
    hide?: boolean;
    waitMs?: number;
  }): Promise<void> {
    await this.call('open_app', {
      appName,
      hide: opts?.hide ?? true,
      waitMs: opts?.waitMs ?? 1500,
    }, 20000);
  }

  async moveWindowToDisplay(appName: string, display: VirtualDisplay, opts?: {
    padding?: number;
  }): Promise<void> {
    const pad = opts?.padding ?? 0;
    await this.call('move_window', {
      appName,
      x: display.bounds.x + pad,
      y: display.bounds.y + pad,
      width: display.bounds.width - pad * 2,
      height: display.bounds.height - pad * 2,
    });
  }

  async getDisplayBounds(displayId: number): Promise<DisplayBounds> {
    return this.call('get_bounds', { displayId });
  }

  /* ─── Per-Window Operations (multi-agent isolation) ───── */

  async captureWindow(windowId: number, quality = 0.5): Promise<CaptureResult> {
    return this.call('capture_window', { windowId, quality });
  }

  async listAppWindows(appName: string, displayId?: number): Promise<Array<{
    windowId: number;
    title: string;
    bounds: DisplayBounds;
    pid: number;
  }>> {
    const result = await this.call('list_app_windows', { appName, displayId });
    return result.windows || [];
  }

  async raiseWindow(windowId: number): Promise<void> {
    await this.call('raise_window', { windowId });
  }

  async typeToProcess(appName: string, text: string): Promise<void> {
    await this.call('type_to_process', { appName, text });
  }

  async keyToProcess(appName: string, key: string, modifiers?: string[]): Promise<void> {
    await this.call('key_to_process', { appName, key, modifiers: modifiers || [] });
  }

  async moveWindowById(windowId: number, x: number, y: number, width?: number, height?: number): Promise<void> {
    await this.call('move_window_by_id', { windowId, x, y, width, height });
  }

  async openAppWindow(appName: string, displayId?: number): Promise<{
    windowId: number;
    title: string;
    appName: string;
  }> {
    return this.call('open_app_window', { appName, displayId }, 20000);
  }

  async clipboardWrite(name: string, text: string): Promise<void> {
    await this.call('clipboard_write', { name, text });
  }

  async clipboardRead(name: string): Promise<string> {
    const result = await this.call('clipboard_read', { name });
    return result.text || '';
  }
}
