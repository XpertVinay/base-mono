import { CaretakerProfile } from '../entities/caretaker-profile.entity.js';
import { CaretakerAssignment } from '../entities/caretaker-assignment.entity.js';
import { AssignmentStatus } from '@monolith/contracts';

export interface AssignmentFilter {
  tenantId?: string;
  propertyId?: string;
  caretakerId?: string;
  ownerId?: string;
  status?: AssignmentStatus;
}

export interface ICaretakingRepository {
  // Profile
  saveProfile(profile: CaretakerProfile): Promise<void>;
  findProfileById(id: string, tenantId?: string): Promise<CaretakerProfile | null>;
  findProfileByUserId(userId: string, tenantId?: string): Promise<CaretakerProfile | null>;
  findAllProfiles(tenantId?: string): Promise<CaretakerProfile[]>;

  // Assignment
  saveAssignment(assignment: CaretakerAssignment): Promise<void>;
  updateAssignment(assignment: CaretakerAssignment): Promise<void>;
  findAssignmentById(id: string, tenantId?: string): Promise<CaretakerAssignment | null>;
  findAssignmentsByPropertyId(propertyId: string, tenantId?: string): Promise<CaretakerAssignment[]>;
  findActiveAssignmentByPropertyId(propertyId: string, tenantId?: string): Promise<CaretakerAssignment | null>;
  findAssignmentsByCaretakerId(caretakerId: string, tenantId?: string): Promise<CaretakerAssignment[]>;
  findAssignmentsByOwnerId(ownerId: string, tenantId?: string): Promise<CaretakerAssignment[]>;
  findAssignments(filter: AssignmentFilter): Promise<CaretakerAssignment[]>;
}
