import crypto from 'crypto';
import { KycStatus } from '@monolith/contracts';

export class CaretakerProfile {
  private constructor(
    public readonly id: string,
    public readonly userId: string,
    public phone: string,
    public experienceYears: number,
    public serviceCities: string[],
    public skills: string[],
    public kycStatus: KycStatus,
    public ratingAverage: number,
    public completedTasksCount: number,
    public isAvailable: boolean,
    public readonly createdAt: Date,
    public updatedAt: Date
  ) {}

  public static create(
    userId: string,
    phone: string,
    experienceYears: number,
    serviceCities: string[],
    skills: string[]
  ): CaretakerProfile {
    if (!phone || phone.trim().length < 6) {
      throw new Error('Valid phone number is required for caretaker profile');
    }
    if (experienceYears < 0) {
      throw new Error('Experience years cannot be negative');
    }

    const now = new Date();
    return new CaretakerProfile(
      crypto.randomUUID(),
      userId,
      phone.trim(),
      experienceYears,
      serviceCities,
      skills,
      'PENDING',
      5.0,
      0,
      true,
      now,
      now
    );
  }

  public static reconstruct(props: {
    id: string;
    userId: string;
    phone: string;
    experienceYears: number;
    serviceCities: string[];
    skills: string[];
    kycStatus: KycStatus;
    ratingAverage: number;
    completedTasksCount: number;
    isAvailable: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): CaretakerProfile {
    return new CaretakerProfile(
      props.id,
      props.userId,
      props.phone,
      props.experienceYears,
      props.serviceCities,
      props.skills,
      props.kycStatus,
      props.ratingAverage,
      props.completedTasksCount,
      props.isAvailable,
      props.createdAt,
      props.updatedAt
    );
  }

  public verifyKyc(): void {
    this.kycStatus = 'VERIFIED';
    this.updatedAt = new Date();
  }

  public suspend(): void {
    this.kycStatus = 'SUSPENDED';
    this.isAvailable = false;
    this.updatedAt = new Date();
  }

  public setAvailability(available: boolean): void {
    this.isAvailable = available;
    this.updatedAt = new Date();
  }
}
