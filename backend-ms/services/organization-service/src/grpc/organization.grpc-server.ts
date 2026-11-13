import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Express } from 'express';
import { IOrganizationRepository } from '../domain/repositories/organization-repository.interface.js';
import { IOrganizationMemberRepository } from '../domain/repositories/organization-member-repository.interface.js';
import {
  CreateOrganizationUseCase,
  GetOrganizationQuery,
  ListOrganizationsQuery,
  UpdateOrganizationUseCase,
  DeleteOrganizationUseCase
} from '../application/use-cases/organization.use-cases.js';
import { logger } from '../shared/infrastructure/logger.js';
import { invokeExpressApp } from './express-grpc-bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function startOrganizationGrpcServer(
  orgRepo: IOrganizationRepository,
  memberRepo: IOrganizationMemberRepository,
  port: number = 50062,
  app?: Express
): grpc.Server {
  const protoPath = path.resolve(__dirname, '../proto/organization.proto');
  const packageDef = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });

  const protoDescriptor = grpc.loadPackageDefinition(packageDef) as any;
  const orgProto = protoDescriptor.organization;

  const server = new grpc.Server();

  const getQuery = new GetOrganizationQuery(orgRepo);
  const listQuery = new ListOrganizationsQuery(orgRepo);
  const createUseCase = new CreateOrganizationUseCase(orgRepo, memberRepo);
  const updateUseCase = new UpdateOrganizationUseCase(orgRepo);
  const deleteUseCase = new DeleteOrganizationUseCase(orgRepo, memberRepo);

  server.addService(orgProto.OrganizationService.service, {
    GetOrganizationById: async (call: any, callback: any) => {
      const requestId = `grpc-org-${Date.now()}`;
      try {
        const result = await getQuery.execute(call.request.id);
        if (result.isFailure) {
          return callback(null, {
            status: false,
            message: result.getError(),
            errors: [{ code: 'NOT_FOUND', message: result.getError(), field: 'id' }],
            meta_data: {
              request_id: requestId,
              timestamp: new Date().toISOString(),
              debug_data: { service: 'organization-service', rpc: 'GetOrganizationById' },
              further_steps: ['Check organization id parameter']
            },
            data: null
          });
        }

        const data = result.getValue();
        callback(null, {
          status: true,
          message: 'Organization retrieved successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'organization-service', rpc: 'GetOrganizationById' },
            further_steps: []
          },
          data: {
            id: data.id,
            slug: data.slug,
            name: data.name,
            legal_name: data.legalName || '',
            status: data.status,
            tier: data.tier,
            industry: data.industry || '',
            tax_id: data.taxId || '',
            contact_email: data.contactEmail,
            contact_phone: data.contactPhone || '',
            website: data.website || '',
            max_users: data.maxUsers,
            created_at: data.createdAt,
            updated_at: data.updatedAt
          }
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    GetOrganizationBySlug: async (call: any, callback: any) => {
      const requestId = `grpc-org-${Date.now()}`;
      try {
        const result = await getQuery.execute(call.request.slug);
        if (result.isFailure) {
          return callback(null, {
            status: false,
            message: result.getError(),
            errors: [{ code: 'NOT_FOUND', message: result.getError(), field: 'slug' }],
            meta_data: {
              request_id: requestId,
              timestamp: new Date().toISOString(),
              debug_data: { service: 'organization-service', rpc: 'GetOrganizationBySlug' },
              further_steps: ['Verify tenant slug identifier']
            },
            data: null
          });
        }

        const data = result.getValue();
        callback(null, {
          status: true,
          message: 'Organization retrieved successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'organization-service', rpc: 'GetOrganizationBySlug' },
            further_steps: []
          },
          data: {
            id: data.id,
            slug: data.slug,
            name: data.name,
            legal_name: data.legalName || '',
            status: data.status,
            tier: data.tier,
            industry: data.industry || '',
            tax_id: data.taxId || '',
            contact_email: data.contactEmail,
            contact_phone: data.contactPhone || '',
            website: data.website || '',
            max_users: data.maxUsers,
            created_at: data.createdAt,
            updated_at: data.updatedAt
          }
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    ListOrganizations: async (call: any, callback: any) => {
      const requestId = `grpc-org-${Date.now()}`;
      try {
        const req = call.request;
        const result = await listQuery.execute({
          search: req.search || undefined,
          status: req.status || undefined,
          tier: req.tier || undefined,
          industry: req.industry || undefined,
          page: req.page || 1,
          limit: req.limit || 20
        });

        if (result.isFailure) {
          return callback(null, {
            status: false,
            message: result.getError(),
            errors: [{ code: 'INTERNAL_ERROR', message: result.getError() }],
            meta_data: {
              request_id: requestId,
              timestamp: new Date().toISOString(),
              debug_data: { service: 'organization-service', rpc: 'ListOrganizations' },
              further_steps: []
            },
            data: { items: [] }
          });
        }

        const { items, pagination } = result.getValue();
        callback(null, {
          status: true,
          message: 'Organizations retrieved successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'organization-service', rpc: 'ListOrganizations' },
            pagination: {
              page: pagination.page,
              limit: pagination.limit,
              total: pagination.total,
              total_pages: pagination.totalPages,
              has_next: pagination.page < pagination.totalPages
            },
            further_steps: []
          },
          data: {
            items: items.map((data) => ({
              id: data.id,
              slug: data.slug,
              name: data.name,
              legal_name: data.legalName || '',
              status: data.status,
              tier: data.tier,
              industry: data.industry || '',
              tax_id: data.taxId || '',
              contact_email: data.contactEmail,
              contact_phone: data.contactPhone || '',
              website: data.website || '',
              max_users: data.maxUsers,
              created_at: data.createdAt,
              updated_at: data.updatedAt
            }))
          }
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    CreateOrganization: async (call: any, callback: any) => {
      const requestId = `grpc-org-${Date.now()}`;
      try {
        const req = call.request;
        const result = await createUseCase.execute({
          name: req.name,
          slug: req.slug,
          legalName: req.legal_name || undefined,
          tier: req.tier || 'FREE',
          industry: req.industry || undefined,
          taxId: req.tax_id || undefined,
          contactEmail: req.contact_email,
          contactPhone: req.contact_phone || undefined,
          website: req.website || undefined,
          maxUsers: req.max_users || undefined,
          correlationId: requestId
        });

        if (result.isFailure) {
          return callback(null, {
            status: false,
            message: result.getError(),
            errors: [{ code: 'CREATE_FAILED', message: result.getError() }],
            meta_data: {
              request_id: requestId,
              timestamp: new Date().toISOString(),
              debug_data: { service: 'organization-service', rpc: 'CreateOrganization' },
              further_steps: ['Verify payload requirements']
            },
            data: null
          });
        }

        const data = result.getValue();
        callback(null, {
          status: true,
          message: 'Organization created successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'organization-service', rpc: 'CreateOrganization' },
            further_steps: []
          },
          data: {
            id: data.id,
            slug: data.slug,
            name: data.name,
            legal_name: data.legalName || '',
            status: data.status,
            tier: data.tier,
            industry: data.industry || '',
            tax_id: data.taxId || '',
            contact_email: data.contactEmail,
            contact_phone: data.contactPhone || '',
            website: data.website || '',
            max_users: data.maxUsers,
            created_at: data.createdAt,
            updated_at: data.updatedAt
          }
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    UpdateOrganization: async (call: any, callback: any) => {
      const requestId = `grpc-org-${Date.now()}`;
      try {
        const req = call.request;
        const result = await updateUseCase.execute({
          id: req.id,
          name: req.name || undefined,
          legalName: req.legal_name || undefined,
          industry: req.industry || undefined,
          taxId: req.tax_id || undefined,
          contactEmail: req.contact_email || undefined,
          contactPhone: req.contact_phone || undefined,
          website: req.website || undefined,
          tier: req.tier || undefined,
          maxUsers: req.max_users || undefined,
          correlationId: requestId
        });

        if (result.isFailure) {
          return callback(null, {
            status: false,
            message: result.getError(),
            errors: [{ code: 'UPDATE_FAILED', message: result.getError() }],
            meta_data: {
              request_id: requestId,
              timestamp: new Date().toISOString(),
              debug_data: { service: 'organization-service', rpc: 'UpdateOrganization' },
              further_steps: []
            },
            data: null
          });
        }

        const data = result.getValue();
        callback(null, {
          status: true,
          message: 'Organization updated successfully',
          errors: [],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'organization-service', rpc: 'UpdateOrganization' },
            further_steps: []
          },
          data: {
            id: data.id,
            slug: data.slug,
            name: data.name,
            legal_name: data.legalName || '',
            status: data.status,
            tier: data.tier,
            industry: data.industry || '',
            tax_id: data.taxId || '',
            contact_email: data.contactEmail,
            contact_phone: data.contactPhone || '',
            website: data.website || '',
            max_users: data.maxUsers,
            created_at: data.createdAt,
            updated_at: data.updatedAt
          }
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    DeleteOrganization: async (call: any, callback: any) => {
      const requestId = `grpc-org-${Date.now()}`;
      try {
        const result = await deleteUseCase.execute(call.request.id, requestId);
        const deleted = result.isSuccess && result.getValue();
        callback(null, {
          status: deleted,
          message: deleted ? 'Organization deleted successfully' : result.getError(),
          errors: deleted ? [] : [{ code: 'DELETE_FAILED', message: result.getError() }],
          meta_data: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
            debug_data: { service: 'organization-service', rpc: 'DeleteOrganization' },
            further_steps: []
          },
          deleted
        });
      } catch (err: any) {
        callback({ code: grpc.status.INTERNAL, message: err.message });
      }
    },

    HealthCheck: (_call: any, callback: any) => {
      callback(null, {
        status: true,
        service: 'organization-service',
        version: 'v1',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime())
      });
    },

    Dispatch: async (call: any, callback: any) => {
      try {
        if (!app) {
          return callback({
            code: grpc.status.UNIMPLEMENTED,
            message: 'Express dispatch app not attached to Organization gRPC server'
          });
        }
        const response = await invokeExpressApp(app, call.request);
        callback(null, response);
      } catch (err: any) {
        callback({
          code: grpc.status.INTERNAL,
          message: err.message || 'Failed to dispatch request in organization-service'
        });
      }
    }
  });

  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        logger.error('Failed to bind Organization gRPC server', err);
        return;
      }
      logger.info(`⚡ Organization gRPC service running at 0.0.0.0:${boundPort}`);
    }
  );

  return server;
}
