/* ═══════════════════════════════════════════════════════════
   RBAC Routes — Role and permission management
   
   GET    /api/rbac/roles              — List available roles
   GET    /api/rbac/users/:id          — Get user role
   PUT    /api/rbac/users/:id          — Update user role
   POST   /api/rbac/users/:id/grant    — Grant resource access
   POST   /api/rbac/users/:id/revoke   — Revoke resource access
   GET    /api/rbac/teams              — List teams
   POST   /api/rbac/teams              — Create team
   GET    /api/rbac/teams/:id          — Get team
   POST   /api/rbac/teams/:id/members  — Add team member
   DELETE /api/rbac/teams/:id/members  — Remove team member
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { RBACService, type RoleType } from '../services/rbacService.js';
import { requireAdmin, requireManager } from '../middleware/rbac.js';
import { logger } from '../services/logger.js';

const router = Router();

/* ─── GET /api/rbac/roles — List available roles ───────────── */

router.get('/roles', (_req: Request, res: Response) => {
  const roles = RBACService.getAvailableRoles();
  const rolesWithPermissions = roles.map(role => ({
    role,
    permissions: RBACService.getRolePermissions(role),
  }));
  
  res.json({ success: true, data: rolesWithPermissions });
});

/* ─── GET /api/rbac/users/:id — Get user role ──────────────── */

router.get('/users/:id', async (req: Request, res: Response) => {
  try {
    const userRole = await RBACService.getUserRole(req.params.id as string);
    res.json({ success: true, data: userRole });
  } catch (err) {
    logger.error('Get user role error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get user role',
    });
  }
});

/* ─── PUT /api/rbac/users/:id — Update user role ───────────── */

router.put('/users/:id', requireManager(), async (req: Request, res: Response) => {
  try {
    const { role, customPermissions } = req.body;
    const adminUserId = req.userId;
    
    if (!role) {
      res.status(400).json({
        success: false,
        error: 'Role is required',
      });
      return;
    }
    
    const validRoles = RBACService.getAvailableRoles();
    if (!validRoles.includes(role)) {
      res.status(400).json({
        success: false,
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
      });
      return;
    }
    
    const userRole = await RBACService.setUserRole(req.params.id as string, role as RoleType, adminUserId);
    
    // Update custom permissions if provided
    if (customPermissions) {
      userRole.customPermissions = customPermissions;
      await RBACService.saveUserRole(userRole);
    }
    
    logger.info(`👤 User role updated: ${req.params.id as string} -> ${role}`);
    res.json({ success: true, data: userRole });
  } catch (err) {
    logger.error('Update user role error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update user role',
    });
  }
});

/* ─── POST /api/rbac/users/:id/grant — Grant resource access ─ */

router.post('/users/:id/grant', requireManager(), async (req: Request, res: Response) => {
  try {
    const { resource, resourceId } = req.body;
    
    if (!resource || !resourceId) {
      res.status(400).json({
        success: false,
        error: 'resource and resourceId are required',
      });
      return;
    }
    
    if (resource !== 'agent' && resource !== 'crew') {
      res.status(400).json({
        success: false,
        error: 'resource must be "agent" or "crew"',
      });
      return;
    }
    
    await RBACService.grantResourceAccess(req.params.id as string, resource, resourceId);
    
    logger.info(`✅ Resource access granted: ${req.params.id as string} -> ${resource}:${resourceId}`);
    res.json({ success: true });
  } catch (err) {
    logger.error('Grant access error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to grant access',
    });
  }
});

/* ─── POST /api/rbac/users/:id/revoke — Revoke resource access  */

router.post('/users/:id/revoke', requireManager(), async (req: Request, res: Response) => {
  try {
    const { resource, resourceId } = req.body;
    
    if (!resource || !resourceId) {
      res.status(400).json({
        success: false,
        error: 'resource and resourceId are required',
      });
      return;
    }
    
    await RBACService.revokeResourceAccess(req.params.id as string, resource, resourceId);
    
    logger.info(`🚫 Resource access revoked: ${req.params.id as string} -> ${resource}:${resourceId}`);
    res.json({ success: true });
  } catch (err) {
    logger.error('Revoke access error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to revoke access',
    });
  }
});

/* ─── POST /api/rbac/teams — Create team ───────────────────── */

router.post('/teams', async (req: Request, res: Response) => {
  try {
    const { name, description, ownerId, settings } = req.body;
    
    if (!name || !ownerId) {
      res.status(400).json({
        success: false,
        error: 'name and ownerId are required',
      });
      return;
    }
    
    const team = await RBACService.createTeam({
      name,
      description,
      ownerId,
      memberIds: [ownerId],
      sharedAgentIds: [],
      sharedCrewIds: [],
      settings: settings || {
        allowMemberAgentCreation: true,
        allowMemberCrewCreation: true,
        defaultMemberRole: 'operator',
      },
    });
    
    res.status(201).json({ success: true, data: team });
  } catch (err) {
    logger.error('Create team error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create team',
    });
  }
});

/* ─── GET /api/rbac/teams/:id — Get team ───────────────────── */

router.get('/teams/:id', async (req: Request, res: Response) => {
  try {
    const team = await RBACService.getTeam(req.params.id as string);
    
    if (!team) {
      res.status(404).json({
        success: false,
        error: 'Team not found',
      });
      return;
    }
    
    res.json({ success: true, data: team });
  } catch (err) {
    logger.error('Get team error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get team',
    });
  }
});

/* ─── GET /api/rbac/teams/:id/members — List team members ──── */

router.get('/teams/:id/members', async (req: Request, res: Response) => {
  try {
    const members = await RBACService.listTeamMembers(req.params.id as string);
    res.json({ success: true, data: members });
  } catch (err) {
    logger.error('List team members error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to list members',
    });
  }
});

/* ─── POST /api/rbac/teams/:id/members — Add team member ───── */

router.post('/teams/:id/members', async (req: Request, res: Response) => {
  try {
    const { userId, role } = req.body;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'userId is required',
      });
      return;
    }
    
    await RBACService.addTeamMember(req.params.id as string, userId, role);
    
    res.json({ success: true });
  } catch (err) {
    logger.error('Add team member error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add member',
    });
  }
});

/* ─── DELETE /api/rbac/teams/:id/members — Remove member ───── */

router.delete('/teams/:id/members', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'userId is required',
      });
      return;
    }
    
    await RBACService.removeTeamMember(req.params.id as string, userId);
    
    res.json({ success: true });
  } catch (err) {
    logger.error('Remove team member error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove member',
    });
  }
});

export { router as rbacRouter };
