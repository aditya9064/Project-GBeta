import type { WorkflowVersion, WorkflowDefinition } from './types';

const STORAGE_KEY = 'operon_workflow_versions';

function loadAll(): WorkflowVersion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map((v: any) => ({
      ...v,
      createdAt: new Date(v.createdAt),
    }));
  } catch {
    return [];
  }
}

function saveAll(versions: WorkflowVersion[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
}

export const VersioningService = {
  saveVersion(params: {
    agentId: string;
    workflow: WorkflowDefinition;
    name: string;
    description?: string;
    createdBy: string;
    changeLog?: string;
  }): WorkflowVersion {
    const all = loadAll();
    const agentVersions = all.filter(v => v.agentId === params.agentId);
    const nextVersion = agentVersions.length > 0
      ? Math.max(...agentVersions.map(v => v.version)) + 1
      : 1;

    const version: WorkflowVersion = {
      id: `ver-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      agentId: params.agentId,
      version: nextVersion,
      workflow: JSON.parse(JSON.stringify(params.workflow)),
      name: params.name,
      description: params.description,
      createdAt: new Date(),
      createdBy: params.createdBy,
      changeLog: params.changeLog,
    };

    all.push(version);

    // Keep only last 50 versions per agent
    const grouped: Record<string, WorkflowVersion[]> = {};
    for (const v of all) {
      if (!grouped[v.agentId]) grouped[v.agentId] = [];
      grouped[v.agentId].push(v);
    }
    const pruned: WorkflowVersion[] = [];
    for (const agentId in grouped) {
      const sorted = grouped[agentId].sort((a, b) => b.version - a.version);
      pruned.push(...sorted.slice(0, 50));
    }

    saveAll(pruned);
    return version;
  },

  getVersions(agentId: string): WorkflowVersion[] {
    return loadAll()
      .filter(v => v.agentId === agentId)
      .sort((a, b) => b.version - a.version);
  },

  getVersion(agentId: string, version: number): WorkflowVersion | null {
    return loadAll().find(v => v.agentId === agentId && v.version === version) || null;
  },

  getLatest(agentId: string): WorkflowVersion | null {
    const versions = this.getVersions(agentId);
    return versions.length > 0 ? versions[0] : null;
  },

  compareVersions(agentId: string, v1: number, v2: number): {
    added: string[];
    removed: string[];
    modified: string[];
  } {
    const ver1 = this.getVersion(agentId, v1);
    const ver2 = this.getVersion(agentId, v2);
    if (!ver1 || !ver2) return { added: [], removed: [], modified: [] };

    const nodes1 = new Map(ver1.workflow.nodes.map(n => [n.id, n]));
    const nodes2 = new Map(ver2.workflow.nodes.map(n => [n.id, n]));

    const added: string[] = [];
    const removed: string[] = [];
    const modified: string[] = [];

    for (const [id, node] of nodes2) {
      if (!nodes1.has(id)) {
        added.push(node.label);
      } else {
        const old = nodes1.get(id)!;
        if (JSON.stringify(old.config) !== JSON.stringify(node.config) || old.label !== node.label) {
          modified.push(node.label);
        }
      }
    }

    for (const [id, node] of nodes1) {
      if (!nodes2.has(id)) {
        removed.push(node.label);
      }
    }

    return { added, removed, modified };
  },

  deleteVersions(agentId: string): void {
    const all = loadAll();
    saveAll(all.filter(v => v.agentId !== agentId));
  },
};
