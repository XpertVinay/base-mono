import { Router } from 'express';
import { PostgresMaintenanceRepository } from './infrastructure/persistence/postgres-maintenance.repository.js';
import { SubmitRequestUseCase } from './application/commands/submit-request.use-case.js';
import { SubmitQuotationUseCase } from './application/commands/submit-quotation.use-case.js';
import { ApproveQuotationUseCase } from './application/commands/approve-quotation.use-case.js';
import { CompleteWorkUseCase } from './application/commands/complete-work.use-case.js';
import { ListMaintenanceQuery } from './application/queries/list-maintenance.query.js';
import { MaintenanceController } from './presentation/http/maintenance.controller.js';
import { createMaintenanceRouter } from './presentation/http/maintenance.routes.js';
import { container } from '../../bootstrap/container.js';
import { MaintenanceRequestDto } from '@monolith/contracts';

export interface IMaintenanceModulePublicApi {
  getRequestById(id: string): Promise<MaintenanceRequestDto | null>;
  getActiveRequestsForProperty(propertyId: string): Promise<MaintenanceRequestDto[]>;
}

export class MaintenanceModule {
  public static init(): { router: Router; publicApi: IMaintenanceModulePublicApi } {
    const repository = new PostgresMaintenanceRepository();
    const submitRequestUseCase = new SubmitRequestUseCase(repository);
    const submitQuotationUseCase = new SubmitQuotationUseCase(repository);
    const approveQuotationUseCase = new ApproveQuotationUseCase(repository);
    const completeWorkUseCase = new CompleteWorkUseCase(repository);
    const listMaintenanceQuery = new ListMaintenanceQuery(repository);

    const controller = new MaintenanceController(
      submitRequestUseCase,
      submitQuotationUseCase,
      approveQuotationUseCase,
      completeWorkUseCase,
      listMaintenanceQuery
    );
    const router = createMaintenanceRouter(controller);

    const publicApi: IMaintenanceModulePublicApi = {
      getRequestById: async (id: string) => {
        const req = await repository.findById(id);
        if (!req) return null;
        return {
          id: req.id,
          propertyId: req.propertyId,
          reporterId: req.reporterId,
          reporterRole: req.reporterRole,
          category: req.category,
          priority: req.priority,
          status: req.status,
          title: req.title,
          description: req.description,
          photoUrls: req.photoUrls,
          sla: req.sla,
          isEmergencyFloatCovered: req.isEmergencyFloatCovered,
          emergencyAmountDrawn: req.emergencyAmountDrawn,
          selectedQuotation: req.selectedQuotation || undefined,
          proofOfWork: req.proofOfWork || undefined,
          createdAt: req.createdAt.toISOString(),
          updatedAt: req.updatedAt.toISOString()
        };
      },
      getActiveRequestsForProperty: async (propertyId: string) => {
        const list = await repository.findByPropertyId(propertyId);
        return list
          .filter(r => r.status !== 'COMPLETED')
          .map(req => ({
            id: req.id,
            propertyId: req.propertyId,
            reporterId: req.reporterId,
            reporterRole: req.reporterRole,
            category: req.category,
            priority: req.priority,
            status: req.status,
            title: req.title,
            description: req.description,
            photoUrls: req.photoUrls,
            sla: req.sla,
            isEmergencyFloatCovered: req.isEmergencyFloatCovered,
            emergencyAmountDrawn: req.emergencyAmountDrawn,
            selectedQuotation: req.selectedQuotation || undefined,
            proofOfWork: req.proofOfWork || undefined,
            createdAt: req.createdAt.toISOString(),
            updatedAt: req.updatedAt.toISOString()
          }));
      }
    };

    container.register('IMaintenanceModulePublicApi', publicApi);
    return { router, publicApi };
  }
}
