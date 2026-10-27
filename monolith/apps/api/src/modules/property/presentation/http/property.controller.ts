import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CreatePropertyUseCase } from '../../application/commands/create-property.use-case.js';
import { UpdatePropertyStatusUseCase } from '../../application/commands/update-property-status.use-case.js';
import { ListPropertiesQuery } from '../../application/queries/list-properties.query.js';
import { GetPropertyDetailsQuery } from '../../application/queries/get-property-details.query.js';
import { getCurrentRequestId } from '../../../../shared/presentation/request-context.js';

const addressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional()
});

const emergencyContactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(6),
  relationship: z.string().min(1)
});

const createPropertySchema = z.object({
  title: z.string().min(3),
  description: z.string().default(''),
  category: z.enum(['RESIDENTIAL', 'COMMERCIAL']),
  propertyType: z.enum(['APARTMENT', 'VILLA', 'INDEPENDENT_HOUSE', 'OFFICE_SPACE', 'RETAIL_SHOP', 'WAREHOUSE', 'LAND_PLOT']),
  address: addressSchema,
  areaSqFt: z.number().positive(),
  amenities: z.array(z.string()).optional(),
  emergencyContact: emergencyContactSchema,
  emergencyFloatLimit: z.number().min(0).optional()
});

const updatePropertyStatusSchema = z.object({
  status: z.enum(['VACANT', 'RENTED', 'UNDER_MAINTENANCE', 'LISTED_FOR_RENT', 'LISTED_FOR_SALE']),
  reason: z.string().optional()
});

export class PropertyController {
  constructor(
    private readonly createPropertyUseCase: CreatePropertyUseCase,
    private readonly updatePropertyStatusUseCase: UpdatePropertyStatusUseCase,
    private readonly listPropertiesQuery: ListPropertiesQuery,
    private readonly getPropertyDetailsQuery: GetPropertyDetailsQuery
  ) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = createPropertySchema.parse(req.body);
      const ownerId = req.user!.id;
      const result = await this.createPropertyUseCase.execute({ ...validated, ownerId });

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

  listMyProperties = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerId = req.user!.id;
      const role = req.user!.role;
      // Admins can see all properties, owners see their own
      const result = await this.listPropertiesQuery.execute(role === 'ADMIN' ? {} : { ownerId, role });

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

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const propertyId = String(req.params.id);
      const result = await this.getPropertyDetailsQuery.execute({ propertyId });

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

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const propertyId = String(req.params.id);
      const validated = updatePropertyStatusSchema.parse(req.body);
      const actorId = req.user!.id;

      const result = await this.updatePropertyStatusUseCase.execute({
        propertyId,
        actorId,
        status: validated.status,
        reason: validated.reason
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
}
