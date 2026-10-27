import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { SubmitRequestUseCase } from '../../application/commands/submit-request.use-case.js';
import { SubmitQuotationUseCase } from '../../application/commands/submit-quotation.use-case.js';
import { ApproveQuotationUseCase } from '../../application/commands/approve-quotation.use-case.js';
import { CompleteWorkUseCase } from '../../application/commands/complete-work.use-case.js';
import { ListMaintenanceQuery } from '../../application/queries/list-maintenance.query.js';
import { getCurrentRequestId } from '../../../../shared/presentation/request-context.js';
import { container } from '../../../../bootstrap/container.js';
import { IPropertyModulePublicApi } from '../../../property/property.module.js';
import { ICaretakingModulePublicApi } from '../../../caretaking/caretaking.module.js';

const submitRequestSchema = z.object({
  propertyId: z.string().min(1),
  category: z.enum([
    'PLUMBING',
    'ELECTRICAL',
    'STRUCTURAL_SEEPAGE',
    'HVAC_COOLING',
    'SECURITY_LOCKS',
    'CARPENTRY',
    'PAINTING_AESTHETICS',
    'APPLIANCE'
  ]),
  title: z.string().min(3),
  description: z.string().default(''),
  photoUrls: z.array(z.string()).optional(),
  reportedUrgency: z.enum(['EMERGENCY', 'URGENT', 'NORMAL', 'LOW']).optional()
});

const submitQuotationSchema = z.object({
  vendorId: z.string().min(1),
  vendorName: z.string().min(1),
  estimatedCost: z.number().positive(),
  breakdown: z.string().min(1)
});

const completeWorkSchema = z.object({
  beforePhotoUrls: z.array(z.string()).min(1),
  afterPhotoUrls: z.array(z.string()).min(1),
  receiptUrls: z.array(z.string()).default([]),
  gpsLatitude: z.number(),
  gpsLongitude: z.number(),
  finalCost: z.number().positive()
});

export class MaintenanceController {
  constructor(
    private readonly submitRequestUseCase: SubmitRequestUseCase,
    private readonly submitQuotationUseCase: SubmitQuotationUseCase,
    private readonly approveQuotationUseCase: ApproveQuotationUseCase,
    private readonly completeWorkUseCase: CompleteWorkUseCase,
    private readonly listMaintenanceQuery: ListMaintenanceQuery
  ) {}

  submit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = submitRequestSchema.parse(req.body);
      const reporterId = req.user!.id;
      const reporterRole = req.user!.role;

      // In-process cross-module synchronous port: get property's configured emergency limit
      let ownerEmergencyLimit = 5000;
      try {
        const propertyApi = container.resolve<IPropertyModulePublicApi>('IPropertyModulePublicApi');
        if (propertyApi) {
          ownerEmergencyLimit = await propertyApi.getEmergencyFloatLimit(validated.propertyId);
        }
      } catch {
        // use default
      }

      const result = await this.submitRequestUseCase.execute({
        ...validated,
        reporterId,
        reporterRole,
        ownerEmergencyLimit
      });

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

  submitQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requestId = String(req.params.id);
      const validated = submitQuotationSchema.parse(req.body);
      const result = await this.submitQuotationUseCase.execute({ ...validated, requestId });

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

  approveQuotation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requestId = String(req.params.id);
      const quotationId = String(req.params.quotationId);
      const actorRole = req.user!.role;
      const actorId = req.user!.id;

      let caretakerSpendingLimit = 0;
      if (actorRole === 'CARETAKER') {
        try {
          const caretakingApi = container.resolve<ICaretakingModulePublicApi>('ICaretakingModulePublicApi');
          if (caretakingApi) {
            caretakerSpendingLimit = await caretakingApi.getSpendingLimit(req.body.propertyId || '', actorId);
          }
        } catch {
          caretakerSpendingLimit = 0;
        }
      }

      const result = await this.approveQuotationUseCase.execute({
        requestId,
        quotationId,
        actorRole,
        caretakerSpendingLimit
      });

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

  completeWork = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requestId = String(req.params.id);
      const validated = completeWorkSchema.parse(req.body);

      const result = await this.completeWorkUseCase.execute({ ...validated, requestId });
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

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const propertyId = req.query.propertyId as string | undefined;
      const reporterId = req.query.my === 'true' ? req.user!.id : undefined;

      const result = await this.listMaintenanceQuery.execute({ propertyId, reporterId });
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
