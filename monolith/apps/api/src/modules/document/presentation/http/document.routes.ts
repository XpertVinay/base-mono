import { Router } from 'express';
import { DocumentController } from './document.controller.js';
import { authenticate, requireRole } from '../../../../shared/presentation/auth.middleware.js';

export function createDocumentRouter(controller: DocumentController): Router {
  const router = Router();

  // All document vault access requires authentication
  router.use(authenticate);

  // Upload document
  router.post('/', controller.upload);

  // Verify document (Admin or Legal roles only)
  router.patch('/:id/verify', requireRole('ADMIN', 'LEGAL'), controller.verify);

  // List documents for property
  router.get('/property/:propertyId', controller.listByProperty);

  return router;
}
