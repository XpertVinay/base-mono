import { Router } from 'express';
import { ISchedulerRepository } from './domain/repositories/scheduler-repository.interface.js';
import { PostgresSchedulerRepository } from './infrastructure/persistence/postgres-scheduler.repository.js';
import {
  ListJobsQuery,
  GetJobByIdQuery,
  CreateJobUseCase,
  TriggerJobUseCase,
  ListJobRunsQuery
} from './application/use-cases/scheduler.use-cases.js';
import { SchedulerController } from './presentation/http/scheduler.controller.js';
import { createSchedulerRouter } from './presentation/http/scheduler.routes.js';
import { container } from '../../bootstrap/container.js';
import { logger } from '../../shared/infrastructure/logger.js';
import { ScheduledJobDto } from '@monolith/contracts';

export interface ISchedulerModulePublicApi {
  registerJobTask(jobName: string, task: () => Promise<void>): void;
  triggerJob(id: string, tenantId?: string): Promise<ScheduledJobDto>;
}

export class SchedulerModule {
  public static init(customRepository?: ISchedulerRepository): {
    router: Router;
    publicApi: ISchedulerModulePublicApi;
    repository: ISchedulerRepository;
  } {
    const repository = customRepository || new PostgresSchedulerRepository();
    const jobTasks = new Map<string, () => Promise<void>>();

    // Register default system tasks
    jobTasks.set('OUTBOX_EVENT_DISPATCHER', async () => {
      logger.info('Executing scheduled Outbox Event Dispatcher scan');
    });

    const listJobsQuery = new ListJobsQuery(repository);
    const getJobByIdQuery = new GetJobByIdQuery(repository);
    const createJobUseCase = new CreateJobUseCase(repository);
    const triggerJobUseCase = new TriggerJobUseCase(repository, jobTasks);
    const listJobRunsQuery = new ListJobRunsQuery(repository);

    const controller = new SchedulerController(
      listJobsQuery,
      getJobByIdQuery,
      createJobUseCase,
      triggerJobUseCase,
      listJobRunsQuery
    );
    const router = createSchedulerRouter(controller);

    const publicApi: ISchedulerModulePublicApi = {
      registerJobTask: (jobName, task) => {
        jobTasks.set(jobName, task);
        logger.info(`Scheduler registered task for: ${jobName}`);
      },
      triggerJob: async (id, tenantId) => {
        const res = await triggerJobUseCase.execute({ id, tenantId });
        if (res.isFailure) {
          throw res.getError();
        }
        return res.getValue();
      }
    };

    container.register('ISchedulerModulePublicApi', publicApi);
    return { router, publicApi, repository };
  }
}
