/* ═══════════════════════════════════════════════════════════
   RBAC Middleware — Permission checking for routes
   ═══════════════════════════════════════════════════════════ */

import { Request, Response, NextFunction } from 'express';
import { RBACService, type Permission, type Resource } from '../services/rbacService.js';
import { logger } from '../services/logger.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: import('../services/rbacService.js').UserRole;
    }
  }
}

/**
 * Middleware to require a specific permission
 */
export function requirePermission(permission: Permission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.query.userId as string || req.body?.userId || req.headers['x-user-id'] as string;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User ID required',
        });
        return;
      }
      
      const userRole = await RBACService.getUserRole(userId);
      req.userId = userId;
      req.userRole = userRole;
      
      if (!RBACService.hasPermission(userRole, permission)) {
        logger.warn(`🚫 Permission denied: ${userId} -> ${permission}`);
        res.status(403).json({
          success: false,
          error: `Permission denied: ${permission}`,
        });
        return;
      }
      
      next();
    } catch (err) {
      logger.error('RBAC middleware error:', err);
      res.status(500).json({
        success: false,
        error: 'Authorization check failed',
      });
    }
  };
}

/**
 * Middleware to require access to a specific resource
 */
export function requireResourceAccess(resource: Resource, action: 'read' | 'write' | 'execute' | 'delete') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.query.userId as string || req.body?.userId || req.headers['x-user-id'] as string;
      const resourceId = req.params.id || req.body?.resourceId;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User ID required',
        });
        return;
      }
      
      if (!resourceId) {
        res.status(400).json({
          success: false,
          error: 'Resource ID required',
        });
        return;
      }
      
      const canAccess = await RBACService.canAccessResource(userId, resource, resourceId, action);
      
      if (!canAccess) {
        logger.warn(`🚫 Resource access denied: ${userId} -> ${resource}:${resourceId} (${action})`);
        res.status(403).json({
          success: false,
          error: `Access denied to ${resource}`,
        });
        return;
      }
      
      req.userId = userId;
      req.userRole = await RBACService.getUserRole(userId);
      next();
    } catch (err) {
      logger.error('RBAC resource check error:', err);
      res.status(500).json({
        success: false,
        error: 'Authorization check failed',
      });
    }
  };
}

/**
 * Middleware to attach user role to request (optional auth)
 */
export async function attachUserRole(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.query.userId as string || req.body?.userId || req.headers['x-user-id'] as string;
    
    if (userId) {
      req.userId = userId;
      req.userRole = await RBACService.getUserRole(userId);
    }
    
    next();
  } catch (err) {
    next();
  }
}

/**
 * Middleware to require admin role
 */
export function requireAdmin() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.query.userId as string || req.body?.userId || req.headers['x-user-id'] as string;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User ID required',
        });
        return;
      }
      
      const userRole = await RBACService.getUserRole(userId);
      
      if (userRole.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin access required',
        });
        return;
      }
      
      req.userId = userId;
      req.userRole = userRole;
      next();
    } catch (err) {
      logger.error('Admin check error:', err);
      res.status(500).json({
        success: false,
        error: 'Authorization check failed',
      });
    }
  };
}

/**
 * Middleware to require manager or higher role
 */
export function requireManager() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.query.userId as string || req.body?.userId || req.headers['x-user-id'] as string;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User ID required',
        });
        return;
      }
      
      const userRole = await RBACService.getUserRole(userId);
      
      if (userRole.role !== 'admin' && userRole.role !== 'manager') {
        res.status(403).json({
          success: false,
          error: 'Manager access required',
        });
        return;
      }
      
      req.userId = userId;
      req.userRole = userRole;
      next();
    } catch (err) {
      logger.error('Manager check error:', err);
      res.status(500).json({
        success: false,
        error: 'Authorization check failed',
      });
    }
  };
}
