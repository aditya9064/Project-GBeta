/* ═══════════════════════════════════════════════════════════
   RBAC Service — Role-Based Access Control
   
   Manages user roles, permissions, and access control for
   agents, crews, templates, and workforce features.
   
   Roles:
   - admin: Full access to everything
   - manager: Can manage agents, crews, view all metrics
   - operator: Can run agents, view own metrics
   - viewer: Read-only access
   
   Collection: user_roles/{userId}
   ═══════════════════════════════════════════════════════════ */

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { logger } from './logger.js';

const ROLES_COLLECTION = 'user_roles';
const TEAMS_COLLECTION = 'teams';

let firebaseApp: App | null = null;
let firestoreDb: Firestore | null = null;
let firestoreAvailable: boolean | null = null;

const memoryRoles = new Map<string, UserRole>();
const memoryTeams = new Map<string, Team>();

async function isFirestoreAvailable(): Promise<boolean> {
  if (firestoreAvailable !== null) return firestoreAvailable;
  
  try {
    const db = getDb();
    await db.collection(ROLES_COLLECTION).limit(1).get();
    firestoreAvailable = true;
    return true;
  } catch {
    logger.warn('⚠️  RBACService: Firestore unavailable, using in-memory fallback');
    firestoreAvailable = false;
    return false;
  }
}

function getDb(): Firestore {
  if (firestoreDb) return firestoreDb;
  
  try {
    if (getApps().length === 0) {
      firebaseApp = initializeApp();
    } else {
      firebaseApp = getApps()[0];
    }
    firestoreDb = getFirestore(firebaseApp);
    firestoreDb.settings({ ignoreUndefinedProperties: true });
    return firestoreDb;
  } catch (err: any) {
    throw new Error(`Firestore not available: ${err.message}`);
  }
}

export type RoleType = 'admin' | 'manager' | 'operator' | 'viewer';

export type Permission = 
  | 'agents:create'
  | 'agents:read'
  | 'agents:update'
  | 'agents:delete'
  | 'agents:execute'
  | 'crews:create'
  | 'crews:read'
  | 'crews:update'
  | 'crews:delete'
  | 'crews:execute'
  | 'templates:create'
  | 'templates:read'
  | 'templates:publish'
  | 'templates:delete'
  | 'metrics:read'
  | 'metrics:read_all'
  | 'budget:read'
  | 'budget:update'
  | 'escalations:read'
  | 'escalations:resolve'
  | 'escalations:assign'
  | 'analytics:read'
  | 'analytics:export'
  | 'team:manage'
  | 'users:manage';

export type Resource = 'agent' | 'crew' | 'template' | 'escalation' | 'budget' | 'analytics' | 'team';

const ROLE_PERMISSIONS: Record<RoleType, Permission[]> = {
  admin: [
    'agents:create', 'agents:read', 'agents:update', 'agents:delete', 'agents:execute',
    'crews:create', 'crews:read', 'crews:update', 'crews:delete', 'crews:execute',
    'templates:create', 'templates:read', 'templates:publish', 'templates:delete',
    'metrics:read', 'metrics:read_all',
    'budget:read', 'budget:update',
    'escalations:read', 'escalations:resolve', 'escalations:assign',
    'analytics:read', 'analytics:export',
    'team:manage', 'users:manage',
  ],
  manager: [
    'agents:create', 'agents:read', 'agents:update', 'agents:delete', 'agents:execute',
    'crews:create', 'crews:read', 'crews:update', 'crews:delete', 'crews:execute',
    'templates:create', 'templates:read', 'templates:publish',
    'metrics:read', 'metrics:read_all',
    'budget:read', 'budget:update',
    'escalations:read', 'escalations:resolve', 'escalations:assign',
    'analytics:read', 'analytics:export',
    'team:manage',
  ],
  operator: [
    'agents:create', 'agents:read', 'agents:update', 'agents:execute',
    'crews:read', 'crews:execute',
    'templates:create', 'templates:read',
    'metrics:read',
    'budget:read',
    'escalations:read', 'escalations:resolve',
    'analytics:read',
  ],
  viewer: [
    'agents:read',
    'crews:read',
    'templates:read',
    'metrics:read',
    'analytics:read',
  ],
};

export interface UserRole {
  userId: string;
  email?: string;
  displayName?: string;
  role: RoleType;
  teamId?: string;
  customPermissions?: Permission[];
  resourceAccess?: {
    agents?: string[]; // Specific agent IDs this user can access
    crews?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  memberIds: string[];
  sharedAgentIds: string[];
  sharedCrewIds: string[];
  settings: {
    allowMemberAgentCreation: boolean;
    allowMemberCrewCreation: boolean;
    defaultMemberRole: RoleType;
  };
  createdAt: string;
  updatedAt: string;
}

function generateTeamId(): string {
  return `team-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

export const RBACService = {
  /** Get user role */
  async getUserRole(userId: string): Promise<UserRole> {
    let role = memoryRoles.get(userId);
    
    if (!role && await isFirestoreAvailable()) {
      const db = getDb();
      const doc = await db.collection(ROLES_COLLECTION).doc(userId).get();
      if (doc.exists) {
        role = doc.data() as UserRole;
        memoryRoles.set(userId, role);
      }
    }
    
    if (!role) {
      // Default to operator role
      role = {
        userId,
        role: 'operator',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await this.saveUserRole(role);
    }
    
    return role;
  },

  /** Save user role */
  async saveUserRole(role: UserRole): Promise<void> {
    role.updatedAt = new Date().toISOString();
    memoryRoles.set(role.userId, role);
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      await db.collection(ROLES_COLLECTION).doc(role.userId).set(role);
    }
  },

  /** Set user role */
  async setUserRole(userId: string, roleType: RoleType, adminUserId?: string): Promise<UserRole> {
    // Check if admin is setting the role
    if (adminUserId) {
      const adminRole = await this.getUserRole(adminUserId);
      if (!this.hasPermission(adminRole, 'users:manage')) {
        throw new Error('Permission denied: cannot manage users');
      }
    }
    
    const existingRole = await this.getUserRole(userId);
    existingRole.role = roleType;
    await this.saveUserRole(existingRole);
    
    logger.info(`👤 User role set: ${userId} -> ${roleType}`);
    return existingRole;
  },

  /** Check if user has permission */
  hasPermission(userRole: UserRole, permission: Permission): boolean {
    const rolePermissions = ROLE_PERMISSIONS[userRole.role] || [];
    
    // Check role permissions
    if (rolePermissions.includes(permission)) {
      return true;
    }
    
    // Check custom permissions
    if (userRole.customPermissions?.includes(permission)) {
      return true;
    }
    
    return false;
  },

  /** Check if user can access a specific resource */
  async canAccessResource(
    userId: string, 
    resource: Resource, 
    resourceId: string, 
    action: 'read' | 'write' | 'execute' | 'delete'
  ): Promise<boolean> {
    const userRole = await this.getUserRole(userId);
    
    // Map action to permission
    const permissionMap: Record<Resource, Record<string, Permission>> = {
      agent: { read: 'agents:read', write: 'agents:update', execute: 'agents:execute', delete: 'agents:delete' },
      crew: { read: 'crews:read', write: 'crews:update', execute: 'crews:execute', delete: 'crews:delete' },
      template: { read: 'templates:read', write: 'templates:create', execute: 'templates:read', delete: 'templates:delete' },
      escalation: { read: 'escalations:read', write: 'escalations:resolve', execute: 'escalations:resolve', delete: 'escalations:resolve' },
      budget: { read: 'budget:read', write: 'budget:update', execute: 'budget:read', delete: 'budget:update' },
      analytics: { read: 'analytics:read', write: 'analytics:export', execute: 'analytics:read', delete: 'analytics:read' },
      team: { read: 'team:manage', write: 'team:manage', execute: 'team:manage', delete: 'team:manage' },
    };
    
    const permission = permissionMap[resource]?.[action];
    if (!permission) return false;
    
    // Check general permission
    if (!this.hasPermission(userRole, permission)) {
      return false;
    }
    
    // Check resource-specific access (for operators)
    if (userRole.role === 'operator') {
      if (resource === 'agent' && userRole.resourceAccess?.agents) {
        return userRole.resourceAccess.agents.includes(resourceId);
      }
      if (resource === 'crew' && userRole.resourceAccess?.crews) {
        return userRole.resourceAccess.crews.includes(resourceId);
      }
    }
    
    return true;
  },

  /** Grant specific resource access to user */
  async grantResourceAccess(
    userId: string, 
    resource: 'agent' | 'crew', 
    resourceId: string
  ): Promise<void> {
    const userRole = await this.getUserRole(userId);
    
    if (!userRole.resourceAccess) {
      userRole.resourceAccess = {};
    }
    
    if (resource === 'agent') {
      userRole.resourceAccess.agents = userRole.resourceAccess.agents || [];
      if (!userRole.resourceAccess.agents.includes(resourceId)) {
        userRole.resourceAccess.agents.push(resourceId);
      }
    } else if (resource === 'crew') {
      userRole.resourceAccess.crews = userRole.resourceAccess.crews || [];
      if (!userRole.resourceAccess.crews.includes(resourceId)) {
        userRole.resourceAccess.crews.push(resourceId);
      }
    }
    
    await this.saveUserRole(userRole);
  },

  /** Revoke specific resource access */
  async revokeResourceAccess(
    userId: string, 
    resource: 'agent' | 'crew', 
    resourceId: string
  ): Promise<void> {
    const userRole = await this.getUserRole(userId);
    
    if (resource === 'agent' && userRole.resourceAccess?.agents) {
      userRole.resourceAccess.agents = userRole.resourceAccess.agents.filter(id => id !== resourceId);
    } else if (resource === 'crew' && userRole.resourceAccess?.crews) {
      userRole.resourceAccess.crews = userRole.resourceAccess.crews.filter(id => id !== resourceId);
    }
    
    await this.saveUserRole(userRole);
  },

  /** Create a team */
  async createTeam(data: Omit<Team, 'id' | 'createdAt' | 'updatedAt'>): Promise<Team> {
    const team: Team = {
      ...data,
      id: generateTeamId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    memoryTeams.set(team.id, team);
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      await db.collection(TEAMS_COLLECTION).doc(team.id).set(team);
    }
    
    // Set owner as admin
    const ownerRole = await this.getUserRole(data.ownerId);
    ownerRole.teamId = team.id;
    if (ownerRole.role !== 'admin') {
      ownerRole.role = 'manager';
    }
    await this.saveUserRole(ownerRole);
    
    logger.info(`👥 Team created: ${team.name}`);
    return team;
  },

  /** Get team */
  async getTeam(teamId: string): Promise<Team | null> {
    let team = memoryTeams.get(teamId);
    
    if (!team && await isFirestoreAvailable()) {
      const db = getDb();
      const doc = await db.collection(TEAMS_COLLECTION).doc(teamId).get();
      if (doc.exists) {
        team = doc.data() as Team;
        memoryTeams.set(teamId, team);
      }
    }
    
    return team || null;
  },

  /** Add member to team */
  async addTeamMember(teamId: string, userId: string, role?: RoleType): Promise<void> {
    const team = await this.getTeam(teamId);
    if (!team) throw new Error('Team not found');
    
    if (!team.memberIds.includes(userId)) {
      team.memberIds.push(userId);
      team.updatedAt = new Date().toISOString();
      memoryTeams.set(teamId, team);
      
      if (await isFirestoreAvailable()) {
        const db = getDb();
        await db.collection(TEAMS_COLLECTION).doc(teamId).set(team);
      }
    }
    
    // Set user's team and role
    const userRole = await this.getUserRole(userId);
    userRole.teamId = teamId;
    userRole.role = role || team.settings.defaultMemberRole;
    await this.saveUserRole(userRole);
    
    logger.info(`👥 User ${userId} added to team ${team.name}`);
  },

  /** Remove member from team */
  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    const team = await this.getTeam(teamId);
    if (!team) throw new Error('Team not found');
    
    team.memberIds = team.memberIds.filter(id => id !== userId);
    team.updatedAt = new Date().toISOString();
    memoryTeams.set(teamId, team);
    
    if (await isFirestoreAvailable()) {
      const db = getDb();
      await db.collection(TEAMS_COLLECTION).doc(teamId).set(team);
    }
    
    // Remove team from user's role
    const userRole = await this.getUserRole(userId);
    userRole.teamId = undefined;
    await this.saveUserRole(userRole);
    
    logger.info(`👥 User ${userId} removed from team ${team.name}`);
  },

  /** List team members */
  async listTeamMembers(teamId: string): Promise<UserRole[]> {
    const team = await this.getTeam(teamId);
    if (!team) return [];
    
    const members: UserRole[] = [];
    for (const memberId of team.memberIds) {
      const role = await this.getUserRole(memberId);
      members.push(role);
    }
    
    return members;
  },

  /** Get all permissions for a role */
  getRolePermissions(role: RoleType): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
  },

  /** Get all available roles */
  getAvailableRoles(): RoleType[] {
    return ['admin', 'manager', 'operator', 'viewer'];
  },
};
