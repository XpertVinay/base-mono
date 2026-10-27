import { DomainIntegrationEvent } from '../common/index.js';

export type MaintenancePriority = 
  | 'P1_EMERGENCY' 
  | 'P2_URGENT' 
  | 'P3_STANDARD' 
  | 'P4_ROUTINE';

export type MaintenanceStatus = 
  | 'REPORTED' 
  | 'TRIAGED' 
  | 'EMERGENCY_MOBILIZED' 
  | 'QUOTED' 
  | 'APPROVED' 
  | 'IN_PROGRESS' 
  | 'COMPLETED' 
  | 'ESCALATED' 
  | 'DISPUTED';

export type MaintenanceCategory = 
  | 'PLUMBING' 
  | 'ELECTRICAL' 
  | 'STRUCTURAL_SEEPAGE' 
  | 'HVAC_COOLING' 
  | 'SECURITY_LOCKS' 
  | 'CARPENTRY' 
  | 'PAINTING_AESTHETICS' 
  | 'APPLIANCE';

export interface SlaTargetDto {
  responseDeadline: string;  // e.g. 15 mins for P1, 1 hr for P2, 4 hr for P3, 24 hr for P4
  resolutionDeadline: string; // e.g. 4 hrs for P1, 24 hrs for P2, 72 hrs for P3, scheduled for P4
  isResponseBreached: boolean;
  isResolutionBreached: boolean;
}

export interface QuotationDto {
  id: string;
  vendorId: string;
  vendorName: string;
  estimatedCost: number;
  breakdown: string;
  validUntil: string;
  isOwnerApproved: boolean;
  approvedAt?: string;
}

export interface ProofOfWorkDto {
  beforePhotoUrls: string[];
  afterPhotoUrls: string[];
  receiptUrls: string[];
  gpsLatitude: number;
  gpsLongitude: number;
  vendorSignatureTimestamp: string;
  caretakerVerifiedTimestamp?: string;
  finalCost: number;
}

export interface MaintenanceRequestDto {
  id: string;
  propertyId: string;
  reporterId: string;
  reporterRole: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  title: string;
  description: string;
  photoUrls: string[];
  sla: SlaTargetDto;
  isEmergencyFloatCovered: boolean;
  emergencyAmountDrawn: number;
  selectedQuotation?: QuotationDto;
  proofOfWork?: ProofOfWorkDto;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMaintenanceRequestDto {
  propertyId: string;
  category: MaintenanceCategory;
  title: string;
  description: string;
  photoUrls?: string[];
  reportedUrgency?: 'EMERGENCY' | 'URGENT' | 'NORMAL' | 'LOW';
}

export interface SubmitQuotationDto {
  vendorId: string;
  vendorName: string;
  estimatedCost: number;
  breakdown: string;
}

export interface CompleteMaintenanceWorkDto {
  beforePhotoUrls: string[];
  afterPhotoUrls: string[];
  receiptUrls: string[];
  gpsLatitude: number;
  gpsLongitude: number;
  finalCost: number;
}

export interface MaintenanceReportedPayload {
  requestId: string;
  propertyId: string;
  reporterId: string;
  priority: MaintenancePriority;
  category: MaintenanceCategory;
  isEmergency: boolean;
}

export type MaintenanceReportedIntegrationEvent = DomainIntegrationEvent<MaintenanceReportedPayload>;

export interface MaintenanceEmergencyMobilizedPayload {
  requestId: string;
  propertyId: string;
  emergencyAmountAuthorized: number;
  mobilizedAt: string;
}

export type MaintenanceEmergencyMobilizedIntegrationEvent = DomainIntegrationEvent<MaintenanceEmergencyMobilizedPayload>;

export interface MaintenanceCompletedPayload {
  requestId: string;
  propertyId: string;
  finalCost: number;
  completedAt: string;
}

export type MaintenanceCompletedIntegrationEvent = DomainIntegrationEvent<MaintenanceCompletedPayload>;
