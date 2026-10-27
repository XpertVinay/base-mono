import { DomainIntegrationEvent } from '../common/index.js';

export type ExpenseType = 
  | 'MAINTENANCE_REPAIR' 
  | 'CARETAKER_RETAINER' 
  | 'EMERGENCY_FLOAT_REPLENISHMENT' 
  | 'PROPERTY_TAX' 
  | 'UTILITY_BILL' 
  | 'DOCUMENTATION_FEE';

export type PaymentStatus = 
  | 'PENDING_APPROVAL' 
  | 'APPROVED' 
  | 'PROCESSING' 
  | 'SETTLED' 
  | 'DISPUTED' 
  | 'REJECTED';

export interface ExpenseRecordDto {
  id: string;
  propertyId: string;
  creatorId: string;
  payeeName: string;
  expenseType: ExpenseType;
  amount: number;
  description: string;
  invoiceUrl?: string;
  status: PaymentStatus;
  approvedBy?: string;
  approvedAt?: string;
  settledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseRequestDto {
  propertyId: string;
  payeeName: string;
  expenseType: ExpenseType;
  amount: number;
  description: string;
  invoiceUrl?: string;
}

export interface ApproveExpenseRequestDto {
  status: 'APPROVED' | 'REJECTED';
  reason?: string;
}

export interface ExpenseRecordedPayload {
  expenseId: string;
  propertyId: string;
  amount: number;
  expenseType: ExpenseType;
}

export type ExpenseRecordedIntegrationEvent = DomainIntegrationEvent<ExpenseRecordedPayload>;

export interface ExpenseSettledPayload {
  expenseId: string;
  propertyId: string;
  amount: number;
  settledAt: string;
}

export type ExpenseSettledIntegrationEvent = DomainIntegrationEvent<ExpenseSettledPayload>;
