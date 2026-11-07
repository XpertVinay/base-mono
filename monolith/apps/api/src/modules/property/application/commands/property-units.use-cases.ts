import { IUseCase, IQuery } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IPropertyRepository } from '../../domain/repositories/property-repository.interface.js';
import { Property } from '../../domain/entities/property.entity.js';
import { PropertyUnit } from '../../domain/entities/unit.entity.js';
import { OwnershipSplit } from '../../domain/entities/ownership-split.entity.js';
import {
  PropertyUnitDto,
  CreatePropertyUnitRequestDto,
  UpdateUnitStatusRequestDto,
  OwnershipSplitDto,
  SetOwnershipSplitsRequestDto
} from '@monolith/contracts';
import { NotFoundError } from '../../../../shared/presentation/error-handler.middleware.js';
import { IEventBus } from '../../../../infrastructure/messaging/event-bus.js';

export interface CreateUnitInput extends CreatePropertyUnitRequestDto {
  propertyId: string;
}

export class CreatePropertyUnitUseCase implements IUseCase<CreateUnitInput, PropertyUnitDto> {
  constructor(
    private readonly repository: IPropertyRepository,
    private readonly eventBus?: IEventBus
  ) {}

  async execute(input: CreateUnitInput): Promise<Result<PropertyUnitDto, Error>> {
    try {
      const property = await this.repository.findById(input.propertyId, input.tenantId);
      if (!property) {
        return Result.fail(new NotFoundError(`Property with id '${input.propertyId}'`));
      }

      const unit = PropertyUnit.create(
        input.propertyId,
        input.unitNumber,
        input.rentAmount,
        input.areaSqFt,
        {
          floor: input.floor,
          depositAmount: input.depositAmount,
          tenantId: input.tenantId || property.tenantId
        }
      );

      await this.repository.addUnit(unit);

      if (this.eventBus) {
        await this.eventBus.publish({
          id: unit.id,
          eventName: 'property.unit_created',
          aggregateId: unit.id,
          occurredAt: new Date().toISOString(),
          version: 1,
          payload: {
            unitId: unit.id,
            propertyId: unit.propertyId,
            tenantId: unit.tenantId,
            unitNumber: unit.unitNumber,
            rentAmount: unit.rentAmount
          }
        });
      }

      return Result.ok({
        id: unit.id,
        propertyId: unit.propertyId,
        tenantId: unit.tenantId,
        unitNumber: unit.unitNumber,
        floor: unit.floor,
        status: unit.status,
        rentAmount: unit.rentAmount,
        depositAmount: unit.depositAmount,
        areaSqFt: unit.areaSqFt,
        createdAt: unit.createdAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class ListPropertyUnitsQuery implements IQuery<{ propertyId: string; tenantId?: string }, PropertyUnitDto[]> {
  constructor(private readonly repository: IPropertyRepository) {}

  async execute({ propertyId, tenantId }: { propertyId: string; tenantId?: string }): Promise<Result<PropertyUnitDto[], Error>> {
    try {
      const property = await this.repository.findById(propertyId, tenantId);
      if (!property) {
        return Result.fail(new NotFoundError(`Property with id '${propertyId}'`));
      }

      const units = await this.repository.findUnitsByProperty(propertyId, tenantId);
      return Result.ok(units.map(u => ({
        id: u.id,
        propertyId: u.propertyId,
        tenantId: u.tenantId,
        unitNumber: u.unitNumber,
        floor: u.floor,
        status: u.status,
        rentAmount: u.rentAmount,
        depositAmount: u.depositAmount,
        areaSqFt: u.areaSqFt,
        createdAt: u.createdAt.toISOString()
      })));
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class UpdateUnitStatusUseCase implements IUseCase<{ unitId: string; tenantId?: string } & UpdateUnitStatusRequestDto, PropertyUnitDto> {
  constructor(
    private readonly repository: IPropertyRepository,
    private readonly eventBus?: IEventBus
  ) {}

  async execute(input: { unitId: string; tenantId?: string } & UpdateUnitStatusRequestDto): Promise<Result<PropertyUnitDto, Error>> {
    try {
      const unit = await this.repository.findUnitById(input.unitId, input.tenantId);
      if (!unit) {
        return Result.fail(new NotFoundError(`Property unit with id '${input.unitId}'`));
      }

      const previousStatus = unit.status;
      unit.updateStatus(input.status);
      await this.repository.updateUnit(unit);

      if (this.eventBus) {
        await this.eventBus.publish({
          id: unit.id,
          eventName: 'property.unit_status_changed',
          aggregateId: unit.id,
          occurredAt: new Date().toISOString(),
          version: 1,
          payload: {
            unitId: unit.id,
            propertyId: unit.propertyId,
            tenantId: unit.tenantId,
            previousStatus,
            newStatus: unit.status,
            reason: input.reason
          }
        });
      }

      return Result.ok({
        id: unit.id,
        propertyId: unit.propertyId,
        tenantId: unit.tenantId,
        unitNumber: unit.unitNumber,
        floor: unit.floor,
        status: unit.status,
        rentAmount: unit.rentAmount,
        depositAmount: unit.depositAmount,
        areaSqFt: unit.areaSqFt,
        createdAt: unit.createdAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class SetOwnershipSplitsUseCase implements IUseCase<{ propertyId: string; tenantId?: string } & SetOwnershipSplitsRequestDto, OwnershipSplitDto[]> {
  constructor(
    private readonly repository: IPropertyRepository,
    private readonly eventBus?: IEventBus
  ) {}

  async execute(input: { propertyId: string; tenantId?: string } & SetOwnershipSplitsRequestDto): Promise<Result<OwnershipSplitDto[], Error>> {
    try {
      const property = await this.repository.findById(input.propertyId, input.tenantId);
      if (!property) {
        return Result.fail(new NotFoundError(`Property with id '${input.propertyId}'`));
      }

      // Mathematical Domain Invariant Check
      Property.validateOwnershipSplits(input.splits);

      const splitEntities = input.splits.map(s => OwnershipSplit.create(
        input.propertyId,
        s.ownerId,
        s.sharePercentage,
        s.disbursementAccount,
        input.tenantId || property.tenantId
      ));

      await this.repository.setOwnershipSplits(input.propertyId, splitEntities, input.tenantId || property.tenantId);

      if (this.eventBus) {
        await this.eventBus.publish({
          id: input.propertyId,
          eventName: 'property.ownership_splits_updated',
          aggregateId: input.propertyId,
          occurredAt: new Date().toISOString(),
          version: 1,
          payload: {
            propertyId: input.propertyId,
            tenantId: input.tenantId || property.tenantId,
            splits: input.splits.map(s => ({
              ownerId: s.ownerId,
              sharePercentage: s.sharePercentage
            }))
          }
        });
      }

      return Result.ok(splitEntities.map(s => ({
        id: s.id,
        propertyId: s.propertyId,
        tenantId: s.tenantId,
        ownerId: s.ownerId,
        sharePercentage: s.sharePercentage,
        disbursementAccount: s.disbursementAccount,
        createdAt: s.createdAt.toISOString()
      })));
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}

export class GetOwnershipSplitsQuery implements IQuery<{ propertyId: string; tenantId?: string }, OwnershipSplitDto[]> {
  constructor(private readonly repository: IPropertyRepository) {}

  async execute({ propertyId, tenantId }: { propertyId: string; tenantId?: string }): Promise<Result<OwnershipSplitDto[], Error>> {
    try {
      const property = await this.repository.findById(propertyId, tenantId);
      if (!property) {
        return Result.fail(new NotFoundError(`Property with id '${propertyId}'`));
      }

      const splits = await this.repository.getOwnershipSplits(propertyId, tenantId);
      return Result.ok(splits.map(s => ({
        id: s.id,
        propertyId: s.propertyId,
        tenantId: s.tenantId,
        ownerId: s.ownerId,
        sharePercentage: s.sharePercentage,
        disbursementAccount: s.disbursementAccount,
        createdAt: s.createdAt.toISOString()
      })));
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
