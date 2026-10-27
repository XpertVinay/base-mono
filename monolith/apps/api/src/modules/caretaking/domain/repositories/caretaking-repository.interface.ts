import { CaretakerProfile } from '../entities/caretaker-profile.entity.js';
import { CaretakerAssignment } from '../entities/caretaker-assignment.entity.js';

export interface ICaretakingRepository {
  // Profile
  saveProfile(profile: CaretakerProfile): Promise<void>;
  findProfileById(id: string): Promise<CaretakerProfile | null>;
  findProfileByUserId(userId: string): Promise<CaretakerProfile | null>;
  findAllProfiles(): Promise<CaretakerProfile[]>;

  // Assignment
  saveAssignment(assignment: CaretakerAssignment): Promise<void>;
  updateAssignment(assignment: CaretakerAssignment): Promise<void>;
  findAssignmentById(id: string): Promise<CaretakerAssignment | null>;
  findAssignmentsByPropertyId(propertyId: string): Promise<CaretakerAssignment[]>;
  findActiveAssignmentByPropertyId(propertyId: string): Promise<CaretakerAssignment | null>;
  findAssignmentsByCaretakerId(caretakerId: string): Promise<CaretakerAssignment[]>;
  findAssignmentsByOwnerId(ownerId: string): Promise<CaretakerAssignment[]>;
}
