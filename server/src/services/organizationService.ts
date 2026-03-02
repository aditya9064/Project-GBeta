/* ═══════════════════════════════════════════════════════════
   Organization Service
   
   Multi-tenant organization management with team workspaces,
   billing, and SSO configuration.
   ═══════════════════════════════════════════════════════════ */

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger, Metrics } from './logger.js';

const ORGS_COLLECTION = 'organizations';
const TEAMS_COLLECTION = 'teams';
const MEMBERSHIPS_COLLECTION = 'org_memberships';

export type OrgPlan = 'free' | 'starter' | 'pro' | 'enterprise';
export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer';
export type SSOProvider = 'google' | 'microsoft' | 'okta' | 'auth0' | 'saml';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  
  // Plan & Billing
  plan: OrgPlan;
  planExpiresAt?: string;
  billingEmail?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  
  // Limits based on plan
  limits: {
    maxUsers: number;
    maxAgents: number;
    maxExecutionsPerMonth: number;
    maxStorageGB: number;
    apiRateLimit: number;
  };
  
  // Usage tracking
  usage: {
    currentUsers: number;
    currentAgents: number;
    executionsThisMonth: number;
    storageUsedGB: number;
  };
  
  // SSO Configuration
  sso?: {
    enabled: boolean;
    provider: SSOProvider;
    domain?: string;
    clientId?: string;
    tenantId?: string;
    metadataUrl?: string;
    enforced: boolean;
  };
  
  // Settings
  settings: {
    allowPublicAgents: boolean;
    requireMfa: boolean;
    defaultTeamId?: string;
    auditLogRetentionDays: number;
    allowedEmailDomains?: string[];
  };
  
  // Ownership
  ownerId: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  
  // Permissions
  permissions: {
    canCreateAgents: boolean;
    canDeployAgents: boolean;
    canAccessBilling: boolean;
    canManageMembers: boolean;
    canAccessAnalytics: boolean;
  };
  
  // Members
  memberCount: number;
  agentCount: number;
  
  // Settings
  isDefault: boolean;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface OrgMembership {
  id: string;
  organizationId: string;
  userId: string;
  email: string;
  role: OrgRole;
  teamIds: string[];
  
  // Invitation
  invitedBy?: string;
  invitedAt?: string;
  acceptedAt?: string;
  
  // Status
  status: 'pending' | 'active' | 'suspended';
  lastActiveAt?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

const PLAN_LIMITS: Record<OrgPlan, Organization['limits']> = {
  free: {
    maxUsers: 3,
    maxAgents: 5,
    maxExecutionsPerMonth: 100,
    maxStorageGB: 1,
    apiRateLimit: 10,
  },
  starter: {
    maxUsers: 10,
    maxAgents: 25,
    maxExecutionsPerMonth: 1000,
    maxStorageGB: 10,
    apiRateLimit: 50,
  },
  pro: {
    maxUsers: 50,
    maxAgents: 100,
    maxExecutionsPerMonth: 10000,
    maxStorageGB: 100,
    apiRateLimit: 200,
  },
  enterprise: {
    maxUsers: -1,
    maxAgents: -1,
    maxExecutionsPerMonth: -1,
    maxStorageGB: -1,
    apiRateLimit: -1,
  },
};

const orgsCache = new Map<string, Organization>();
const teamsCache = new Map<string, Team>();
const membershipsCache = new Map<string, OrgMembership>();

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

export const OrganizationService = {
  /**
   * Create a new organization
   */
  async create(data: {
    name: string;
    ownerId: string;
    plan?: OrgPlan;
    billingEmail?: string;
  }): Promise<Organization> {
    const plan = data.plan || 'free';
    
    const org: Organization = {
      id: generateId('org'),
      name: data.name,
      slug: generateSlug(data.name),
      plan,
      billingEmail: data.billingEmail,
      limits: { ...PLAN_LIMITS[plan] },
      usage: {
        currentUsers: 1,
        currentAgents: 0,
        executionsThisMonth: 0,
        storageUsedGB: 0,
      },
      settings: {
        allowPublicAgents: false,
        requireMfa: false,
        auditLogRetentionDays: 30,
      },
      ownerId: data.ownerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    orgsCache.set(org.id, org);
    
    try {
      const db = getFirestore();
      await db.collection(ORGS_COLLECTION).doc(org.id).set(org);
      
      // Create default team
      const defaultTeam = await this.createTeam({
        organizationId: org.id,
        name: 'Default',
        isDefault: true,
      });
      
      // Add owner as member
      await this.addMember({
        organizationId: org.id,
        userId: data.ownerId,
        email: data.billingEmail || '',
        role: 'owner',
        teamIds: [defaultTeam.id],
      });
      
      org.settings.defaultTeamId = defaultTeam.id;
      await this.update(org.id, { settings: org.settings });
    } catch (err) {
      logger.warn('OrganizationService: Firestore unavailable', { error: err });
    }
    
    logger.info(`🏢 Organization created: ${org.name}`, { orgId: org.id });
    Metrics.increment('organization.created', 1, { plan });
    
    return org;
  },

  /**
   * Get organization by ID
   */
  async get(id: string): Promise<Organization | null> {
    if (orgsCache.has(id)) {
      return orgsCache.get(id)!;
    }
    
    try {
      const db = getFirestore();
      const doc = await db.collection(ORGS_COLLECTION).doc(id).get();
      if (doc.exists) {
        const org = doc.data() as Organization;
        orgsCache.set(id, org);
        return org;
      }
    } catch {
      // Firestore unavailable
    }
    
    return null;
  },

  /**
   * Get organization by slug
   */
  async getBySlug(slug: string): Promise<Organization | null> {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(ORGS_COLLECTION)
        .where('slug', '==', slug)
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        const org = snapshot.docs[0].data() as Organization;
        orgsCache.set(org.id, org);
        return org;
      }
    } catch {
      // Check cache
      for (const org of orgsCache.values()) {
        if (org.slug === slug) return org;
      }
    }
    
    return null;
  },

  /**
   * Update organization
   */
  async update(id: string, updates: Partial<Organization>): Promise<Organization | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    
    const updated: Organization = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    orgsCache.set(id, updated);
    
    try {
      const db = getFirestore();
      await db.collection(ORGS_COLLECTION).doc(id).update({
        ...updates,
        updatedAt: updated.updatedAt,
      });
    } catch {
      // Firestore unavailable
    }
    
    return updated;
  },

  /**
   * Delete organization
   */
  async delete(id: string): Promise<boolean> {
    orgsCache.delete(id);
    
    try {
      const db = getFirestore();
      await db.collection(ORGS_COLLECTION).doc(id).delete();
      
      // Delete related teams and memberships
      const teams = await this.getTeams(id);
      for (const team of teams) {
        await this.deleteTeam(team.id);
      }
      
      const members = await this.getMembers(id);
      for (const member of members) {
        membershipsCache.delete(member.id);
        await db.collection(MEMBERSHIPS_COLLECTION).doc(member.id).delete();
      }
    } catch {
      // Firestore unavailable
    }
    
    logger.info(`🏢 Organization deleted: ${id}`);
    return true;
  },

  /**
   * List organizations for a user
   */
  async listForUser(userId: string): Promise<Organization[]> {
    try {
      const db = getFirestore();
      
      // Get memberships for user
      const memberships = await db.collection(MEMBERSHIPS_COLLECTION)
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .get();
      
      const orgIds = memberships.docs.map(d => d.data().organizationId);
      
      if (orgIds.length === 0) return [];
      
      // Get organizations
      const orgs: Organization[] = [];
      for (const orgId of orgIds) {
        const org = await this.get(orgId);
        if (org) orgs.push(org);
      }
      
      return orgs;
    } catch {
      return Array.from(orgsCache.values())
        .filter(org => org.ownerId === userId);
    }
  },

  /**
   * Upgrade organization plan
   */
  async upgradePlan(id: string, plan: OrgPlan, stripeSubscriptionId?: string): Promise<Organization | null> {
    return this.update(id, {
      plan,
      limits: { ...PLAN_LIMITS[plan] },
      stripeSubscriptionId,
      planExpiresAt: undefined,
    });
  },

  /**
   * Check if organization can perform action
   */
  async checkLimit(id: string, resource: keyof Organization['limits']): Promise<{ allowed: boolean; current: number; max: number }> {
    const org = await this.get(id);
    if (!org) return { allowed: false, current: 0, max: 0 };
    
    const max = org.limits[resource];
    let current = 0;
    
    switch (resource) {
      case 'maxUsers':
        current = org.usage.currentUsers;
        break;
      case 'maxAgents':
        current = org.usage.currentAgents;
        break;
      case 'maxExecutionsPerMonth':
        current = org.usage.executionsThisMonth;
        break;
      case 'maxStorageGB':
        current = org.usage.storageUsedGB;
        break;
      default:
        current = 0;
    }
    
    const allowed = max === -1 || current < max;
    
    return { allowed, current, max };
  },

  /**
   * Increment usage
   */
  async incrementUsage(id: string, resource: keyof Organization['usage'], amount = 1): Promise<void> {
    const org = await this.get(id);
    if (!org) return;
    
    const updated = { ...org.usage };
    (updated as any)[resource] = ((org.usage as any)[resource] || 0) + amount;
    
    await this.update(id, { usage: updated });
    
    // Check if approaching limit and send alert
    const limitKey = `max${resource.charAt(0).toUpperCase()}${resource.slice(1).replace('current', '')}` as keyof Organization['limits'];
    const limit = org.limits[limitKey];
    if (limit !== -1 && (updated as any)[resource] >= limit * 0.9) {
      logger.warn(`Organization approaching limit: ${resource}`, {
        orgId: id,
        current: (updated as any)[resource],
        limit,
      });
    }
  },

  // ─── Team Management ─────────────────────────────────────────

  /**
   * Create a team
   */
  async createTeam(data: {
    organizationId: string;
    name: string;
    description?: string;
    isDefault?: boolean;
  }): Promise<Team> {
    const team: Team = {
      id: generateId('team'),
      organizationId: data.organizationId,
      name: data.name,
      description: data.description,
      permissions: {
        canCreateAgents: true,
        canDeployAgents: true,
        canAccessBilling: false,
        canManageMembers: false,
        canAccessAnalytics: true,
      },
      memberCount: 0,
      agentCount: 0,
      isDefault: data.isDefault || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    teamsCache.set(team.id, team);
    
    try {
      const db = getFirestore();
      await db.collection(TEAMS_COLLECTION).doc(team.id).set(team);
    } catch {
      // Firestore unavailable
    }
    
    logger.info(`👥 Team created: ${team.name}`, { teamId: team.id, orgId: data.organizationId });
    return team;
  },

  /**
   * Get team by ID
   */
  async getTeam(id: string): Promise<Team | null> {
    if (teamsCache.has(id)) {
      return teamsCache.get(id)!;
    }
    
    try {
      const db = getFirestore();
      const doc = await db.collection(TEAMS_COLLECTION).doc(id).get();
      if (doc.exists) {
        const team = doc.data() as Team;
        teamsCache.set(id, team);
        return team;
      }
    } catch {
      // Firestore unavailable
    }
    
    return null;
  },

  /**
   * Get teams for an organization
   */
  async getTeams(organizationId: string): Promise<Team[]> {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(TEAMS_COLLECTION)
        .where('organizationId', '==', organizationId)
        .get();
      
      const teams = snapshot.docs.map(d => d.data() as Team);
      teams.forEach(t => teamsCache.set(t.id, t));
      return teams;
    } catch {
      return Array.from(teamsCache.values())
        .filter(t => t.organizationId === organizationId);
    }
  },

  /**
   * Update team
   */
  async updateTeam(id: string, updates: Partial<Team>): Promise<Team | null> {
    const existing = await this.getTeam(id);
    if (!existing) return null;
    
    const updated: Team = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    teamsCache.set(id, updated);
    
    try {
      const db = getFirestore();
      await db.collection(TEAMS_COLLECTION).doc(id).update({
        ...updates,
        updatedAt: updated.updatedAt,
      });
    } catch {
      // Firestore unavailable
    }
    
    return updated;
  },

  /**
   * Delete team
   */
  async deleteTeam(id: string): Promise<boolean> {
    teamsCache.delete(id);
    
    try {
      const db = getFirestore();
      await db.collection(TEAMS_COLLECTION).doc(id).delete();
    } catch {
      // Firestore unavailable
    }
    
    return true;
  },

  // ─── Membership Management ───────────────────────────────────

  /**
   * Add member to organization
   */
  async addMember(data: {
    organizationId: string;
    userId: string;
    email: string;
    role: OrgRole;
    teamIds: string[];
    invitedBy?: string;
  }): Promise<OrgMembership> {
    const membership: OrgMembership = {
      id: generateId('member'),
      organizationId: data.organizationId,
      userId: data.userId,
      email: data.email,
      role: data.role,
      teamIds: data.teamIds,
      invitedBy: data.invitedBy,
      invitedAt: data.invitedBy ? new Date().toISOString() : undefined,
      status: data.invitedBy ? 'pending' : 'active',
      acceptedAt: data.invitedBy ? undefined : new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    membershipsCache.set(membership.id, membership);
    
    try {
      const db = getFirestore();
      await db.collection(MEMBERSHIPS_COLLECTION).doc(membership.id).set(membership);
      
      // Increment user count
      await this.incrementUsage(data.organizationId, 'currentUsers', 1);
    } catch {
      // Firestore unavailable
    }
    
    logger.info(`👤 Member added to organization`, { 
      membershipId: membership.id, 
      orgId: data.organizationId,
      role: data.role,
    });
    
    return membership;
  },

  /**
   * Get membership
   */
  async getMembership(id: string): Promise<OrgMembership | null> {
    if (membershipsCache.has(id)) {
      return membershipsCache.get(id)!;
    }
    
    try {
      const db = getFirestore();
      const doc = await db.collection(MEMBERSHIPS_COLLECTION).doc(id).get();
      if (doc.exists) {
        const membership = doc.data() as OrgMembership;
        membershipsCache.set(id, membership);
        return membership;
      }
    } catch {
      // Firestore unavailable
    }
    
    return null;
  },

  /**
   * Get membership by user and org
   */
  async getMembershipByUser(organizationId: string, userId: string): Promise<OrgMembership | null> {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(MEMBERSHIPS_COLLECTION)
        .where('organizationId', '==', organizationId)
        .where('userId', '==', userId)
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        const membership = snapshot.docs[0].data() as OrgMembership;
        membershipsCache.set(membership.id, membership);
        return membership;
      }
    } catch {
      for (const m of membershipsCache.values()) {
        if (m.organizationId === organizationId && m.userId === userId) {
          return m;
        }
      }
    }
    
    return null;
  },

  /**
   * Get members of an organization
   */
  async getMembers(organizationId: string): Promise<OrgMembership[]> {
    try {
      const db = getFirestore();
      const snapshot = await db.collection(MEMBERSHIPS_COLLECTION)
        .where('organizationId', '==', organizationId)
        .get();
      
      const members = snapshot.docs.map(d => d.data() as OrgMembership);
      members.forEach(m => membershipsCache.set(m.id, m));
      return members;
    } catch {
      return Array.from(membershipsCache.values())
        .filter(m => m.organizationId === organizationId);
    }
  },

  /**
   * Update membership
   */
  async updateMembership(id: string, updates: Partial<OrgMembership>): Promise<OrgMembership | null> {
    const existing = await this.getMembership(id);
    if (!existing) return null;
    
    const updated: OrgMembership = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    membershipsCache.set(id, updated);
    
    try {
      const db = getFirestore();
      await db.collection(MEMBERSHIPS_COLLECTION).doc(id).update({
        ...updates,
        updatedAt: updated.updatedAt,
      });
    } catch {
      // Firestore unavailable
    }
    
    return updated;
  },

  /**
   * Accept invitation
   */
  async acceptInvitation(id: string): Promise<OrgMembership | null> {
    return this.updateMembership(id, {
      status: 'active',
      acceptedAt: new Date().toISOString(),
    });
  },

  /**
   * Remove member
   */
  async removeMember(id: string): Promise<boolean> {
    const membership = await this.getMembership(id);
    if (membership) {
      await this.incrementUsage(membership.organizationId, 'currentUsers', -1);
    }
    
    membershipsCache.delete(id);
    
    try {
      const db = getFirestore();
      await db.collection(MEMBERSHIPS_COLLECTION).doc(id).delete();
    } catch {
      // Firestore unavailable
    }
    
    return true;
  },

  /**
   * Check if user has permission in organization
   */
  async hasPermission(organizationId: string, userId: string, permission: keyof Team['permissions'] | 'isAdmin' | 'isOwner'): Promise<boolean> {
    const membership = await this.getMembershipByUser(organizationId, userId);
    if (!membership || membership.status !== 'active') return false;
    
    const role = membership.role;
    
    // Check for owner permission
    if (permission === 'isOwner') {
      return role === 'owner';
    }
    
    // Owner has all permissions
    if (role === 'owner') {
      return true;
    }
    
    // Check for admin permission
    if (permission === 'isAdmin') {
      return role === 'admin';
    }
    
    // Admin has most permissions
    if (role === 'admin') {
      return true;
    }
    
    // Check team permissions for members and viewers
    for (const teamId of membership.teamIds) {
      const team = await this.getTeam(teamId);
      if (team && team.permissions[permission as keyof Team['permissions']]) {
        return true;
      }
    }
    
    return false;
  },

  // ─── SSO Configuration ───────────────────────────────────────

  /**
   * Configure SSO for organization
   */
  async configureSso(id: string, ssoConfig: Organization['sso']): Promise<Organization | null> {
    return this.update(id, { sso: ssoConfig });
  },

  /**
   * Validate SSO domain
   */
  async validateSsoDomain(email: string): Promise<Organization | null> {
    const domain = email.split('@')[1];
    if (!domain) return null;
    
    try {
      const db = getFirestore();
      const snapshot = await db.collection(ORGS_COLLECTION)
        .where('sso.enabled', '==', true)
        .where('sso.domain', '==', domain)
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        const org = snapshot.docs[0].data() as Organization;
        orgsCache.set(org.id, org);
        return org;
      }
    } catch {
      for (const org of orgsCache.values()) {
        if (org.sso?.enabled && org.sso.domain === domain) {
          return org;
        }
      }
    }
    
    return null;
  },
};
