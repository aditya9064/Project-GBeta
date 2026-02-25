// Progressive Trust Service — Graduated autonomy for agents
//
// Agents start cautious (require approval for everything) and earn autonomy
// as they prove reliable. Inspired by how you'd trust a new employee:
//
// Trust Levels:
//   1. observe    — Agent watches and logs what it would do (shadow mode)
//   2. suggest    — Agent proposes actions, user decides
//   3. approve    — Agent acts but needs confirmation for sensitive operations
//   4. autonomous — Agent acts independently, logs for audit
//
// Trust escalation and revocation happen automatically based on performance.

export type TrustLevel = 'observe' | 'suggest' | 'approve' | 'autonomous';

export interface TrustConfig {
  agentId: string;
  level: TrustLevel;
  approvalRate: number;
  totalActions: number;
  approvedActions: number;
  rejectedActions: number;
  revokedAt?: Date;
  revokeReason?: string;
  escalatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PendingApproval {
  id: string;
  agentId: string;
  agentName: string;
  action: string;
  description: string;
  input: any;
  suggestedOutput?: any;
  trustLevel: TrustLevel;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  expiresAt: Date;
}

export interface AuditEntry {
  id: string;
  agentId: string;
  agentName: string;
  action: string;
  input: any;
  output: any;
  trustLevel: TrustLevel;
  approved: boolean;
  automatic: boolean;
  timestamp: Date;
}

type ApprovalHandler = (approval: PendingApproval) => void;

const TRUST_STORAGE_KEY = 'agent_trust_configs';
const APPROVALS_STORAGE_KEY = 'agent_pending_approvals';
const AUDIT_STORAGE_KEY = 'agent_trust_audit';

const TRUST_ORDER: TrustLevel[] = ['observe', 'suggest', 'approve', 'autonomous'];

const ESCALATION_THRESHOLDS: Record<TrustLevel, { minActions: number; minApprovalRate: number }> = {
  observe: { minActions: 5, minApprovalRate: 0 },
  suggest: { minActions: 10, minApprovalRate: 0.8 },
  approve: { minActions: 25, minApprovalRate: 0.9 },
  autonomous: { minActions: Infinity, minApprovalRate: 1 },
};

const SENSITIVE_ACTIONS = new Set([
  'send_email', 'reply_email', 'delete_record', 'http_request_post',
  'send_slack', 'checkout', 'update_record', 'execute_code',
]);

const approvalHandlers = new Set<ApprovalHandler>();

function loadTrustConfigs(): TrustConfig[] {
  try {
    const raw = localStorage.getItem(TRUST_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map((c: any) => ({
      ...c,
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.updatedAt),
      revokedAt: c.revokedAt ? new Date(c.revokedAt) : undefined,
      escalatedAt: c.escalatedAt ? new Date(c.escalatedAt) : undefined,
    }));
  } catch {
    return [];
  }
}

function saveTrustConfigs(configs: TrustConfig[]): void {
  try {
    localStorage.setItem(TRUST_STORAGE_KEY, JSON.stringify(configs));
  } catch { /* ignore */ }
}

function loadApprovals(): PendingApproval[] {
  try {
    const raw = localStorage.getItem(APPROVALS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map((a: any) => ({
      ...a,
      createdAt: new Date(a.createdAt),
      resolvedAt: a.resolvedAt ? new Date(a.resolvedAt) : undefined,
      expiresAt: new Date(a.expiresAt),
    }));
  } catch {
    return [];
  }
}

function saveApprovals(approvals: PendingApproval[]): void {
  try {
    localStorage.setItem(APPROVALS_STORAGE_KEY, JSON.stringify(approvals.slice(-200)));
  } catch { /* ignore */ }
}

function loadAudit(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map((a: any) => ({
      ...a,
      timestamp: new Date(a.timestamp),
    }));
  } catch {
    return [];
  }
}

function saveAudit(entries: AuditEntry[]): void {
  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(entries.slice(-500)));
  } catch { /* ignore */ }
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

export const TrustService = {
  getConfig(agentId: string): TrustConfig {
    const configs = loadTrustConfigs();
    const existing = configs.find(c => c.agentId === agentId);
    if (existing) return existing;

    const now = new Date();
    const newConfig: TrustConfig = {
      agentId,
      level: 'suggest',
      approvalRate: 0,
      totalActions: 0,
      approvedActions: 0,
      rejectedActions: 0,
      createdAt: now,
      updatedAt: now,
    };

    configs.push(newConfig);
    saveTrustConfigs(configs);
    return newConfig;
  },

  setLevel(agentId: string, level: TrustLevel): void {
    const configs = loadTrustConfigs();
    const config = configs.find(c => c.agentId === agentId);
    if (config) {
      config.level = level;
      config.updatedAt = new Date();
      if (TRUST_ORDER.indexOf(level) > TRUST_ORDER.indexOf(config.level)) {
        config.escalatedAt = new Date();
      }
    } else {
      configs.push({
        agentId,
        level,
        approvalRate: 0,
        totalActions: 0,
        approvedActions: 0,
        rejectedActions: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    saveTrustConfigs(configs);
  },

  shouldRequestApproval(agentId: string, action: string): { needsApproval: boolean; reason: string } {
    const config = this.getConfig(agentId);

    switch (config.level) {
      case 'observe':
        return { needsApproval: true, reason: 'Agent is in observe-only mode — logging action without execution.' };

      case 'suggest':
        return { needsApproval: true, reason: 'Agent is in suggest mode — awaiting user decision.' };

      case 'approve':
        if (SENSITIVE_ACTIONS.has(action)) {
          return { needsApproval: true, reason: `Sensitive action "${action}" requires approval at trust level "approve".` };
        }
        return { needsApproval: false, reason: 'Non-sensitive action allowed at trust level "approve".' };

      case 'autonomous':
        return { needsApproval: false, reason: 'Agent has autonomous trust — action logged for audit.' };

      default:
        return { needsApproval: true, reason: 'Unknown trust level — defaulting to approval required.' };
    }
  },

  requestApproval(
    agentId: string,
    agentName: string,
    action: string,
    description: string,
    input: any,
    suggestedOutput?: any,
  ): PendingApproval {
    const config = this.getConfig(agentId);
    const approval: PendingApproval = {
      id: generateId('approval'),
      agentId,
      agentName,
      action,
      description,
      input,
      suggestedOutput,
      trustLevel: config.level,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    const approvals = loadApprovals();
    approvals.push(approval);
    saveApprovals(approvals);

    for (const handler of approvalHandlers) {
      try { handler(approval); } catch { /* ignore */ }
    }

    return approval;
  },

  resolveApproval(approvalId: string, approved: boolean, resolvedBy = 'user'): PendingApproval | null {
    const approvals = loadApprovals();
    const approval = approvals.find(a => a.id === approvalId);
    if (!approval || approval.status !== 'pending') return null;

    approval.status = approved ? 'approved' : 'rejected';
    approval.resolvedAt = new Date();
    approval.resolvedBy = resolvedBy;
    saveApprovals(approvals);

    // Update trust metrics
    const configs = loadTrustConfigs();
    const config = configs.find(c => c.agentId === approval.agentId);
    if (config) {
      config.totalActions++;
      if (approved) config.approvedActions++;
      else config.rejectedActions++;
      config.approvalRate = config.totalActions > 0 ? config.approvedActions / config.totalActions : 0;
      config.updatedAt = new Date();

      // Check for automatic escalation
      const currentIdx = TRUST_ORDER.indexOf(config.level);
      if (currentIdx < TRUST_ORDER.length - 1) {
        const nextLevel = TRUST_ORDER[currentIdx + 1];
        const threshold = ESCALATION_THRESHOLDS[config.level];
        if (
          config.totalActions >= threshold.minActions &&
          config.approvalRate >= threshold.minApprovalRate
        ) {
          config.level = nextLevel;
          config.escalatedAt = new Date();
          console.log(`[Trust] Agent ${approval.agentId} escalated to "${nextLevel}" (${config.approvalRate * 100}% approval rate over ${config.totalActions} actions)`);
        }
      }

      saveTrustConfigs(configs);
    }

    // Log to audit trail
    this.audit(
      approval.agentId,
      approval.agentName,
      approval.action,
      approval.input,
      approved ? approval.suggestedOutput : null,
      approval.trustLevel,
      approved,
      false,
    );

    return approval;
  },

  revokeToLevel(agentId: string, level: TrustLevel, reason: string): void {
    const configs = loadTrustConfigs();
    const config = configs.find(c => c.agentId === agentId);
    if (config) {
      const oldLevel = config.level;
      config.level = level;
      config.revokedAt = new Date();
      config.revokeReason = reason;
      config.updatedAt = new Date();
      saveTrustConfigs(configs);
      console.log(`[Trust] Agent ${agentId} REVOKED from "${oldLevel}" to "${level}": ${reason}`);
    }
  },

  getPendingApprovals(agentId?: string): PendingApproval[] {
    const now = new Date();
    let approvals = loadApprovals().filter(a => {
      if (a.status !== 'pending') return false;
      if (new Date(a.expiresAt) < now) {
        a.status = 'expired';
        return false;
      }
      return true;
    });

    if (agentId) approvals = approvals.filter(a => a.agentId === agentId);

    saveApprovals(loadApprovals());
    return approvals;
  },

  audit(
    agentId: string,
    agentName: string,
    action: string,
    input: any,
    output: any,
    trustLevel: TrustLevel,
    approved: boolean,
    automatic: boolean,
  ): void {
    const entries = loadAudit();
    entries.push({
      id: generateId('audit'),
      agentId,
      agentName,
      action,
      input,
      output,
      trustLevel,
      approved,
      automatic,
      timestamp: new Date(),
    });
    saveAudit(entries);
  },

  getAuditTrail(agentId?: string, limit = 50): AuditEntry[] {
    let entries = loadAudit();
    if (agentId) entries = entries.filter(e => e.agentId === agentId);
    return entries.slice(-limit).reverse();
  },

  onApprovalRequest(handler: ApprovalHandler): () => void {
    approvalHandlers.add(handler);
    return () => { approvalHandlers.delete(handler); };
  },

  getAllConfigs(): TrustConfig[] {
    return loadTrustConfigs();
  },

  getStats(agentId: string): {
    level: TrustLevel;
    approvalRate: number;
    totalActions: number;
    pendingApprovals: number;
    recentAudit: AuditEntry[];
  } {
    const config = this.getConfig(agentId);
    const pending = this.getPendingApprovals(agentId);
    const audit = this.getAuditTrail(agentId, 10);

    return {
      level: config.level,
      approvalRate: config.approvalRate,
      totalActions: config.totalActions,
      pendingApprovals: pending.length,
      recentAudit: audit,
    };
  },
};
