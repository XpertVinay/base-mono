import { DomainIntegrationEvent } from '../common/index.js';

export type DocumentType = 
  | 'TITLE_DEED' 
  | 'PROPERTY_TAX_RECEIPT' 
  | 'ENCUMBRANCE_CERTIFICATE' 
  | 'OCCUPANCY_CERTIFICATE' 
  | 'NOC' 
  | 'LEASE_AGREEMENT' 
  | 'SALE_AGREEMENT' 
  | 'INSPECTION_REPORT' 
  | 'CARETAKER_KYC' 
  | 'TENANT_ID_PROOF';

export type DocumentVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface PropertyDocumentDto {
  id: string;
  propertyId: string;
  uploaderId: string;
  documentType: DocumentType;
  title: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  verificationStatus: DocumentVerificationStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  createdAt: string;
}

export interface UploadDocumentRequestDto {
  propertyId: string;
  documentType: DocumentType;
  title: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
}

export interface DocumentUploadedPayload {
  documentId: string;
  propertyId: string;
  uploaderId: string;
  documentType: DocumentType;
}

export type DocumentUploadedIntegrationEvent = DomainIntegrationEvent<DocumentUploadedPayload>;
