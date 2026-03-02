/* ═══════════════════════════════════════════════════════════
   Execution Stream Service — Real-time execution monitoring via SSE
   
   Provides Server-Sent Events for live execution progress updates.
   Clients subscribe to execution streams and receive incremental logs.
   ═══════════════════════════════════════════════════════════ */

import { Response } from 'express';
import { logger } from './logger.js';

export interface ExecutionStreamEvent {
  type: 'node_start' | 'node_complete' | 'node_failed' | 'execution_complete' | 'execution_failed' | 'progress' | 'log';
  executionId: string;
  agentId: string;
  nodeId?: string;
  nodeName?: string;
  nodeType?: string;
  status?: string;
  progress?: number;
  message?: string;
  output?: any;
  error?: string;
  timestamp: string;
}

interface StreamClient {
  res: Response;
  executionId: string;
  agentId: string;
  connectedAt: Date;
}

class ExecutionStreamService {
  private clients: Map<string, StreamClient[]> = new Map();
  private executionStates: Map<string, ExecutionStreamEvent[]> = new Map();

  /**
   * Register a new SSE client for an execution
   */
  subscribe(executionId: string, agentId: string, res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const client: StreamClient = {
      res,
      executionId,
      agentId,
      connectedAt: new Date(),
    };

    const key = `${agentId}:${executionId}`;
    const existing = this.clients.get(key) || [];
    existing.push(client);
    this.clients.set(key, existing);

    // Send connection confirmation
    this.sendToClient(client, {
      type: 'log',
      executionId,
      agentId,
      message: 'Connected to execution stream',
      timestamp: new Date().toISOString(),
    });

    // Send any buffered events for this execution
    const buffered = this.executionStates.get(key);
    if (buffered) {
      for (const event of buffered) {
        this.sendToClient(client, event);
      }
    }

    // Handle client disconnect
    res.on('close', () => {
      this.unsubscribe(executionId, agentId, res);
    });

    logger.info(`📡 SSE client connected for execution ${executionId}`);
  }

  /**
   * Unsubscribe a client
   */
  unsubscribe(executionId: string, agentId: string, res: Response): void {
    const key = `${agentId}:${executionId}`;
    const clients = this.clients.get(key);
    if (clients) {
      const filtered = clients.filter(c => c.res !== res);
      if (filtered.length === 0) {
        this.clients.delete(key);
      } else {
        this.clients.set(key, filtered);
      }
    }
    logger.info(`📡 SSE client disconnected from execution ${executionId}`);
  }

  /**
   * Emit an event to all clients subscribed to an execution
   */
  emit(event: ExecutionStreamEvent): void {
    const key = `${event.agentId}:${event.executionId}`;
    
    // Buffer event
    const buffered = this.executionStates.get(key) || [];
    buffered.push(event);
    // Keep last 100 events per execution
    if (buffered.length > 100) {
      buffered.shift();
    }
    this.executionStates.set(key, buffered);

    // Send to all connected clients
    const clients = this.clients.get(key);
    if (clients) {
      for (const client of clients) {
        this.sendToClient(client, event);
      }
    }

    // Also emit to "all" listeners (for dashboard)
    const allClients = this.clients.get(`${event.agentId}:*`);
    if (allClients) {
      for (const client of allClients) {
        this.sendToClient(client, event);
      }
    }
  }

  /**
   * Subscribe to all executions for an agent
   */
  subscribeToAgent(agentId: string, res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const client: StreamClient = {
      res,
      executionId: '*',
      agentId,
      connectedAt: new Date(),
    };

    const key = `${agentId}:*`;
    const existing = this.clients.get(key) || [];
    existing.push(client);
    this.clients.set(key, existing);

    this.sendToClient(client, {
      type: 'log',
      executionId: '*',
      agentId,
      message: 'Connected to agent execution stream',
      timestamp: new Date().toISOString(),
    });

    res.on('close', () => {
      const clients = this.clients.get(key);
      if (clients) {
        const filtered = clients.filter(c => c.res !== res);
        if (filtered.length === 0) {
          this.clients.delete(key);
        } else {
          this.clients.set(key, filtered);
        }
      }
    });

    logger.info(`📡 SSE client connected for all executions of agent ${agentId}`);
  }

  /**
   * Subscribe to all executions (for workforce dashboard)
   */
  subscribeToAll(res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const client: StreamClient = {
      res,
      executionId: '*',
      agentId: '*',
      connectedAt: new Date(),
    };

    const key = '*:*';
    const existing = this.clients.get(key) || [];
    existing.push(client);
    this.clients.set(key, existing);

    this.sendToClient(client, {
      type: 'log',
      executionId: '*',
      agentId: '*',
      message: 'Connected to global execution stream',
      timestamp: new Date().toISOString(),
    });

    res.on('close', () => {
      const clients = this.clients.get(key);
      if (clients) {
        const filtered = clients.filter(c => c.res !== res);
        if (filtered.length === 0) {
          this.clients.delete(key);
        } else {
          this.clients.set(key, filtered);
        }
      }
    });

    logger.info(`📡 SSE client connected for global execution stream`);
  }

  /**
   * Send event to a specific client
   */
  private sendToClient(client: StreamClient, event: ExecutionStreamEvent): void {
    try {
      const data = JSON.stringify(event);
      client.res.write(`event: ${event.type}\n`);
      client.res.write(`data: ${data}\n\n`);
    } catch (err) {
      logger.error('Failed to send SSE event:', err);
    }
  }

  /**
   * Clean up completed execution buffers (call periodically)
   */
  cleanupOldExecutions(maxAgeMs: number = 3600000): void {
    const now = Date.now();
    for (const [key, events] of this.executionStates.entries()) {
      if (events.length > 0) {
        const lastEvent = events[events.length - 1];
        const lastTime = new Date(lastEvent.timestamp).getTime();
        if (now - lastTime > maxAgeMs) {
          this.executionStates.delete(key);
        }
      }
    }
  }

  /**
   * Get active client count
   */
  getActiveClientCount(): number {
    let count = 0;
    for (const clients of this.clients.values()) {
      count += clients.length;
    }
    return count;
  }

  /**
   * Cancel an execution (notify clients)
   */
  cancelExecution(executionId: string, agentId: string): void {
    this.emit({
      type: 'execution_failed',
      executionId,
      agentId,
      error: 'Execution cancelled by user',
      timestamp: new Date().toISOString(),
    });
  }
}

export const ExecutionStream = new ExecutionStreamService();

// Cleanup old executions every hour
setInterval(() => {
  ExecutionStream.cleanupOldExecutions();
}, 3600000);
