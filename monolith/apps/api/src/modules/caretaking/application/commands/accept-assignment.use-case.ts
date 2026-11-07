import crypto from 'crypto';
import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { ICaretakingRepository } from '../../domain/repositories/caretaking-repository.interface.js';
import { CaretakerAssignmentDto, CaretakerAssignmentAcceptedEvent } from '@monolith/contracts';
import { IEventBus } from '../../../../infrastructure/messaging/event-bus.js';

export interface AcceptAssignmentInput {
  assignmentId: string;
  caretakerUserId: string;
  tenantId?: string;
}

export class AcceptAssignmentUseCase implements IUseCase<AcceptAssignmentInput, CaretakerAssignmentDto> {
  constructor(
    private readonly caretakingRepository: ICaretakingRepository,
    private readonly eventBus?: IEventBus
  ) {}

  async execute(input: AcceptAssignmentInput): Promise<Result<CaretakerAssignmentDto, Error>> {
    try {
      const assignment = await this.caretakingRepository.findAssignmentById(input.assignmentId, input.tenantId);
      if (!assignment) {
        return Result.fail(new Error(`Assignment ${input.assignmentId} not found`));
      }

      if (input.tenantId && assignment.tenantId && assignment.tenantId !== input.tenantId) {
        return Result.fail(new Error('Cross-tenant assignment access denied'));
      }

      // Verify the caretaker profile belongs to this user
      const profile = await this.caretakingRepository.findProfileByUserId(input.caretakerUserId, input.tenantId);
      if (!profile || profile.id !== assignment.caretakerId) {
        return Result.fail(new Error('Unauthorized: Only the assigned caretaker may accept this assignment'));
      }

      assignment.accept(input.caretakerUserId);
      await this.caretakingRepository.updateAssignment(assignment);

      if (this.eventBus) {
        const event: CaretakerAssignmentAcceptedEvent = {
          id: crypto.randomUUID(),
          eventName: 'caretaking.accepted',
          occurredAt: new Date().toISOString(),
          aggregateId: assignment.id,
          version: 1,
          payload: {
            assignmentId: assignment.id,
            tenantId: assignment.tenantId,
            propertyId: assignment.propertyId,
            caretakerId: assignment.caretakerId,
            acceptedAt: assignment.acceptedAt ? assignment.acceptedAt.toISOString() : new Date().toISOString()
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
