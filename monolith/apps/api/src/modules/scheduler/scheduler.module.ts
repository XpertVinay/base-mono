import { Router } from 'express';
import { PostgresSchedulerRepository } from './infrastructure/persistence/postgres-scheduler.repository.js';
import { ListJobsQuery, CreateJobUseCase, TriggerJobUseCase } from './application/use-cases/scheduler.use-cases.js';
import { SchedulerController } from './presentation/http/scheduler.controller.js';
import { createSchedulerRouter } from './presentation/http/scheduler.routes.js';
import { container } from '../../bootstrap/container.js';
import { logger } from '../../shared/infrastructure/logger.js';

export interface ISchedulerModulePublicApi {
  registerJobTask(jobName: string, task: () => Promise<void>): void;
}

export class SchedulerModule {
  public static init(): { router: Router; publicApi: ISchedulerModulePublicApi } {
    const repository = new PostgresSchedulerRepository();
    const jobTasks = new Map<string, () => Promise<void>>();

    // Register a sample task
    jobTasks.set('OUTBOX_EVENT_DISPATCHER', async () => {
      logger.info('Executing scheduled Outbox Event Dispatcher scan');
    });

    const listJobsQuery = new ListJobsQuery(repository);
    const createJobUseCase = new CreateJobUseCase(repository);
    const triggerJobUseCase = new TriggerJobUseCase(repository, jobTasks);

    const controller = new SchedulerController(listJobsQuery, createJobUseCase, triggerJobUseCase);
    const router = createSchedulerRouter(controller);

    const publicApi: ISchedulerModulePublicApi = {
      registerJobTask: (jobName, task) => {
        jobTasks.set(jobName, task);
        logger.info(`Scheduler registered task for: ${jobName}`);
      }
    };

    container.register('ISchedulerModulePublicApi', publicApi);
    return { router, publicApi };
  }
}
