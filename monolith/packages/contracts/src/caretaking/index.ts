import { DomainIntegrationEvent } from '../common/index.js';

export type KycStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';

export type AssignmentStatus = 
  | 'PENDING_ACCEPTANCE' 
  | 'ACTIVE' 
  | 'SUSPENDED' 
  | 'TERMINATED';

export type PermissionScope = 
  | 'VIEW_PROPERTY' 
  | 'KEY_ACCESS' 
  | 'INSPECT_PREMISES' 
  | 'SOLICIT_QUOTES' 
  | 'AUTHORIZE_REPAIRS_WITHIN_LIMIT' 
  | 'CONDUCT_VISITS' 
  | 'COLLECT_RENT_PROOF';

export interface CaretakerProfileDto {
  id: string;
  userId: string;
  name: string;
  phone: string;
  experienceYears: number;
  serviceCities: string[];
  skills: string[];
  kycStatus: KycStatus;
  ratingAverage: number;
  completedTasksCount: number;
  isAvailable: boolean;
  createdAt: string;
}

export interface CaretakerAssignmentDto {
  id: string;
  propertyId: string;
  caretakerId: string;
  ownerId: string;
  status: AssignmentStatus;
  startDate: string;
  endDate?: string;
  monthlyFee: number;
  allowedPermissions: PermissionScope[];
  spendingThresholdLimit: number; // Single purchase authorization limit without prior owner sign-off
  acceptedAt?: string;
  terminatedAt?: string;
  createdAt: string;
}

export interface CreateCaretakerProfileRequestDto {
  phone: string;
  experienceYears: number;
  serviceCities: string[];
  skills: string[];
}

export interface AssignCaretakerRequestDto {
  propertyId: string;
  caretakerId: string;
  monthlyFee: number;
  allowedPermissions: PermissionScope[];
  spendingThresholdLimit?: number;
  startDate: string;
  endDate?: string;
}

export interface UpdatePermissionsRequestDto {
  allowedPermissions: PermissionScope[];
  spendingThresholdLimit?: number;
}

export interface CaretakerAssignedPayload {
  assignmentId: string;
  propertyId: string;
  caretakerId: string;
  ownerId: string;
  spendingThresholdLimit: number;
  allowedPermissions: PermissionScope[];
}

export type CaretakerAssignedIntegrationEvent = DomainIntegrationEvent<CaretakerAssignedPayload>;

export interface CaretakerAssignmentAcceptedPayload {
  assignmentId: string;
  propertyId: string;
  caretakerId: string;
  acceptedAt: string;
}

export type CaretakerAssignmentAcceptedIntegrationEvent = DomainIntegrationEvent<CaretakerAssignmentAcceptedPayload>;
