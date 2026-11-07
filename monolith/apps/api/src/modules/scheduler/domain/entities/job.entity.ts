import { Entity } from '../../../../shared/domain/entity.js';
import { JobStatus } from '@monolith/contracts';
import { v4 as uuidv4 } from 'uuid';

export interface ScheduledJobProps {
  name: string;
  cronExpression: string;
  status: JobStatus;
  tenantId?: string;
  lastRunAt?: Date;
  nextRunAt?: Date;
  failureReason?: string;
  createdAt: Date;
}

export class ScheduledJob extends Entity<ScheduledJobProps> {
  private constructor(id: string, props: ScheduledJobProps) {
    super(id, props);
  }

  get name(): string { return this.props.name; }
  get cronExpression(): string { return this.props.cronExpression; }
  get status(): JobStatus { return this.props.status; }
  get tenantId(): string | undefined { return this.props.tenantId; }
  get lastRunAt(): Date | undefined { return this.props.lastRunAt; }
  get nextRunAt(): Date | undefined { return this.props.nextRunAt; }
  get failureReason(): string | undefined { return this.props.failureReason; }
  get createdAt(): Date { return this.props.createdAt; }

  public startExecution(): void {
    this.props.status = 'RUNNING';
  }

  public recordExecutionSuccess(nextRunAt?: Date): void {
    this.props.status = 'COMPLETED';
    this.props.lastRunAt = new Date();
    this.props.failureReason = undefined;
    if (nextRunAt) {
      this.props.nextRunAt = nextRunAt;
    }
  }

  public recordExecutionFailure(reason?: string): void {
    this.props.status = 'FAILED';
    this.props.lastRunAt = new Date();
    this.props.failureReason = reason;
  }

  public static create(name: string, cronExpression: string, tenantId?: string, id?: string): ScheduledJob {
    return new ScheduledJob(id || uuidv4(), {
      name,
      cronExpression,
      tenantId,
      status: 'SCHEDULED',
      createdAt: new Date()
    });
  }

  public static reconstitute(id: string, props: ScheduledJobProps): ScheduledJob {
    return new ScheduledJob(id, { ...props });
  }
}
