import { IOrganizationRepository } from '../../../domain/repositories/organization-repository.interface.js';
import { IOrganizationMembershipRepository } from '../../../domain/repositories/organization-membership-repository.interface.js';
import { ITenantRoleRepository } from '../../../domain/repositories/tenant-role-repository.interface.js';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError
} from '../../../../../shared/presentation/error-handler.middleware.js';

export class DeleteTenantRoleUseCase {
  constructor(
    private readonly orgRepo: IOrganizationRepository,
    private readonly membershipRepo: IOrganizationMembershipRepository,
    private readonly tenantRoleRepo: ITenantRoleRepository
  ) {}

  async execute(organizationId: string, roleId: string, userId: string): Promise<void> {
    const org = await this.orgRepo.findById(organizationId);
    if (!org) {
      throw new NotFoundError(`Tenant organization '${organizationId}' not found`);
    }

    if (!org.isAccessible()) {
      throw new ForbiddenError(`Organization '${org.name}' is ${org.status.toLowerCase()}`);
    }

    // Must be admin or owner
    const isOwner = org.ownerUserId === userId;
    if (!isOwner) {
      const callerMembership = await this.membershipRepo.findByOrgAndUser(organizationId, userId);
      if (!callerMembership || !callerMembership.isActive() || !callerMembership.isAdmin()) {
        throw new ForbiddenError('Only organization administrators can delete roles');
      }
    }

    const role = await this.tenantRoleRepo.findById(roleId);
    if (!role || role.tenantId !== organizationId) {
      throw new NotFoundError(`Role '${roleId}' not found in organization '${org.name}'`);
    }

    if (role.isSystem) {
      throw new BadRequestError('System default roles cannot be deleted');
    }

    await this.tenantRoleRepo.delete(role.id);
  }
}
