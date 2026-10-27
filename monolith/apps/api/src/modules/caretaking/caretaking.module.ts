import { Router } from 'express';
import { PostgresCaretakingRepository } from './infrastructure/persistence/postgres-caretaking.repository.js';
import { OnboardCaretakerUseCase } from './application/commands/onboard-caretaker.use-case.js';
import { AssignCaretakerUseCase } from './application/commands/assign-caretaker.use-case.js';
import { AcceptAssignmentUseCase } from './application/commands/accept-assignment.use-case.js';
import { UpdatePermissionsUseCase } from './application/commands/update-permissions.use-case.js';
import { ListCaretakersQuery } from './application/queries/list-caretakers.query.js';
import { ListAssignmentsQuery } from './application/queries/list-assignments.query.js';
import { CaretakingController } from './presentation/http/caretaking.controller.js';
import { createCaretakingRouter } from './presentation/http/caretaking.routes.js';
import { container } from '../../bootstrap/container.js';
import { CaretakerAssignmentDto, PermissionScope } from '@monolith/contracts';

export interface ICaretakingModulePublicApi {
  getActiveAssignment(propertyId: string): Promise<CaretakerAssignmentDto | null>;
  verifyPermission(propertyId: string, caretakerUserId: string, permission: PermissionScope): Promise<boolean>;
  getSpendingLimit(propertyId: string, caretakerUserId: string): Promise<number>;
}

export class CaretakingModule {
  public static init(): { router: Router; publicApi: ICaretakingModulePublicApi } {
    const repository = new PostgresCaretakingRepository();
    const onboardUseCase = new OnboardCaretakerUseCase(repository);
    const assignUseCase = new AssignCaretakerUseCase(repository);
    const acceptUseCase = new AcceptAssignmentUseCase(repository);
    const updatePermissionsUseCase = new UpdatePermissionsUseCase(repository);
    const listCaretakersQuery = new ListCaretakersQuery(repository);
    const listAssignmentsQuery = new ListAssignmentsQuery(repository);

    const controller = new CaretakingController(
      onboardUseCase,
      assignUseCase,
      acceptUseCase,
      updatePermissionsUseCase,
      listCaretakersQuery,
      listAssignmentsQuery
    );
    const router = createCaretakingRouter(controller);

    const publicApi: ICaretakingModulePublicApi = {
      getActiveAssignment: async (propertyId: string) => {
        const assignment = await repository.findActiveAssignmentByPropertyId(propertyId);
        if (!assignment) return null;
        return {
          id: assignment.id,
          propertyId: assignment.propertyId,
          caretakerId: assignment.caretakerId,
          ownerId: assignment.ownerId,
          status: assignment.status,
          startDate: assignment.startDate.toISOString(),
          endDate: assignment.endDate ? assignment.endDate.toISOString() : undefined,
          monthlyFee: assignment.monthlyFee,
          allowedPermissions: assignment.allowedPermissions,
          spendingThresholdLimit: assignment.spendingThresholdLimit,
          createdAt: assignment.createdAt.toISOString()
        };
      },
      verifyPermission: async (propertyId: string, caretakerUserId: string, permission: PermissionScope) => {
        const profile = await repository.findProfileByUserId(caretakerUserId);
        if (!profile) return false;
        const assignment = await repository.findActiveAssignmentByPropertyId(propertyId);
        if (!assignment || assignment.caretakerId !== profile.id) return false;
        return assignment.hasPermission(permission);
      },
      getSpendingLimit: async (propertyId: string, caretakerUserId: string) => {
        const profile = await repository.findProfileByUserId(caretakerUserId);
        if (!profile) return 0;
        const assignment = await repository.findActiveAssignmentByPropertyId(propertyId);
        if (!assignment || assignment.caretakerId !== profile.id) return 0;
        return assignment.spendingThresholdLimit;
      }
    };

    container.register('ICaretakingModulePublicApi', publicApi);
    return { router, publicApi };
  }
}
