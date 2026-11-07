import crypto from 'crypto';
import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { ICaretakingRepository } from '../../domain/repositories/caretaking-repository.interface.js';
import { CaretakerAssignmentDto, AssignmentTerminatedEvent } from '@monolith/contracts';
import { IEventBus } from '../../../../infrastructure/messaging/event-bus.js';

export interface TerminateAssignmentInput {
  assignmentId: string;
  actorId: string;
  tenantId?: string;
  reason?: string;
  isAdmin?: boolean;
}

export class TerminateAssignmentUseCase implements IUseCase<TerminateAssignmentInput, CaretakerAssignmentDto> {
  constructor(
    private readonly caretakingRepository: ICaretakingRepository,
    private readonly eventBus?: IEventBus
  ) {}

  async execute(input: TerminateAssignmentInput): Promise<Result<CaretakerAssignmentDto, Error>> {
    try {
      const assignment = await this.caretakingRepository.findAssignmentById(input.assignmentId, input.tenantId);
      if (!assignment) {
        return Result.fail(new Error(`Assignment ${input.assignmentId} not found`));
      }

      if (input.tenantId && assignment.tenantId && assignment.tenantId !== input.tenantId) {
        return Result.fail(new Error('Cross-tenant assignment access denied'));
      }

      // Check authorization (owner, caretaker profile owner, or admin)
      if (!input.isAdmin && assignment.ownerId !== input.actorId) {
        const caretakerProfile = await this.caretakingRepository.findProfileById(assignment.caretakerId, input.tenantId);
        if (!caretakerProfile || caretakerProfile.userId !== input.actorId) {
          return Result.fail(new Error('Unauthorized: Only property owner or assigned caretaker may terminate assignment'));
        }
      }

      // Instant permission revocation invariant (FR-ASG-010)
      assignment.terminate(input.reason);
      await this.caretakingRepository.updateAssignment(assignment);

      if (this.eventBus) {
        const event: AssignmentTerminatedEvent = {
          id: crypto.randomUUID(),
          eventName: 'caretaking.terminated',
          occurredAt: new Date().toISOString(),
          aggregateId: assignment.id,
          version: 1,
          payload: {
            assignmentId: assignment.id,
            tenantId: assignment.tenantId,
            propertyId: assignment.propertyId,
            caretakerId: assignment.caretakerId,
            ownerId: assignment.ownerId,
            terminatedAt: assignment.terminatedAt ? assignment.terminatedAt.toISOString() : new Date().toISOString(),
            reason: input.reason
          }
        };
        await this.eventBus.publish(event);
      }

      return Result.ok({
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
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
