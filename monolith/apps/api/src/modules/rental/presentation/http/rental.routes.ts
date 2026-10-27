import { Router } from 'express';
import { RentalController } from './rental.controller.js';
import { authenticate, requireRole } from '../../../../shared/presentation/auth.middleware.js';

export function createRentalRouter(controller: RentalController): Router {
  const router = Router();

  // Public listings view for prospective tenants & brokers
  router.get('/listings', controller.listListings);

  // Submit enquiry lead (open to public/prospective tenants)
  router.post('/leads', controller.createLead);

  // Protected operations
  router.use(authenticate);

  // Create rental listing (Owners, Agents, Admins)
  router.post('/listings', requireRole('OWNER', 'AGENT', 'ADMIN'), controller.createListing);

  // Update lead status (Owners, Caretakers, Agents, Admins)
  router.patch('/leads/:id/status', requireRole('OWNER', 'CARETAKER', 'AGENT', 'ADMIN'), controller.updateLeadStatus);

  // View leads pipeline
  router.get('/leads', controller.listLeads);

  return router;
}
