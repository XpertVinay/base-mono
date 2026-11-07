import { describe, it, expect, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { InMemoryEventBus } from '../../infrastructure/messaging/event-bus.js';
import { NotFoundError } from '../../shared/presentation/error-handler.middleware.js';

// Notification Module
import {
  PostgresNotificationRepository,
  DynamicNotificationRouter,
  DryRunOutboxService,
  MockNotificationAdapter,
  SendGridEmailAdapter,
  TwilioSmsAdapter,
  MetaWhatsAppAdapter,
  FcmPushAdapter,
  SendNotificationUseCase,
  SendBatchNotificationUseCase,
  ListNotificationsQuery,
  GetNotificationByIdQuery,
  GetNotificationConfigQuery,
  GetDryRunOutboxQuery,
  ClearDryRunOutboxUseCase,
  HandleNotificationWebhookUseCase,
  NotificationController,
  NotificationModule
} from '../../modules/notification/index.js';

// Scheduler Module
import {
  ScheduledJob,
  PostgresSchedulerRepository,
  CreateJobUseCase,
  TriggerJobUseCase,
  ListJobsQuery,
  GetJobByIdQuery,
  ListJobRunsQuery,
  SchedulerController,
  SchedulerModule
} from '../../modules/scheduler/index.js';

// Search Module
import {
  PostgresSearchRepository,
  IndexDocumentUseCase,
  SearchQueryUseCase,
  GetSearchDocumentByIdQuery,
  DeleteSearchDocumentUseCase,
  SearchController,
  SearchModule
} from '../../modules/search/index.js';

function createMockResponse() {
  const res: Partial<Response> & { _statusCode: number; _jsonData: any } = {
    _statusCode: 200,
    _jsonData: null,
    status(code: number) {
      this._statusCode = code;
      return this as Response;
    },
    json(data: any) {
      this._jsonData = data;
      return this as Response;
    }
  };
  return res as Response & { _statusCode: number; _jsonData: any };
}

describe('Sprint 10: Shared Services — Notifications, Job Scheduler & Full-Text Search', () => {
  const TENANT_A = 'tenant-alfa-01';
  const TENANT_B = 'tenant-bravo-02';

  // ---------------------------------------------------------------------------
  // 1. MULTI-TENANT NOTIFICATION MODULE TESTS
  // ---------------------------------------------------------------------------
  describe('1. Multi-Tenant Notification Engine & Multi-Channel Dispatch', () => {
    let notifRepo: PostgresNotificationRepository;
    let notifRouter: DynamicNotificationRouter;
    let dryRunOutbox: DryRunOutboxService;
    let eventBus: InMemoryEventBus;
    let sendUseCase: SendNotificationUseCase;
    let sendBatchUseCase: SendBatchNotificationUseCase;
    let listQuery: ListNotificationsQuery;
    let getByIdQuery: GetNotificationByIdQuery;

    beforeEach(() => {
      notifRepo = new PostgresNotificationRepository();
      dryRunOutbox = DryRunOutboxService.getInstance();
      dryRunOutbox.clear();
      eventBus = new InMemoryEventBus();

      const mockAdapter = new MockNotificationAdapter();
      const sendGrid = new SendGridEmailAdapter();
      const twilio = new TwilioSmsAdapter();
      const meta = new MetaWhatsAppAdapter();
      const fcm = new FcmPushAdapter();

      notifRouter = new DynamicNotificationRouter(async () => '', [
        mockAdapter,
        sendGrid,
        twilio,
        meta,
        fcm
      ]);

      sendUseCase = new SendNotificationUseCase(notifRepo, notifRouter, eventBus);
      sendBatchUseCase = new SendBatchNotificationUseCase(sendUseCase);
      listQuery = new ListNotificationsQuery(notifRepo);
      getByIdQuery = new GetNotificationByIdQuery(notifRepo);
    });

    it('1.1 should create and dispatch notifications across EMAIL, SMS, WHATSAPP, and PUSH', async () => {
      const channels = [
        { channel: 'EMAIL' as const, recipient: 'alfa@tenant.com', provider: 'SENDGRID' as const },
        { channel: 'SMS' as const, recipient: '+1234567890', provider: 'TWILIO' as const },
        { channel: 'WHATSAPP' as const, recipient: '+1234567890', provider: 'META_CLOUD' as const },
        { channel: 'PUSH' as const, recipient: 'device-token-abc', provider: 'FCM' as const }
      ];

      for (const item of channels) {
        const result = await sendUseCase.execute({
          tenantId: TENANT_A,
          channel: item.channel,
          recipient: item.recipient,
          subject: `Test ${item.channel}`,
          body: `Body content for ${item.channel}`,
          provider: item.provider,
          dryRun: true
        });

        expect(result.isSuccess).toBe(true);
        const dto = result.getValue();
        expect(dto.tenantId).toBe(TENANT_A);
        expect(dto.channel).toBe(item.channel);
        expect(dto.provider).toBe(item.provider);
        expect(dto.status).toBe('SENT');
        expect(dto.isDryRun).toBe(true);
      }
    });

    it('1.2 should strictly isolate notifications between tenants in queries', async () => {
      // Send notification for Tenant A
      const notifA = await sendUseCase.execute({
        tenantId: TENANT_A,
        channel: 'EMAIL',
        recipient: 'tenantA-user@example.com',
        subject: 'Invoice for Tenant A',
        body: 'Amount due: $500',
        dryRun: true
      });
      expect(notifA.isSuccess).toBe(true);

      // Send notification for Tenant B
      const notifB = await sendUseCase.execute({
        tenantId: TENANT_B,
        channel: 'SMS',
        recipient: '+9876543210',
        subject: 'Tenant B Alert',
        body: 'Maintenance scheduled',
        dryRun: true
      });
      expect(notifB.isSuccess).toBe(true);

      const notifAId = notifA.getValue().id;
      const notifBId = notifB.getValue().id;

      // Tenant A queries by id
      const queryA = await getByIdQuery.execute({ id: notifAId, tenantId: TENANT_A });
      expect(queryA.isSuccess).toBe(true);
      expect(queryA.getValue()!.id).toBe(notifAId);

      // Tenant B queries Tenant A's notification -> must fail with NotFoundError
      const queryCrossTenant = await getByIdQuery.execute({ id: notifAId, tenantId: TENANT_B });
      expect(queryCrossTenant.isFailure).toBe(true);
      expect(queryCrossTenant.getError()).toBeInstanceOf(NotFoundError);

      // Tenant A lists notifications -> only sees Tenant A's notifications
      const listA = await listQuery.execute({ tenantId: TENANT_A });
      expect(listA.isSuccess).toBe(true);
      const listAItems = listA.getValue();
      expect(listAItems.some(n => n.id === notifAId)).toBe(true);
      expect(listAItems.some(n => n.id === notifBId)).toBe(false);

      // Tenant B lists notifications -> only sees Tenant B's notifications
      const listB = await listQuery.execute({ tenantId: TENANT_B });
      expect(listB.isSuccess).toBe(true);
      const listBItems = listB.getValue();
      expect(listBItems.some(n => n.id === notifBId)).toBe(true);
      expect(listBItems.some(n => n.id === notifAId)).toBe(false);
    });

    it('1.3 should execute batch notification dispatch preserving per-item tenant context', async () => {
      const batchResult = await sendBatchUseCase.execute({
        dryRun: true,
        notifications: [
          {
            tenantId: TENANT_A,
            channel: 'EMAIL',
            recipient: 'user1@alfa.com',
            subject: 'Batch item 1',
            body: 'Hello User 1'
          },
          {
            tenantId: TENANT_A,
            channel: 'EMAIL',
            recipient: 'user2@alfa.com',
            subject: 'Batch item 2',
            body: 'Hello User 2'
          }
        ]
      });

      expect(batchResult.isSuccess).toBe(true);
      const val = batchResult.getValue();
      expect(val.total).toBe(2);
      expect(val.sentCount).toBe(2);
      expect(val.failedCount).toBe(0);
      expect(val.results[0]?.recipient).toBe('user1@alfa.com');
      expect(val.results[1]?.recipient).toBe('user2@alfa.com');
    });

    it('1.4 should interpolate template data and capture dry-run outbox entries', async () => {
      const result = await sendUseCase.execute({
        tenantId: TENANT_A,
        channel: 'EMAIL',
        recipient: 'template-user@alfa.com',
        subject: 'Hello {{name}}',
        body: 'Your total balance is {{balance}} USD.',
        templateData: { name: 'Alice', balance: '1,250.00' },
        dryRun: true
      });

      expect(result.isSuccess).toBe(true);
      const dto = result.getValue();
      expect(dto.subject).toBe('Hello Alice');
      expect(dto.body).toContain('Your total balance is 1,250.00 USD.');

      const outboxItems = dryRunOutbox.getAll(TENANT_A);
      const matchingOutbox = outboxItems.find((o: any) => o.recipient === 'template-user@alfa.com');
      expect(matchingOutbox).toBeDefined();
      expect(matchingOutbox?.tenantId).toBe(TENANT_A);
    });

    it('1.5 should listen to domain event orders.order_created and dispatch tenant-scoped notification', async () => {
      const customBus = new InMemoryEventBus();
      NotificationModule.init(notifRepo, notifRouter, customBus);

      await customBus.publish({
        id: 'event-order-001',
        eventName: 'orders.order_created',
        aggregateId: 'order-12345',
        occurredAt: new Date().toISOString(),
        version: 1,
        payload: {
          orderId: 'order-12345-uuid',
          userId: 'user-alfa-77',
          tenantId: TENANT_A,
          totalAmount: 350.50,
          currency: 'USD',
          items: [{ productId: 'p1', quantity: 2 }]
        }
      });

      // Query notifications for Tenant A
      const tenantANotifs = await notifRepo.findAll(10, { tenantId: TENANT_A });
      const orderNotif = tenantANotifs.find(n => n.recipient === 'user-user-alfa-77@notification.local');
      expect(orderNotif).toBeDefined();
      expect(orderNotif?.tenantId).toBe(TENANT_A);
      expect(orderNotif?.subject).toContain('Order #order-12 Confirmation');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. MULTI-TENANT SCHEDULER MODULE TESTS
  // ---------------------------------------------------------------------------
  describe('2. Multi-Tenant Job Scheduler & Execution Run History', () => {
    let schedulerRepo: PostgresSchedulerRepository;
    let jobTasks: Map<string, () => Promise<void>>;
    let createJobUseCase: CreateJobUseCase;
    let triggerJobUseCase: TriggerJobUseCase;
    let listJobsQuery: ListJobsQuery;
    let getJobByIdQuery: GetJobByIdQuery;
    let listJobRunsQuery: ListJobRunsQuery;

    beforeEach(() => {
      schedulerRepo = new PostgresSchedulerRepository();
      jobTasks = new Map();

      createJobUseCase = new CreateJobUseCase(schedulerRepo);
      triggerJobUseCase = new TriggerJobUseCase(schedulerRepo, jobTasks);
      listJobsQuery = new ListJobsQuery(schedulerRepo);
      getJobByIdQuery = new GetJobByIdQuery(schedulerRepo);
      listJobRunsQuery = new ListJobRunsQuery(schedulerRepo);
    });

    it('2.1 should create scheduled jobs partitioned by tenant', async () => {
      const jobA = await createJobUseCase.execute({
        name: 'TENANT_A_RENT_COLLECTION',
        cronExpression: '0 0 1 * *',
        tenantId: TENANT_A
      });

      const jobB = await createJobUseCase.execute({
        name: 'TENANT_B_CLEANING_AUDIT',
        cronExpression: '0 8 * * 1',
        tenantId: TENANT_B
      });

      expect(jobA.isSuccess).toBe(true);
      expect(jobB.isSuccess).toBe(true);
      expect(jobA.getValue().tenantId).toBe(TENANT_A);
      expect(jobB.getValue().tenantId).toBe(TENANT_B);
      expect(jobA.getValue().status).toBe('SCHEDULED');
    });

    it('2.2 should execute scheduled job and record run history with duration and COMPLETED status', async () => {
      let executedTask = false;
      jobTasks.set('TASK_EXECUTION_SUCCESS', async () => {
        executedTask = true;
      });

      const created = await createJobUseCase.execute({
        name: 'TASK_EXECUTION_SUCCESS',
        cronExpression: '*/5 * * * *',
        tenantId: TENANT_A
      });
      expect(created.isSuccess).toBe(true);
      const jobId = created.getValue().id;

      const triggerResult = await triggerJobUseCase.execute({ id: jobId, tenantId: TENANT_A });
      expect(triggerResult.isSuccess).toBe(true);
      expect(executedTask).toBe(true);
      expect(triggerResult.getValue().status).toBe('COMPLETED');
      expect(triggerResult.getValue().lastRunAt).toBeDefined();

      // Check run history
      const runs = await listJobRunsQuery.execute({ jobId, tenantId: TENANT_A });
      expect(runs.isSuccess).toBe(true);
      const runList = runs.getValue();
      expect(runList.length).toBe(1);
      expect(runList[0]?.status).toBe('COMPLETED');
      expect(runList[0]?.durationMs).toBeGreaterThanOrEqual(0);
      expect(runList[0]?.tenantId).toBe(TENANT_A);
    });

    it('2.3 should capture job execution failures gracefully and record FAILED run history', async () => {
      jobTasks.set('FAILING_JOB_TASK', async () => {
        throw new Error('Database connection timeout during sync');
      });

      const created = await createJobUseCase.execute({
        name: 'FAILING_JOB_TASK',
        cronExpression: '0 12 * * *',
        tenantId: TENANT_A
      });
      const jobId = created.getValue().id;

      const triggerResult = await triggerJobUseCase.execute({ id: jobId, tenantId: TENANT_A });
      expect(triggerResult.isSuccess).toBe(true);
      const jobDto = triggerResult.getValue();
      expect(jobDto.status).toBe('FAILED');
      expect(jobDto.failureReason).toBe('Database connection timeout during sync');

      // Check run history
      const runs = await listJobRunsQuery.execute({ jobId, tenantId: TENANT_A });
      expect(runs.isSuccess).toBe(true);
      const runList = runs.getValue();
      expect(runList.length).toBe(1);
      expect(runList[0]?.status).toBe('FAILED');
      expect(runList[0]?.failureReason).toBe('Database connection timeout during sync');
    });

    it('2.4 should strictly isolate scheduled jobs between tenants', async () => {
      const jobA = await createJobUseCase.execute({
        name: 'TENANT_A_EXCLUSIVE_JOB',
        cronExpression: '0 0 * * *',
        tenantId: TENANT_A
      });
      const jobAId = jobA.getValue().id;

      // Tenant B tries to fetch Tenant A's job -> NotFoundError
      const crossFetch = await getJobByIdQuery.execute({ id: jobAId, tenantId: TENANT_B });
      expect(crossFetch.isFailure).toBe(true);
      expect(crossFetch.getError()).toBeInstanceOf(NotFoundError);

      // Tenant B tries to trigger Tenant A's job -> NotFoundError
      const crossTrigger = await triggerJobUseCase.execute({ id: jobAId, tenantId: TENANT_B });
      expect(crossTrigger.isFailure).toBe(true);
      expect(crossTrigger.getError()).toBeInstanceOf(NotFoundError);

      // Tenant A lists jobs -> sees exclusive job
      const listA = await listJobsQuery.execute({ tenantId: TENANT_A });
      expect(listA.isSuccess).toBe(true);
      expect(listA.getValue().some(j => j.id === jobAId)).toBe(true);

      // Tenant B lists jobs -> does NOT see Tenant A's job
      const listB = await listJobsQuery.execute({ tenantId: TENANT_B });
      expect(listB.isSuccess).toBe(true);
      expect(listB.getValue().some(j => j.id === jobAId)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. MULTI-TENANT FULL-TEXT SEARCH MODULE TESTS
  // ---------------------------------------------------------------------------
  describe('3. Multi-Tenant Full-Text Search Engine & Projections', () => {
    let searchRepo: PostgresSearchRepository;
    let indexUseCase: IndexDocumentUseCase;
    let searchQueryUseCase: SearchQueryUseCase;
    let getByIdQuery: GetSearchDocumentByIdQuery;
    let deleteUseCase: DeleteSearchDocumentUseCase;

    beforeEach(() => {
      searchRepo = new PostgresSearchRepository();
      indexUseCase = new IndexDocumentUseCase(searchRepo);
      searchQueryUseCase = new SearchQueryUseCase(searchRepo);
      getByIdQuery = new GetSearchDocumentByIdQuery(searchRepo);
      deleteUseCase = new DeleteSearchDocumentUseCase(searchRepo);
    });

    it('3.1 should index documents across types and support keyword token searching', async () => {
      await indexUseCase.execute({
        id: 'prop-101',
        tenantId: TENANT_A,
        type: 'PROPERTY',
        title: 'Luxury Villa Sunset',
        description: 'Prime oceanfront villa with private swimming pool and garden',
        metadata: { bedrooms: 4, bathrooms: 3 }
      });

      await indexUseCase.execute({
        id: 'prop-102',
        tenantId: TENANT_A,
        type: 'PROPERTY',
        title: 'Downtown Executive Penthouse',
        description: 'High-rise apartment near financial center',
        metadata: { bedrooms: 2, bathrooms: 2 }
      });

      // Search keyword "oceanfront"
      const searchRes = await searchQueryUseCase.execute({
        tenantId: TENANT_A,
        query: 'oceanfront'
      });

      expect(searchRes.isSuccess).toBe(true);
      const items = searchRes.getValue();
      expect(items.length).toBe(1);
      expect(items[0]?.id).toBe('prop-101');
      expect(items[0]?.title).toBe('Luxury Villa Sunset');
    });

    it('3.2 should filter search queries by entity document type', async () => {
      await indexUseCase.execute({
        id: 'user-alfa-01',
        tenantId: TENANT_A,
        type: 'USER',
        title: 'John Smith Manager',
        description: 'Senior Property Manager for Sunset Villa'
      });

      await indexUseCase.execute({
        id: 'work-order-01',
        tenantId: TENANT_A,
        type: 'MAINTENANCE',
        title: 'HVAC repair for Sunset Villa',
        description: 'Air conditioning malfunction in master bedroom'
      });

      // Search query "Sunset Villa" filtered by type "MAINTENANCE"
      const maintenanceRes = await searchQueryUseCase.execute({
        tenantId: TENANT_A,
        query: 'Sunset Villa',
        type: 'MAINTENANCE'
      });

      expect(maintenanceRes.isSuccess).toBe(true);
      const items = maintenanceRes.getValue();
      expect(items.length).toBe(1);
      expect(items[0]?.id).toBe('work-order-01');
      expect(items[0]?.type).toBe('MAINTENANCE');

      // Filtered by type "USER"
      const userRes = await searchQueryUseCase.execute({
        tenantId: TENANT_A,
        query: 'Sunset Villa',
        type: 'USER'
      });
      expect(userRes.isSuccess).toBe(true);
      expect(userRes.getValue().length).toBe(1);
      expect(userRes.getValue()[0]?.id).toBe('user-alfa-01');
    });

    it('3.3 should strictly quarantine search documents between tenants', async () => {
      // Index document with identical keywords under Tenant A and Tenant B
      await indexUseCase.execute({
        id: 'doc-alfa-confidential',
        tenantId: TENANT_A,
        type: 'FINANCE',
        title: 'Q3 Financial Audit Confidential',
        description: 'Profit margin 32% for Alfa portfolio'
      });

      await indexUseCase.execute({
        id: 'doc-bravo-confidential',
        tenantId: TENANT_B,
        type: 'FINANCE',
        title: 'Q3 Financial Audit Confidential',
        description: 'Profit margin 18% for Bravo portfolio'
      });

      // Tenant A searches "Confidential"
      const resA = await searchQueryUseCase.execute({
        tenantId: TENANT_A,
        query: 'Confidential'
      });
      expect(resA.isSuccess).toBe(true);
      const itemsA = resA.getValue();
      expect(itemsA.length).toBe(1);
      expect(itemsA[0]?.id).toBe('doc-alfa-confidential');

      // Tenant B searches "Confidential"
      const resB = await searchQueryUseCase.execute({
        tenantId: TENANT_B,
        query: 'Confidential'
      });
      expect(resB.isSuccess).toBe(true);
      const itemsB = resB.getValue();
      expect(itemsB.length).toBe(1);
      expect(itemsB[0]?.id).toBe('doc-bravo-confidential');

      // Tenant B tries to get Tenant A's document by id -> NotFoundError
      const crossGet = await getByIdQuery.execute({
        id: 'doc-alfa-confidential',
        tenantId: TENANT_B
      });
      expect(crossGet.isFailure).toBe(true);
      expect(crossGet.getError()).toBeInstanceOf(NotFoundError);
    });

    it('3.4 should support search document deletion with tenant isolation', async () => {
      await indexUseCase.execute({
        id: 'doc-to-delete',
        tenantId: TENANT_A,
        type: 'NOTE',
        title: 'Temporary Note',
        description: 'To be purged'
      });

      // Tenant B cannot delete Tenant A's document
      await deleteUseCase.execute({ id: 'doc-to-delete', tenantId: TENANT_B });
      const stillThere = await getByIdQuery.execute({ id: 'doc-to-delete', tenantId: TENANT_A });
      expect(stillThere.isSuccess).toBe(true);

      // Tenant A deletes the document
      await deleteUseCase.execute({ id: 'doc-to-delete', tenantId: TENANT_A });
      const nowGone = await getByIdQuery.execute({ id: 'doc-to-delete', tenantId: TENANT_A });
      expect(nowGone.isFailure).toBe(true);
    });

    it('3.5 should asynchronously project domain events to search index with tenantId', async () => {
      const customBus = new InMemoryEventBus();
      SearchModule.init(searchRepo, customBus);

      await customBus.publish({
        id: 'evt-order-projection-1',
        eventName: 'orders.order_created',
        aggregateId: 'order-proj-777',
        occurredAt: new Date().toISOString(),
        version: 1,
        payload: {
          orderId: 'order-proj-777-uuid',
          userId: 'user-buyer-88',
          tenantId: TENANT_A,
          totalAmount: 1200.00,
          currency: 'USD',
          items: [{ productId: 'item-1', quantity: 3 }]
        }
      });

      const searchRes = await searchQueryUseCase.execute({
        tenantId: TENANT_A,
        query: 'Order #order-pr'
      });

      expect(searchRes.isSuccess).toBe(true);
      const items = searchRes.getValue();
      expect(items.length).toBe(1);
      expect(items[0]?.id).toBe('order-proj-777-uuid');
      expect(items[0]?.type).toBe('ORDER');
      expect(items[0]?.tenantId).toBe(TENANT_A);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. PRESENTATION BOUNDARY & CONTROLLERS
  // ---------------------------------------------------------------------------
  describe('4. Presentation HTTP Boundary & Request Context Tenant Extraction', () => {
    it('4.1 NotificationController should parse x-tenant-id and handle send & list', async () => {
      const repo = new PostgresNotificationRepository();
      const mockAdapter = new MockNotificationAdapter();
      const router = new DynamicNotificationRouter(async () => '', [mockAdapter]);
      const eventBus = new InMemoryEventBus();

      const sendUseCase = new SendNotificationUseCase(repo, router, eventBus);
      const sendBatchUseCase = new SendBatchNotificationUseCase(sendUseCase);
      const listQuery = new ListNotificationsQuery(repo);
      const getByIdQuery = new GetNotificationByIdQuery(repo);
      const getConfigQuery = new GetNotificationConfigQuery(router);
      const getDryRunOutboxQuery = new GetDryRunOutboxQuery();
      const clearDryRunOutboxUseCase = new ClearDryRunOutboxUseCase();
      const webhookUseCase = new HandleNotificationWebhookUseCase(repo);

      const controller = new NotificationController(
        sendUseCase,
        sendBatchUseCase,
        listQuery,
        getByIdQuery,
        getConfigQuery,
        getDryRunOutboxQuery,
        clearDryRunOutboxUseCase,
        webhookUseCase
      );

      // Send via controller with x-tenant-id header
      const reqSend = {
        headers: { 'x-tenant-id': TENANT_A },
        body: {
          recipient: 'controller-test@alfa.com',
          channel: 'EMAIL',
          subject: 'HTTP Test',
          body: 'Testing controller boundary',
          dryRun: true
        }
      } as unknown as Request;
      const resSend = createMockResponse();
      let nextCalled = false;
      await controller.send(reqSend, resSend, (err) => { if (err) nextCalled = true; });

      expect(nextCalled).toBe(false);
      expect(resSend._statusCode).toBe(201);
      expect(resSend._jsonData.success).toBe(true);
      expect(resSend._jsonData.data.tenantId).toBe(TENANT_A);

      // List via controller with x-tenant-id header
      const reqList = {
        headers: { 'x-tenant-id': TENANT_A },
        query: {}
      } as unknown as Request;
      const resList = createMockResponse();
      await controller.list(reqList, resList, () => {});

      expect(resList._statusCode).toBe(200);
      expect(resList._jsonData.data.length).toBeGreaterThanOrEqual(1);
    });

    it('4.2 SchedulerController should support create, trigger, and listRuns with tenant extraction', async () => {
      const repo = new PostgresSchedulerRepository();
      const jobTasks = new Map<string, () => Promise<void>>();
      jobTasks.set('AUDIT_RUNNER', async () => {});

      const listJobsQuery = new ListJobsQuery(repo);
      const getJobByIdQuery = new GetJobByIdQuery(repo);
      const createJobUseCase = new CreateJobUseCase(repo);
      const triggerJobUseCase = new TriggerJobUseCase(repo, jobTasks);
      const listJobRunsQuery = new ListJobRunsQuery(repo);

      const controller = new SchedulerController(
        listJobsQuery,
        getJobByIdQuery,
        createJobUseCase,
        triggerJobUseCase,
        listJobRunsQuery
      );

      // Create job
      const reqCreate = {
        headers: { 'x-tenant-id': TENANT_A },
        body: {
          name: 'AUDIT_RUNNER',
          cronExpression: '0 4 * * *'
        }
      } as unknown as Request;
      const resCreate = createMockResponse();
      await controller.create(reqCreate, resCreate, () => {});

      expect(resCreate._statusCode).toBe(201);
      const createdJobId = resCreate._jsonData.data.id;
      expect(resCreate._jsonData.data.tenantId).toBe(TENANT_A);

      // Trigger job
      const reqTrigger = {
        headers: { 'x-tenant-id': TENANT_A },
        params: { id: createdJobId }
      } as unknown as Request;
      const resTrigger = createMockResponse();
      await controller.trigger(reqTrigger, resTrigger, () => {});

      expect(resTrigger._statusCode).toBe(200);
      expect(resTrigger._jsonData.data.status).toBe('COMPLETED');

      // List runs
      const reqRuns = {
        headers: { 'x-tenant-id': TENANT_A },
        params: { id: createdJobId }
      } as unknown as Request;
      const resRuns = createMockResponse();
      await controller.listRuns(reqRuns, resRuns, () => {});

      expect(resRuns._statusCode).toBe(200);
      expect(resRuns._jsonData.data.length).toBe(1);
      expect(resRuns._jsonData.data[0].status).toBe('COMPLETED');
    });

    it('4.3 SearchController should index and query with tenant isolation', async () => {
      const repo = new PostgresSearchRepository();
      const indexUseCase = new IndexDocumentUseCase(repo);
      const searchQueryUseCase = new SearchQueryUseCase(repo);
      const getByIdQuery = new GetSearchDocumentByIdQuery(repo);
      const deleteUseCase = new DeleteSearchDocumentUseCase(repo);

      const controller = new SearchController(
        searchQueryUseCase,
        indexUseCase,
        getByIdQuery,
        deleteUseCase
      );

      // Index via controller
      const reqIndex = {
        headers: { 'x-tenant-id': TENANT_A },
        body: {
          id: 'search-ctrl-doc-1',
          type: 'PROPERTY',
          title: 'Coastal Haven Cottage',
          description: 'Seaside cottage with private dock'
        }
      } as unknown as Request;
      const resIndex = createMockResponse();
      await controller.index(reqIndex, resIndex, () => {});

      expect(resIndex._statusCode).toBe(201);

      // Search via controller for Tenant A
      const reqSearch = {
        headers: { 'x-tenant-id': TENANT_A },
        query: { q: 'Seaside' }
      } as unknown as Request;
      const resSearch = createMockResponse();
      await controller.search(reqSearch, resSearch, () => {});

      expect(resSearch._statusCode).toBe(200);
      expect(resSearch._jsonData.data.length).toBe(1);
      expect(resSearch._jsonData.data[0].id).toBe('search-ctrl-doc-1');

      // Search via controller for Tenant B -> empty results
      const reqSearchB = {
        headers: { 'x-tenant-id': TENANT_B },
        query: { q: 'Seaside' }
      } as unknown as Request;
      const resSearchB = createMockResponse();
      await controller.search(reqSearchB, resSearchB, () => {});

      expect(resSearchB._statusCode).toBe(200);
      expect(resSearchB._jsonData.data.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. PUBLIC API & CROSS-MODULE INTEGRATION FACADES
  // ---------------------------------------------------------------------------
  describe('5. Shared Services Public API Facades', () => {
    it('5.1 NotificationModule publicApi should send and query dry-run state', async () => {
      const { publicApi } = NotificationModule.init();

      const notif = await publicApi.send({
        tenantId: TENANT_A,
        recipient: 'public-api@alfa.com',
        channel: 'EMAIL',
        subject: 'Public API Notification',
        body: 'Dispatched through public facade',
        dryRun: true
      });

      expect(notif).not.toBeNull();
      expect(notif?.recipient).toBe('public-api@alfa.com');
      expect(notif?.tenantId).toBe(TENANT_A);

      const isDryRun = await publicApi.isDryRunActive();
      expect(typeof isDryRun).toBe('boolean');
    });

    it('5.2 SchedulerModule publicApi should register tasks and trigger execution', async () => {
      const { publicApi, repository } = SchedulerModule.init();
      let customTaskExecuted = false;

      publicApi.registerJobTask('CUSTOM_PUBLIC_TASK', async () => {
        customTaskExecuted = true;
      });

      const job = ScheduledJob.create('CUSTOM_PUBLIC_TASK', '0 0 * * *', TENANT_A);
      await repository.save(job);

      const triggered = await publicApi.triggerJob(job.id, TENANT_A);
      expect(triggered.status).toBe('COMPLETED');
      expect(customTaskExecuted).toBe(true);
    });

    it('5.3 SearchModule publicApi should index, search, and retrieve documents', async () => {
      const { publicApi } = SearchModule.init();

      await publicApi.index({
        id: 'public-search-doc-01',
        tenantId: TENANT_A,
        type: 'ARTICLE',
        title: 'Guide to Real Estate Caretaking',
        description: 'Comprehensive manual for property operations'
      });

      const results = await publicApi.search('Caretaking', 'ARTICLE', TENANT_A);
      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe('public-search-doc-01');

      const doc = await publicApi.getById('public-search-doc-01', TENANT_A);
      expect(doc).not.toBeNull();
      expect(doc?.title).toBe('Guide to Real Estate Caretaking');

      // Tenant B query should return nothing
      const resultsB = await publicApi.search('Caretaking', 'ARTICLE', TENANT_B);
      expect(resultsB.length).toBe(0);
    });
  });
});
