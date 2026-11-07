import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CreatePropertyUseCase } from '../../application/commands/create-property.use-case.js';
import { UpdatePropertyStatusUseCase } from '../../application/commands/update-property-status.use-case.js';
import { ListPropertiesQuery } from '../../application/queries/list-properties.query.js';
import { GetPropertyDetailsQuery } from '../../application/queries/get-property-details.query.js';
import {
  CreatePropertyUnitUseCase,
  ListPropertyUnitsQuery,
  UpdateUnitStatusUseCase,
  SetOwnershipSplitsUseCase,
  GetOwnershipSplitsQuery
} from '../../application/commands/property-units.use-cases.js';
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
  emergencyFloatLimit: z.number().min(0).optional(),
  tenantId: z.string().optional()
});

const updatePropertyStatusSchema = z.object({
  status: z.enum(['VACANT', 'RENTED', 'UNDER_MAINTENANCE', 'LISTED_FOR_RENT', 'LISTED_FOR_SALE']),
  reason: z.string().optional()
});

const createUnitSchema = z.object({
  unitNumber: z.string().min(1),
  floor: z.number().optional(),
  rentAmount: z.number().min(0),
  depositAmount: z.number().min(0).optional(),
  areaSqFt: z.number().positive(),
  tenantId: z.string().optional()
});

const updateUnitStatusSchema = z.object({
  status: z.enum(['VACANT', 'OCCUPIED', 'UNDER_MAINTENANCE', 'RESERVED']),
  reason: z.string().optional()
});

const setOwnershipSplitsSchema = z.object({
  splits: z.array(z.object({
    ownerId: z.string().min(1),
    sharePercentage: z.number().positive().max(100),
    disbursementAccount: z.string().optional()
  })).min(1),
  tenantId: z.string().optional()
});

function extractTenantId(req: Request): string | undefined {
  const tenantId = (req as any).tenantId || req.headers['x-tenant-id'];
  if (typeof tenantId === 'string' && tenantId.trim().length > 0) {
    return tenantId.trim();
  }
  return undefined;
}

export class PropertyController {
  constructor(
    private readonly createPropertyUseCase: CreatePropertyUseCase,
    private readonly updatePropertyStatusUseCase: UpdatePropertyStatusUseCase,
    private readonly listPropertiesQuery: ListPropertiesQuery,
    private readonly getPropertyDetailsQuery: GetPropertyDetailsQuery,
    private readonly createUnitUseCase: CreatePropertyUnitUseCase,
    private readonly listUnitsQuery: ListPropertyUnitsQuery,
    private readonly updateUnitStatusUseCase: UpdateUnitStatusUseCase,
    private readonly setOwnershipSplitsUseCase: SetOwnershipSplitsUseCase,
    private readonly getOwnershipSplitsQuery: GetOwnershipSplitsQuery
  ) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = createPropertySchema.parse(req.body);
      const ownerId = req.user?.id || 'SYSTEM_OWNER';
      const tenantId = validated.tenantId || extractTenantId(req);
      const result = await this.createPropertyUseCase.execute({ ...validated, ownerId, tenantId });

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
      const ownerId = req.user?.id;
      const role = req.user?.role;
      const tenantId = extractTenantId(req);

      const result = await this.listPropertiesQuery.execute(
        role === 'ADMIN' ? { tenantId } : { ownerId, role, tenantId }
      );

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
      const tenantId = extractTenantId(req);
      const result = await this.getPropertyDetailsQuery.execute({ propertyId, tenantId });

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
      const actorId = req.user?.id || 'ADMIN';
      const tenantId = extractTenantId(req);

      const result = await this.updatePropertyStatusUseCase.execute({
        propertyId,
        actorId,
        status: validated.status,
        reason: validated.reason,
        tenantId
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

  // ---------------------------------------------------------------------------
  // UNITS
  // ---------------------------------------------------------------------------
  createUnit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const propertyId = String(req.params.id);
      const validated = createUnitSchema.parse(req.body);
      const tenantId = validated.tenantId || extractTenantId(req);

      const result = await this.createUnitUseCase.execute({
        propertyId,
        ...validated,
        tenantId
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

  listUnits = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const propertyId = String(req.params.id);
      const tenantId = extractTenantId(req);

      const result = await this.listUnitsQuery.execute({ propertyId, tenantId });
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

  updateUnitStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const unitId = String(req.params.unitId);
      const validated = updateUnitStatusSchema.parse(req.body);
      const tenantId = extractTenantId(req);

      const result = await this.updateUnitStatusUseCase.execute({
        unitId,
        status: validated.status,
        reason: validated.reason,
        tenantId
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

  // ---------------------------------------------------------------------------
  // OWNERSHIP SPLITS
  // ---------------------------------------------------------------------------
  setOwnershipSplits = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const propertyId = String(req.params.id);
      const validated = setOwnershipSplitsSchema.parse(req.body);
      const tenantId = validated.tenantId || extractTenantId(req);

      const result = await this.setOwnershipSplitsUseCase.execute({
        propertyId,
        splits: validated.splits,
        tenantId
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

  getOwnershipSplits = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const propertyId = String(req.params.id);
      const tenantId = extractTenantId(req);

      const result = await this.getOwnershipSplitsQuery.execute({ propertyId, tenantId });
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
