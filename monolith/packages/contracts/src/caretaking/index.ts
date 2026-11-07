import { DomainIntegrationEvent } from '../common/index.js';

export type KycStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';

export type AssignmentStatus = 
  | 'PENDING_ACCEPTANCE' 
  | 'ACTIVE' 
  | 'SUSPENDED' 
  | 'TERMINATED'
  | 'REJECTED';

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
  tenantId?: string;
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
  updatedAt?: string;
}

export interface CaretakerAssignmentDto {
  id: string;
  tenantId?: string;
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
  updatedAt?: string;
}

export interface CreateCaretakerProfileRequestDto {
  phone: string;
  experienceYears: number;
  serviceCities: string[];
  skills: string[];
  tenantId?: string;
}

export interface AssignCaretakerRequestDto {
  propertyId: string;
  caretakerId: string;
  monthlyFee: number;
  allowedPermissions: PermissionScope[];
  spendingThresholdLimit?: number;
  startDate?: string;
  endDate?: string;
  tenantId?: string;
}

export interface UpdateAssignmentPermissionsDto {
  allowedPermissions: PermissionScope[];
  spendingThresholdLimit?: number;
}

export type UpdatePermissionsRequestDto = UpdateAssignmentPermissionsDto;

export interface TerminateAssignmentRequestDto {
  reason?: string;
}

export interface CaretakerAssignedPayload {
  assignmentId: string;
  tenantId?: string;
  propertyId: string;
  caretakerId: string;
  ownerId: string;
  spendingThresholdLimit: number;
  allowedPermissions: PermissionScope[];
}

export type CaretakerAssignedEvent = DomainIntegrationEvent<CaretakerAssignedPayload>;
export type CaretakerAssignedIntegrationEvent = CaretakerAssignedEvent;

export interface CaretakerAssignmentAcceptedPayload {
  assignmentId: string;
  tenantId?: string;
  propertyId: string;
  caretakerId: string;
  acceptedAt: string;
}

export type CaretakerAssignmentAcceptedEvent = DomainIntegrationEvent<CaretakerAssignmentAcceptedPayload>;
export type CaretakerAssignmentAcceptedIntegrationEvent = CaretakerAssignmentAcceptedEvent;

export interface AssignmentTerminatedPayload {
  assignmentId: string;
  tenantId?: string;
  propertyId: string;
  caretakerId: string;
  ownerId: string;
  terminatedAt: string;
  reason?: string;
}

export type AssignmentTerminatedEvent = DomainIntegrationEvent<AssignmentTerminatedPayload>;
export type AssignmentTerminatedIntegrationEvent = AssignmentTerminatedEvent;
