/* ═══════════════════════════════════════════════════════════
   Organization Routes
   
   API endpoints for multi-tenant organization management.
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { OrganizationService } from '../services/organizationService.js';
import { logger } from '../services/logger.js';

export const organizationsRouter = Router();

// ─── Organization CRUD ─────────────────────────────────────────

/**
 * GET /api/organizations
 * List organizations for current user
 */
organizationsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    
    if (!userId) {
      res.status(400).json({ success: false, error: 'userId required' });
      return;
    }
    
    const organizations = await OrganizationService.listForUser(userId);
    res.json({ success: true, data: organizations });
  } catch (err) {
    logger.error('List organizations error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to list organizations',
    });
  }
});

/**
 * GET /api/organizations/:id
 * Get organization by ID
 */
organizationsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const org = await OrganizationService.get(req.params.id as string);
    
    if (!org) {
      res.status(404).json({ success: false, error: 'Organization not found' });
      return;
    }
    
    res.json({ success: true, data: org });
  } catch (err) {
    logger.error('Get organization error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get organization',
    });
  }
});

/**
 * GET /api/organizations/slug/:slug
 * Get organization by slug
 */
organizationsRouter.get('/slug/:slug', async (req: Request, res: Response) => {
  try {
    const org = await OrganizationService.getBySlug(req.params.slug as string);
    
    if (!org) {
      res.status(404).json({ success: false, error: 'Organization not found' });
      return;
    }
    
    res.json({ success: true, data: org });
  } catch (err) {
    logger.error('Get organization by slug error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get organization',
    });
  }
});

/**
 * POST /api/organizations
 * Create organization
 */
organizationsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, ownerId, plan, billingEmail } = req.body;
    
    if (!name || !ownerId) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: name, ownerId',
      });
      return;
    }
    
    const org = await OrganizationService.create({
      name,
      ownerId,
      plan,
      billingEmail,
    });
    
    res.status(201).json({ success: true, data: org });
  } catch (err) {
    logger.error('Create organization error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create organization',
    });
  }
});

/**
 * PUT /api/organizations/:id
 * Update organization
 */
organizationsRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const org = await OrganizationService.update(req.params.id as string, req.body);
    
    if (!org) {
      res.status(404).json({ success: false, error: 'Organization not found' });
      return;
    }
    
    res.json({ success: true, data: org });
  } catch (err) {
    logger.error('Update organization error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update organization',
    });
  }
});

/**
 * DELETE /api/organizations/:id
 * Delete organization
 */
organizationsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    await OrganizationService.delete(req.params.id as string);
    res.json({ success: true });
  } catch (err) {
    logger.error('Delete organization error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete organization',
    });
  }
});

// ─── Limits & Usage ────────────────────────────────────────────

/**
 * GET /api/organizations/:id/limits
 * Check organization limits
 */
organizationsRouter.get('/:id/limits', async (req: Request, res: Response) => {
  try {
    const org = await OrganizationService.get(req.params.id as string);
    
    if (!org) {
      res.status(404).json({ success: false, error: 'Organization not found' });
      return;
    }
    
    res.json({
      success: true,
      data: {
        plan: org.plan,
        limits: org.limits,
        usage: org.usage,
      },
    });
  } catch (err) {
    logger.error('Get limits error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get limits',
    });
  }
});

/**
 * POST /api/organizations/:id/upgrade
 * Upgrade organization plan
 */
organizationsRouter.post('/:id/upgrade', async (req: Request, res: Response) => {
  try {
    const { plan, stripeSubscriptionId } = req.body;
    
    if (!plan) {
      res.status(400).json({ success: false, error: 'plan required' });
      return;
    }
    
    const org = await OrganizationService.upgradePlan(
      req.params.id as string,
      plan,
      stripeSubscriptionId
    );
    
    if (!org) {
      res.status(404).json({ success: false, error: 'Organization not found' });
      return;
    }
    
    res.json({ success: true, data: org });
  } catch (err) {
    logger.error('Upgrade plan error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to upgrade plan',
    });
  }
});

// ─── Team Management ───────────────────────────────────────────

/**
 * GET /api/organizations/:id/teams
 * List teams in organization
 */
organizationsRouter.get('/:id/teams', async (req: Request, res: Response) => {
  try {
    const teams = await OrganizationService.getTeams(req.params.id as string);
    res.json({ success: true, data: teams });
  } catch (err) {
    logger.error('List teams error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to list teams',
    });
  }
});

/**
 * POST /api/organizations/:id/teams
 * Create team
 */
organizationsRouter.post('/:id/teams', async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      res.status(400).json({ success: false, error: 'name required' });
      return;
    }
    
    const team = await OrganizationService.createTeam({
      organizationId: req.params.id as string,
      name,
      description,
    });
    
    res.status(201).json({ success: true, data: team });
  } catch (err) {
    logger.error('Create team error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create team',
    });
  }
});

/**
 * PUT /api/organizations/:orgId/teams/:teamId
 * Update team
 */
organizationsRouter.put('/:orgId/teams/:teamId', async (req: Request, res: Response) => {
  try {
    const team = await OrganizationService.updateTeam(req.params.teamId as string, req.body);
    
    if (!team) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }
    
    res.json({ success: true, data: team });
  } catch (err) {
    logger.error('Update team error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update team',
    });
  }
});

/**
 * DELETE /api/organizations/:orgId/teams/:teamId
 * Delete team
 */
organizationsRouter.delete('/:orgId/teams/:teamId', async (req: Request, res: Response) => {
  try {
    await OrganizationService.deleteTeam(req.params.teamId as string);
    res.json({ success: true });
  } catch (err) {
    logger.error('Delete team error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete team',
    });
  }
});

// ─── Member Management ─────────────────────────────────────────

/**
 * GET /api/organizations/:id/members
 * List members
 */
organizationsRouter.get('/:id/members', async (req: Request, res: Response) => {
  try {
    const members = await OrganizationService.getMembers(req.params.id as string);
    res.json({ success: true, data: members });
  } catch (err) {
    logger.error('List members error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to list members',
    });
  }
});

/**
 * POST /api/organizations/:id/members
 * Add member (invite)
 */
organizationsRouter.post('/:id/members', async (req: Request, res: Response) => {
  try {
    const { userId, email, role, teamIds, invitedBy } = req.body;
    
    if (!email || !role) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: email, role',
      });
      return;
    }
    
    // Check limit
    const limitCheck = await OrganizationService.checkLimit(req.params.id as string, 'maxUsers');
    if (!limitCheck.allowed) {
      res.status(403).json({
        success: false,
        error: `User limit reached (${limitCheck.current}/${limitCheck.max}). Upgrade your plan.`,
      });
      return;
    }
    
    const membership = await OrganizationService.addMember({
      organizationId: req.params.id as string,
      userId: userId || '',
      email,
      role,
      teamIds: teamIds || [],
      invitedBy,
    });
    
    res.status(201).json({ success: true, data: membership });
  } catch (err) {
    logger.error('Add member error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add member',
    });
  }
});

/**
 * PUT /api/organizations/:orgId/members/:memberId
 * Update member
 */
organizationsRouter.put('/:orgId/members/:memberId', async (req: Request, res: Response) => {
  try {
    const membership = await OrganizationService.updateMembership(
      req.params.memberId as string,
      req.body
    );
    
    if (!membership) {
      res.status(404).json({ success: false, error: 'Member not found' });
      return;
    }
    
    res.json({ success: true, data: membership });
  } catch (err) {
    logger.error('Update member error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update member',
    });
  }
});

/**
 * DELETE /api/organizations/:orgId/members/:memberId
 * Remove member
 */
organizationsRouter.delete('/:orgId/members/:memberId', async (req: Request, res: Response) => {
  try {
    await OrganizationService.removeMember(req.params.memberId as string);
    res.json({ success: true });
  } catch (err) {
    logger.error('Remove member error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove member',
    });
  }
});

/**
 * POST /api/organizations/invitations/:id/accept
 * Accept invitation
 */
organizationsRouter.post('/invitations/:id/accept', async (req: Request, res: Response) => {
  try {
    const membership = await OrganizationService.acceptInvitation(req.params.id as string);
    
    if (!membership) {
      res.status(404).json({ success: false, error: 'Invitation not found' });
      return;
    }
    
    res.json({ success: true, data: membership });
  } catch (err) {
    logger.error('Accept invitation error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to accept invitation',
    });
  }
});

// ─── SSO Configuration ─────────────────────────────────────────

/**
 * PUT /api/organizations/:id/sso
 * Configure SSO
 */
organizationsRouter.put('/:id/sso', async (req: Request, res: Response) => {
  try {
    const ssoConfig = req.body;
    
    if (!ssoConfig.provider) {
      res.status(400).json({ success: false, error: 'provider required' });
      return;
    }
    
    const org = await OrganizationService.configureSso(req.params.id as string, ssoConfig);
    
    if (!org) {
      res.status(404).json({ success: false, error: 'Organization not found' });
      return;
    }
    
    res.json({ success: true, data: org.sso });
  } catch (err) {
    logger.error('Configure SSO error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to configure SSO',
    });
  }
});

/**
 * POST /api/organizations/sso/validate
 * Validate SSO domain for email
 */
organizationsRouter.post('/sso/validate', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      res.status(400).json({ success: false, error: 'email required' });
      return;
    }
    
    const org = await OrganizationService.validateSsoDomain(email);
    
    if (!org) {
      res.json({ success: true, data: { ssoRequired: false } });
      return;
    }
    
    res.json({
      success: true,
      data: {
        ssoRequired: org.sso?.enforced || false,
        provider: org.sso?.provider,
        organizationId: org.id,
        organizationName: org.name,
      },
    });
  } catch (err) {
    logger.error('Validate SSO error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to validate SSO',
    });
  }
});

// ─── Permissions Check ─────────────────────────────────────────

/**
 * POST /api/organizations/:id/check-permission
 * Check if user has permission
 */
organizationsRouter.post('/:id/check-permission', async (req: Request, res: Response) => {
  try {
    const { userId, permission } = req.body;
    
    if (!userId || !permission) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, permission',
      });
      return;
    }
    
    const hasPermission = await OrganizationService.hasPermission(
      req.params.id as string,
      userId,
      permission
    );
    
    res.json({ success: true, data: { hasPermission } });
  } catch (err) {
    logger.error('Check permission error:', { error: err });
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to check permission',
    });
  }
});
