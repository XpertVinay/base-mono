import crypto from 'crypto';

export class OwnershipSplit {
  private constructor(
    public readonly id: string,
    public readonly propertyId: string,
    public readonly ownerId: string,
    public readonly sharePercentage: number,
    public readonly disbursementAccount?: string,
    public readonly createdAt: Date = new Date(),
    public readonly tenantId?: string
  ) {}

  public static create(
    propertyId: string,
    ownerId: string,
    sharePercentage: number,
    disbursementAccount?: string,
    tenantId?: string,
    id?: string
  ): OwnershipSplit {
    if (!ownerId || ownerId.trim().length === 0) {
      throw new Error('Owner ID is required');
    }
    if (sharePercentage <= 0 || sharePercentage > 100) {
      throw new Error('Share percentage must be greater than 0 and less than or equal to 100');
    }

    return new OwnershipSplit(
      id || crypto.randomUUID(),
      propertyId,
      ownerId,
      Math.round(sharePercentage * 100) / 100,
      disbursementAccount,
      new Date(),
      tenantId
    );
  }

  public static reconstruct(props: {
    id: string;
    propertyId: string;
    ownerId: string;
    sharePercentage: number;
    disbursementAccount?: string;
    createdAt: Date;
    tenantId?: string;
  }): OwnershipSplit {
    return new OwnershipSplit(
      props.id,
      props.propertyId,
      props.ownerId,
      props.sharePercentage,
      props.disbursementAccount,
      props.createdAt,
      props.tenantId
    );
  }
}
