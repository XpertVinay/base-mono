import { Router } from 'express';
import { ICaretakingRepository } from './domain/repositories/caretaking-repository.interface.js';
import { PostgresCaretakingRepository } from './infrastructure/persistence/postgres-caretaking.repository.js';
import { OnboardCaretakerUseCase } from './application/commands/onboard-caretaker.use-case.js';
import { AssignCaretakerUseCase } from './application/commands/assign-caretaker.use-case.js';
import { AcceptAssignmentUseCase } from './application/commands/accept-assignment.use-case.js';
import { UpdatePermissionsUseCase } from './application/commands/update-permissions.use-case.js';
import { TerminateAssignmentUseCase } from './application/commands/terminate-assignment.use-case.js';
import { ListCaretakersQuery } from './application/queries/list-caretakers.query.js';
import { ListAssignmentsQuery } from './application/queries/list-assignments.query.js';
import { GetAssignmentDetailsQuery } from './application/queries/get-assignment-details.query.js';
import { CaretakingController } from './presentation/http/caretaking.controller.js';
import { createCaretakingRouter } from './presentation/http/caretaking.routes.js';
import { container } from '../../bootstrap/container.js';
import { eventBus as defaultEventBus, IEventBus } from '../../infrastructure/messaging/event-bus.js';
import { CaretakerAssignmentDto, PermissionScope } from '@monolith/contracts';

export interface ICaretakingModulePublicApi {
  getActiveAssignment(propertyId: string, tenantId?: string): Promise<CaretakerAssignmentDto | null>;
  verifyPermission(propertyId: string, caretakerUserId: string, permission: PermissionScope, tenantId?: string): Promise<boolean>;
  getSpendingLimit(propertyId: string, caretakerUserId: string, tenantId?: string): Promise<number>;
  terminateAssignment(assignmentId: string, actorId: string, tenantId?: string, reason?: string): Promise<CaretakerAssignmentDto>;
}

export class CaretakingModule {
  public static init(
    customRepository?: ICaretakingRepository,
    customEventBus?: IEventBus
  ): {
    router: Router;
    publicApi: ICaretakingModulePublicApi;
    repository: ICaretakingRepository;
  } {
    const repository = customRepository || new PostgresCaretakingRepository();
    const effectiveEventBus = customEventBus || defaultEventBus;

    const onboardUseCase = new OnboardCaretakerUseCase(repository);
    const assignUseCase = new AssignCaretakerUseCase(repository, effectiveEventBus);
    const acceptUseCase = new AcceptAssignmentUseCase(repository, effectiveEventBus);
    const updatePermissionsUseCase = new UpdatePermissionsUseCase(repository);
    const terminateUseCase = new TerminateAssignmentUseCase(repository, effectiveEventBus);
    const listCaretakersQuery = new ListCaretakersQuery(repository);
    const listAssignmentsQuery = new ListAssignmentsQuery(repository);
    const getAssignmentDetailsQuery = new GetAssignmentDetailsQuery(repository);

    const controller = new CaretakingController(
      onboardUseCase,
      assignUseCase,
      acceptUseCase,
      updatePermissionsUseCase,
      terminateUseCase,
      listCaretakersQuery,
      listAssignmentsQuery,
      getAssignmentDetailsQuery
    );
    const router = createCaretakingRouter(controller);

    const publicApi: ICaretakingModulePublicApi = {
      getActiveAssignment: async (propertyId: string, tenantId?: string) => {
        const assignment = await repository.findActiveAssignmentByPropertyId(propertyId, tenantId);
        if (!assignment) return null;
        return {
          id: assignment.id,
          tenantId: assignment.tenantId,
          propertyId: assignment.propertyId,
          caretakerId: assignment.caretakerId,
          ownerId: assignment.ownerId,
          status: assignment.status,
          startDate: assignment.startDate.toISOString(),
          endDate: assignment.endDate ? assignment.endDate.toISOString() : undefined,
          monthlyFee: assignment.monthlyFee,
          allowedPermissions: assignment.allowedPermissions,
          spendingThresholdLimit: assignment.spendingThresholdLimit,
          acceptedAt: assignment.acceptedAt ? assignment.acceptedAt.toISOString() : undefined,
          terminatedAt: assignment.terminatedAt ? assignment.terminatedAt.toISOString() : undefined,
          createdAt: assignment.createdAt.toISOString(),
          updatedAt: assignment.updatedAt.toISOString()
        };
      },
      verifyPermission: async (propertyId: string, caretakerUserId: string, permission: PermissionScope, tenantId?: string) => {
        const profile = await repository.findProfileByUserId(caretakerUserId, tenantId);
        if (!profile) return false;
        const assignment = await repository.findActiveAssignmentByPropertyId(propertyId, tenantId);
        if (!assignment || assignment.caretakerId !== profile.id) return false;
        return assignment.hasPermission(permission);
      },
      getSpendingLimit: async (propertyId: string, caretakerUserId: string, tenantId?: string) => {
        const profile = await repository.findProfileByUserId(caretakerUserId, tenantId);
        if (!profile) return 0;
        const assignment = await repository.findActiveAssignmentByPropertyId(propertyId, tenantId);
        if (!assignment || assignment.caretakerId !== profile.id) return 0;
        return assignment.spendingThresholdLimit;
      },
      terminateAssignment: async (assignmentId: string, actorId: string, tenantId?: string, reason?: string) => {
        const res = await terminateUseCase.execute({ assignmentId, actorId, tenantId, reason, isAdmin: true });
        if (res.isFailure) throw res.getError();
        return res.getValue();
      }
    };

    container.register('ICaretakingModulePublicApi', publicApi);
    return { router, publicApi, repository };
  }
}
