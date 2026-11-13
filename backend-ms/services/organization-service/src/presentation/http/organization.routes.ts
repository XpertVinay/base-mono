import { Router } from 'express';
import { OrganizationController } from './organization.controller.js';
import { requireAuth, requireRole } from '../../shared/presentation/auth.middleware.js';

export function createOrganizationRouter(controller: OrganizationController): Router {
  const router = Router();

  // Organization CRUD
  router.get('/', requireAuth, requireRole(['ADMIN']), controller.list);
  router.post('/', requireAuth, requireRole(['ADMIN']), controller.create);
  router.get('/:idOrSlug', requireAuth, controller.getOne);
  router.put('/:id', requireAuth, requireRole(['ADMIN', 'OWNER']), controller.update);
  router.patch('/:id', requireAuth, requireRole(['ADMIN', 'OWNER']), controller.update);
  router.patch('/:id/status', requireAuth, requireRole(['ADMIN']), controller.updateStatus);
  router.delete('/:id', requireAuth, requireRole(['ADMIN']), controller.delete);

  // Member Management
  router.post('/:id/members', requireAuth, requireRole(['ADMIN', 'OWNER']), controller.addMember);
  router.get('/:id/members', requireAuth, controller.listMembers);
  router.patch('/:id/members/:memberId', requireAuth, requireRole(['ADMIN', 'OWNER']), controller.updateMember);
  router.delete('/:id/members/:memberId', requireAuth, requireRole(['ADMIN', 'OWNER']), controller.removeMember);

  return router;
}
