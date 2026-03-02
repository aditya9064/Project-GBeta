/* ═══════════════════════════════════════════════════════════
   Crew Management Routes — Create and manage agent crews/teams

   POST   /api/crews                    — Create a new crew
   GET    /api/crews                    — List user's crews
   GET    /api/crews/:id                — Get crew details
   PUT    /api/crews/:id                — Update crew
   DELETE /api/crews/:id                — Archive crew
   POST   /api/crews/:id/members        — Add member to crew
   DELETE /api/crews/:id/members/:agentId — Remove member
   PUT    /api/crews/:id/members/:agentId — Update member role
   PUT    /api/crews/:id/context        — Update shared context
   ═══════════════════════════════════════════════════════════ */

import { Router, Request, Response } from 'express';
import { CrewStore, type CrewMember, type StoredCrew } from '../services/crewStore.js';
import { logger } from '../services/logger.js';

const router = Router();

const DEFAULT_USER = 'demo-user-123';

/* ─── POST /api/crews — Create a new crew ─────────────────── */

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, members, settings, userId } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: 'Missing required field: name' });
      return;
    }

    const crew = await CrewStore.create({
      name,
      description: description || '',
      ownerId: userId || DEFAULT_USER,
      members: members || [],
      settings,
    });

    logger.info(`👥 Crew created: "${name}" (${crew.id})`);

    res.json({
      success: true,
      data: crew,
    });
  } catch (err) {
    logger.error('Crew create error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create crew',
    });
  }
});

/* ─── GET /api/crews — List crews ─────────────────────────── */

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = String(req.query.userId || DEFAULT_USER);
    const crews = await CrewStore.getByUser(userId);

    res.json({
      success: true,
      data: crews,
    });
  } catch (err) {
    logger.error('Crew list error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to list crews',
    });
  }
});

/* ─── GET /api/crews/:id — Get crew details ────────────────── */

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const crew = await CrewStore.get(String(req.params.id));
    if (!crew) {
      res.status(404).json({ success: false, error: 'Crew not found' });
      return;
    }

    res.json({ success: true, data: crew });
  } catch (err) {
    logger.error('Crew get error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get crew',
    });
  }
});

/* ─── PUT /api/crews/:id — Update crew ─────────────────────── */

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, description, settings, status } = req.body;
    const update: Partial<StoredCrew> = {};
    
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (settings !== undefined) update.settings = settings;
    if (status !== undefined) update.status = status;

    const crew = await CrewStore.update(String(req.params.id), update);
    if (!crew) {
      res.status(404).json({ success: false, error: 'Crew not found' });
      return;
    }

    logger.info(`👥 Crew updated: ${crew.name} (${crew.id})`);

    res.json({ success: true, data: crew });
  } catch (err) {
    logger.error('Crew update error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update crew',
    });
  }
});

/* ─── DELETE /api/crews/:id — Archive crew ─────────────────── */

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await CrewStore.archive(String(req.params.id));
    res.json({ success: true });
  } catch (err) {
    logger.error('Crew archive error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to archive crew',
    });
  }
});

/* ─── POST /api/crews/:id/members — Add member ─────────────── */

router.post('/:id/members', async (req: Request, res: Response) => {
  try {
    const { agentId, agentName, role, permissions } = req.body;

    if (!agentId || !agentName) {
      res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: agentId, agentName' 
      });
      return;
    }

    const member: CrewMember = {
      agentId,
      agentName,
      role: role || 'specialist',
      joinedAt: new Date().toISOString(),
      permissions: permissions || ['execute'],
    };

    const crew = await CrewStore.addMember(String(req.params.id), member);
    if (!crew) {
      res.status(404).json({ success: false, error: 'Crew not found' });
      return;
    }

    logger.info(`👤 Member added to crew ${crew.name}: ${agentName} as ${member.role}`);

    res.json({ success: true, data: crew });
  } catch (err) {
    logger.error('Add member error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add member',
    });
  }
});

/* ─── DELETE /api/crews/:id/members/:agentId — Remove member ── */

router.delete('/:id/members/:agentId', async (req: Request, res: Response) => {
  try {
    const crew = await CrewStore.removeMember(
      String(req.params.id),
      String(req.params.agentId)
    );
    if (!crew) {
      res.status(404).json({ success: false, error: 'Crew not found' });
      return;
    }

    logger.info(`👤 Member removed from crew ${crew.name}: ${req.params.agentId}`);

    res.json({ success: true, data: crew });
  } catch (err) {
    logger.error('Remove member error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove member',
    });
  }
});

/* ─── PUT /api/crews/:id/members/:agentId — Update member ──── */

router.put('/:id/members/:agentId', async (req: Request, res: Response) => {
  try {
    const { role, permissions } = req.body;
    const update: Partial<CrewMember> = {};
    
    if (role !== undefined) update.role = role;
    if (permissions !== undefined) update.permissions = permissions;

    const crew = await CrewStore.updateMember(
      String(req.params.id),
      String(req.params.agentId),
      update
    );
    if (!crew) {
      res.status(404).json({ success: false, error: 'Crew or member not found' });
      return;
    }

    res.json({ success: true, data: crew });
  } catch (err) {
    logger.error('Update member error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update member',
    });
  }
});

/* ─── PUT /api/crews/:id/context — Update shared context ───── */

router.put('/:id/context', async (req: Request, res: Response) => {
  try {
    const { context } = req.body;
    if (!context || typeof context !== 'object') {
      res.status(400).json({ success: false, error: 'Invalid context object' });
      return;
    }

    await CrewStore.updateSharedContext(String(req.params.id), context);
    const crew = await CrewStore.get(String(req.params.id));

    res.json({ success: true, data: crew });
  } catch (err) {
    logger.error('Update context error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update context',
    });
  }
});

/* ─── POST /api/crews/:id/execute — Execute a task with crew ── */

router.post('/:id/execute', async (req: Request, res: Response) => {
  try {
    const crew = await CrewStore.get(String(req.params.id));
    if (!crew) {
      res.status(404).json({ success: false, error: 'Crew not found' });
      return;
    }

    const { goal, inputData } = req.body;
    if (!goal) {
      res.status(400).json({ success: false, error: 'Missing required field: goal' });
      return;
    }

    const startTime = Date.now();

    // Find the manager agent
    const manager = crew.members.find(m => m.role === 'manager');
    if (!manager) {
      res.status(400).json({ 
        success: false, 
        error: 'Crew must have at least one manager agent' 
      });
      return;
    }

    // Return execution info - actual execution will be handled by crewExecutor on frontend
    res.json({
      success: true,
      data: {
        crewId: crew.id,
        crewName: crew.name,
        goal,
        inputData,
        manager: manager.agentId,
        specialists: crew.members.filter(m => m.role === 'specialist').map(m => m.agentId),
        reviewers: crew.members.filter(m => m.role === 'reviewer').map(m => m.agentId),
        settings: crew.settings,
        startedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error('Crew execute error:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to execute crew task',
    });
  }
});

export { router as crewsRouter };
