import type { StoredCredential, CredentialType, AppType } from './types';

const STORAGE_KEY = 'operon_credentials';

function encode(data: Record<string, string>): string {
  return btoa(JSON.stringify(data));
}

function decode(encoded: string): Record<string, string> {
  try {
    return JSON.parse(atob(encoded));
  } catch {
    return {};
  }
}

function loadAll(): StoredCredential[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as any[];
    return parsed.map(c => ({
      ...c,
      data: typeof c.data === 'string' ? decode(c.data) : c.data,
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.updatedAt),
      lastUsedAt: c.lastUsedAt ? new Date(c.lastUsedAt) : undefined,
    }));
  } catch {
    return [];
  }
}

function saveAll(creds: StoredCredential[]): void {
  const serialized = creds.map(c => ({
    ...c,
    data: encode(c.data),
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
}

export const CredentialService = {
  getAll(userId?: string): StoredCredential[] {
    const all = loadAll();
    return userId ? all.filter(c => c.userId === userId) : all;
  },

  getById(id: string): StoredCredential | null {
    return loadAll().find(c => c.id === id) || null;
  },

  getByApp(appType: AppType | string, userId?: string): StoredCredential[] {
    return loadAll().filter(c => c.appType === appType && (!userId || c.userId === userId));
  },

  create(params: {
    userId: string;
    name: string;
    type: CredentialType;
    appType: AppType | string;
    data: Record<string, string>;
  }): StoredCredential {
    const now = new Date();
    const cred: StoredCredential = {
      id: `cred-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      userId: params.userId,
      name: params.name,
      type: params.type,
      appType: params.appType,
      data: params.data,
      createdAt: now,
      updatedAt: now,
    };

    const all = loadAll();
    all.push(cred);
    saveAll(all);
    return cred;
  },

  update(id: string, data: Partial<Pick<StoredCredential, 'name' | 'data'>>): StoredCredential | null {
    const all = loadAll();
    const idx = all.findIndex(c => c.id === id);
    if (idx < 0) return null;

    if (data.name) all[idx].name = data.name;
    if (data.data) all[idx].data = { ...all[idx].data, ...data.data };
    all[idx].updatedAt = new Date();

    saveAll(all);
    return all[idx];
  },

  delete(id: string): boolean {
    const all = loadAll();
    const filtered = all.filter(c => c.id !== id);
    if (filtered.length === all.length) return false;
    saveAll(filtered);
    return true;
  },

  markUsed(id: string): void {
    const all = loadAll();
    const cred = all.find(c => c.id === id);
    if (cred) {
      cred.lastUsedAt = new Date();
      saveAll(all);
    }
  },

  resolve(credentialId: string): Record<string, string> | null {
    const cred = this.getById(credentialId);
    if (!cred) return null;
    this.markUsed(credentialId);
    return cred.data;
  },

  buildAuthHeaders(cred: StoredCredential): Record<string, string> {
    switch (cred.type) {
      case 'bearer_token':
        return { Authorization: `Bearer ${cred.data.token || cred.data.accessToken || ''}` };
      case 'basic_auth': {
        const encoded = btoa(`${cred.data.username || ''}:${cred.data.password || ''}`);
        return { Authorization: `Basic ${encoded}` };
      }
      case 'api_key':
        return { [cred.data.headerName || 'X-API-Key']: cred.data.apiKey || '' };
      case 'oauth2':
        return { Authorization: `Bearer ${cred.data.accessToken || ''}` };
      default:
        return {};
    }
  },
};
