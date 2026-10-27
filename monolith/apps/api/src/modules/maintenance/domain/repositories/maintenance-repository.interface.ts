import { MaintenanceRequest } from '../entities/maintenance-request.entity.js';

export interface IMaintenanceRepository {
  save(request: MaintenanceRequest): Promise<void>;
  update(request: MaintenanceRequest): Promise<void>;
  findById(id: string): Promise<MaintenanceRequest | null>;
  findByPropertyId(propertyId: string): Promise<MaintenanceRequest[]>;
  findByReporterId(reporterId: string): Promise<MaintenanceRequest[]>;
  findAll(): Promise<MaintenanceRequest[]>;
}
