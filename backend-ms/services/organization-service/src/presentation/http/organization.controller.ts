import { Request, Response } from 'express';
import { z } from 'zod';
import {
  CreateOrganizationUseCase,
  GetOrganizationQuery,
  ListOrganizationsQuery,
  UpdateOrganizationUseCase,
  UpdateOrganizationStatusUseCase,
  DeleteOrganizationUseCase,
  AddOrganizationMemberUseCase,
  ListOrganizationMembersQuery,
  UpdateOrganizationMemberRoleUseCase,
  RemoveOrganizationMemberUseCase
} from '../../application/use-cases/organization.use-cases.js';
import { ApiResponse } from '../../shared/presentation/standard-response.js';
import { MemberRole, MemberStatus, OrganizationStatus, OrganizationTier } from '../../shared/contracts/index.js';

const addressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional()
}).optional();

const brandingSchema = z.object({
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().optional(),
  faviconUrl: z.string().url().optional()
}).optional();

const securitySchema = z.object({
  enforceMfa: z.boolean().optional(),
  sessionTtlSeconds: z.number().int().min(60).max(604800).optional(),
  allowedEmailDomains: z.array(z.string()).optional(),
  ipWhitelist: z.array(z.string()).optional()
}).optional();

const settingsSchema = z.object({
  branding: brandingSchema,
  security: securitySchema,
  features: z.record(z.boolean()).optional(),
  customDomain: z.string().optional(),
  maxUsers: z.number().int().positive().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional()
}).optional();

const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(255),
  slug: z.string().min(2, 'Slug must be at least 2 characters').max(100),
  legalName: z.string().max(255).optional(),
  tier: z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as const).optional(),
  industry: z.string().max(100).optional(),
  taxId: z.string().max(100).optional(),
  contactEmail: z.string().email('Valid contact email is required'),
  contactPhone: z.string().max(50).optional(),
  website: z.string().url().optional().or(z.literal('')),
  address: addressSchema,
  settings: settingsSchema,
  maxUsers: z.number().int().positive().optional(),
  initialOwner: z.object({
    userId: z.string().min(1),
    email: z.string().email(),
    name: z.string().min(1)
  }).optional()
});

const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  legalName: z.string().max(255).optional(),
  industry: z.string().max(100).optional(),
  taxId: z.string().max(100).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(50).optional(),
  website: z.string().url().optional().or(z.literal('')),
  address: addressSchema,
  tier: z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as const).optional(),
  maxUsers: z.number().int().positive().optional(),
  settings: settingsSchema
});

const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'TRIAL', 'DEACTIVATED'] as const)
});

const addMemberSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  email: z.string().email('Valid email is required'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'BILLING_ADMIN'] as const).optional(),
  status: z.enum(['ACTIVE', 'INVITED', 'SUSPENDED'] as const).optional()
});

const updateMemberSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'BILLING_ADMIN'] as const).optional(),
  status: z.enum(['ACTIVE', 'INVITED', 'SUSPENDED'] as const).optional()
});

export class OrganizationController {
  constructor(
    private readonly createUseCase: CreateOrganizationUseCase,
    private readonly getQuery: GetOrganizationQuery,
    private readonly listQuery: ListOrganizationsQuery,
    private readonly updateUseCase: UpdateOrganizationUseCase,
    private readonly updateStatusUseCase: UpdateOrganizationStatusUseCase,
    private readonly deleteUseCase: DeleteOrganizationUseCase,
    private readonly addMemberUseCase: AddOrganizationMemberUseCase,
    private readonly listMembersQuery: ListOrganizationMembersQuery,
    private readonly updateMemberRoleUseCase: UpdateOrganizationMemberRoleUseCase,
    private readonly removeMemberUseCase: RemoveOrganizationMemberUseCase
  ) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const validated = createOrganizationSchema.parse(req.body);
    const correlationId = req.context?.correlationId;

    const result = await this.createUseCase.execute({
      ...validated,
      tier: validated.tier as OrganizationTier,
      website: validated.website || undefined,
      correlationId
    });

    if (result.isFailure) {
      ApiResponse.error(res, {
        req,
        statusCode: 400,
        message: result.getError(),
        errors: [{ code: 'CREATION_FAILED', message: result.getError() }]
      });
      return;
    }

    ApiResponse.success(res, {
      req,
      statusCode: 201,
      message: 'Organization created successfully',
      data: result.getValue()
    });
  };

  getOne = async (req: Request, res: Response): Promise<void> => {
    const idOrSlug = Array.isArray(req.params.idOrSlug) ? req.params.idOrSlug[0] : req.params.idOrSlug;
    const result = await this.getQuery.execute(idOrSlug);

    if (result.isFailure) {
      ApiResponse.error(res, {
        req,
        statusCode: 404,
        message: result.getError(),
        errors: [{ code: 'NOT_FOUND', message: result.getError() }]
      });
      return;
    }

    ApiResponse.success(res, {
      req,
      statusCode: 200,
      message: 'Organization retrieved successfully',
      data: result.getValue()
    });
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const status = typeof req.query.status === 'string' ? (req.query.status as OrganizationStatus) : undefined;
    const tier = typeof req.query.tier === 'string' ? (req.query.tier as OrganizationTier) : undefined;
    const industry = typeof req.query.industry === 'string' ? req.query.industry : undefined;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);

    const result = await this.listQuery.execute({
      search,
      status,
      tier,
      industry,
      page,
      limit
    });

    if (result.isFailure) {
      ApiResponse.error(res, {
        req,
        statusCode: 400,
        message: result.getError(),
        errors: [{ code: 'QUERY_FAILED', message: result.getError() }]
      });
      return;
    }

    const { items, pagination } = result.getValue();
    ApiResponse.success(res, {
      req,
      statusCode: 200,
      message: 'Organizations retrieved successfully',
      data: items,
      meta: {
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: pagination.total,
          totalPages: pagination.totalPages,
          hasNext: pagination.page < pagination.totalPages,
          hasPrev: pagination.page > 1
        }
      }
    });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const validated = updateOrganizationSchema.parse(req.body);
    const correlationId = req.context?.correlationId;

    const result = await this.updateUseCase.execute({
      id,
      ...validated,
      tier: validated.tier as OrganizationTier,
      website: validated.website || undefined,
      correlationId
    });

    if (result.isFailure) {
      ApiResponse.error(res, {
        req,
        statusCode: 400,
        message: result.getError(),
        errors: [{ code: 'UPDATE_FAILED', message: result.getError() }]
      });
      return;
    }

    ApiResponse.success(res, {
      req,
      statusCode: 200,
      message: 'Organization updated successfully',
      data: result.getValue()
    });
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const validated = updateStatusSchema.parse(req.body);
    const correlationId = req.context?.correlationId;

    const result = await this.updateStatusUseCase.execute({
      id,
      status: validated.status as OrganizationStatus,
      correlationId
    });

    if (result.isFailure) {
      ApiResponse.error(res, {
        req,
        statusCode: 400,
        message: result.getError(),
        errors: [{ code: 'STATUS_UPDATE_FAILED', message: result.getError() }]
      });
      return;
    }

    ApiResponse.success(res, {
      req,
      statusCode: 200,
      message: `Organization status updated to ${validated.status}`,
      data: result.getValue()
    });
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const correlationId = req.context?.correlationId;

    const result = await this.deleteUseCase.execute(id, correlationId);
    if (result.isFailure) {
      ApiResponse.error(res, {
        req,
        statusCode: 400,
        message: result.getError(),
        errors: [{ code: 'DELETE_FAILED', message: result.getError() }]
      });
      return;
    }

    ApiResponse.success(res, {
      req,
      statusCode: 200,
      message: 'Organization deleted successfully',
      data: { deleted: true }
    });
  };

  addMember = async (req: Request, res: Response): Promise<void> => {
    const organizationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const validated = addMemberSchema.parse(req.body);
    const correlationId = req.context?.correlationId;

    const result = await this.addMemberUseCase.execute({
      organizationId,
      ...validated,
      role: validated.role as MemberRole,
      status: validated.status as MemberStatus,
      correlationId
    });

    if (result.isFailure) {
      ApiResponse.error(res, {
        req,
        statusCode: 400,
        message: result.getError(),
        errors: [{ code: 'ADD_MEMBER_FAILED', message: result.getError() }]
      });
      return;
    }

    ApiResponse.success(res, {
      req,
      statusCode: 201,
      message: 'Member added to organization successfully',
      data: result.getValue()
    });
  };

  listMembers = async (req: Request, res: Response): Promise<void> => {
    const organizationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const role = typeof req.query.role === 'string' ? (req.query.role as MemberRole) : undefined;
    const status = typeof req.query.status === 'string' ? (req.query.status as MemberStatus) : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);

    const result = await this.listMembersQuery.execute(organizationId, {
      role,
      status,
      search,
      page,
      limit
    });

    if (result.isFailure) {
      ApiResponse.error(res, {
        req,
        statusCode: 400,
        message: result.getError(),
        errors: [{ code: 'QUERY_FAILED', message: result.getError() }]
      });
      return;
    }

    const { items, pagination } = result.getValue();
    ApiResponse.success(res, {
      req,
      statusCode: 200,
      message: 'Organization members retrieved successfully',
      data: items,
      meta: {
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total: pagination.total,
          totalPages: pagination.totalPages,
          hasNext: pagination.page < pagination.totalPages,
          hasPrev: pagination.page > 1
        }
      }
    });
  };

  updateMember = async (req: Request, res: Response): Promise<void> => {
    const memberId = Array.isArray(req.params.memberId) ? req.params.memberId[0] : req.params.memberId;
    const validated = updateMemberSchema.parse(req.body);

    const result = await this.updateMemberRoleUseCase.execute({
      memberId,
      role: validated.role as MemberRole,
      status: validated.status as MemberStatus
    });

    if (result.isFailure) {
      ApiResponse.error(res, {
        req,
        statusCode: 400,
        message: result.getError(),
        errors: [{ code: 'UPDATE_MEMBER_FAILED', message: result.getError() }]
      });
      return;
    }

    ApiResponse.success(res, {
      req,
      statusCode: 200,
      message: 'Member updated successfully',
      data: result.getValue()
    });
  };

  removeMember = async (req: Request, res: Response): Promise<void> => {
    const organizationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const memberId = Array.isArray(req.params.memberId) ? req.params.memberId[0] : req.params.memberId;
    const correlationId = req.context?.correlationId;

    const result = await this.removeMemberUseCase.execute({
      organizationId,
      memberId,
      correlationId
    });

    if (result.isFailure) {
      ApiResponse.error(res, {
        req,
        statusCode: 400,
        message: result.getError(),
        errors: [{ code: 'REMOVE_MEMBER_FAILED', message: result.getError() }]
      });
      return;
    }

    ApiResponse.success(res, {
      req,
      statusCode: 200,
      message: 'Member removed from organization successfully',
      data: { removed: true }
    });
  };
}
