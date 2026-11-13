import { Router } from 'express';
import { SearchController } from './search.controller.js';
import { requireAuth, requireRole } from '../../shared/presentation/auth.middleware.js';

export function createSearchRouter(controller: SearchController): Router {
  const router = Router();

  // Public search query
  router.get('/', controller.search);

  // Backoffice search document CRUD
  router.get('/documents', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.listDocuments);
  router.post('/documents', requireAuth, requireRole(['ADMIN']), controller.createDocument);
  router.get('/documents/:id', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.getDocumentById);
  router.put('/documents/:id', requireAuth, requireRole(['ADMIN']), controller.updateDocument);
  router.patch('/documents/:id', requireAuth, requireRole(['ADMIN']), controller.updateDocument);
  router.delete('/documents/:id', requireAuth, requireRole(['ADMIN']), controller.deleteDocument);

  // Explicit backoffice path aliases
  router.get('/backoffice/documents', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.listDocuments);
  router.post('/backoffice/documents', requireAuth, requireRole(['ADMIN']), controller.createDocument);
  router.get('/backoffice/documents/:id', requireAuth, requireRole(['ADMIN', 'SUPPORT']), controller.getDocumentById);
  router.put('/backoffice/documents/:id', requireAuth, requireRole(['ADMIN']), controller.updateDocument);
  router.patch('/backoffice/documents/:id', requireAuth, requireRole(['ADMIN']), controller.updateDocument);
  router.delete('/backoffice/documents/:id', requireAuth, requireRole(['ADMIN']), controller.deleteDocument);

  return router;
}
