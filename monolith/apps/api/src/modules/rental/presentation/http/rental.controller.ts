import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CreateListingUseCase } from '../../application/commands/create-listing.use-case.js';
import { CreateLeadUseCase } from '../../application/commands/create-lead.use-case.js';
import { UpdateLeadStatusUseCase } from '../../application/commands/update-lead-status.use-case.js';
import { ListListingsQuery } from '../../application/queries/list-listings.query.js';
import { ListLeadsQuery } from '../../application/queries/list-leads.query.js';
import { getCurrentRequestId } from '../../../../shared/presentation/request-context.js';

const createListingSchema = z.object({
  propertyId: z.string().min(1),
  monthlyRent: z.number().positive(),
  securityDeposit: z.number().min(0),
  leaseDurationMonths: z.number().positive().optional(),
  availableFrom: z.string().optional(),
  permittedUse: z.enum(['RESIDENTIAL', 'COMMERCIAL']).optional(),
  description: z.string().optional()
});

const createLeadSchema = z.object({
  listingId: z.string().min(1),
  tenantName: z.string().min(2),
  tenantPhone: z.string().min(6),
  tenantEmail: z.string().email(),
  offeredRent: z.number().positive().optional(),
  notes: z.string().optional()
});

const updateLeadStatusSchema = z.object({
  status: z.enum([
    'NEW',
    'CONTACTED',
    'QUALIFIED',
    'VISIT_SCHEDULED',
    'NEGOTIATION',
    'DOCUMENTATION',
    'CONVERTED',
    'REJECTED'
  ]),
  scheduledVisitDate: z.string().optional(),
  notes: z.string().optional()
});

export class RentalController {
  constructor(
    private readonly createListingUseCase: CreateListingUseCase,
    private readonly createLeadUseCase: CreateLeadUseCase,
    private readonly updateLeadStatusUseCase: UpdateLeadStatusUseCase,
    private readonly listListingsQuery: ListListingsQuery,
    private readonly listLeadsQuery: ListLeadsQuery
  ) {}

  createListing = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = createListingSchema.parse(req.body);
      const ownerId = req.user!.id;
      const result = await this.createListingUseCase.execute({ ...validated, ownerId });

      if (result.isFailure) return next(result.getError());

      res.status(201).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  createLead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = createLeadSchema.parse(req.body);
      const result = await this.createLeadUseCase.execute(validated);

      if (result.isFailure) return next(result.getError());

      res.status(201).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  updateLeadStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const leadId = String(req.params.id);
      const validated = updateLeadStatusSchema.parse(req.body);

      const result = await this.updateLeadStatusUseCase.execute({ ...validated, leadId });
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  listListings = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listListingsQuery.execute();
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  listLeads = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const listingId = req.query.listingId as string | undefined;
      const propertyId = req.query.propertyId as string | undefined;

      const result = await this.listLeadsQuery.execute({ listingId, propertyId });
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };
}
