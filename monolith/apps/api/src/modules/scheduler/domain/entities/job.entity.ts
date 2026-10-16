import { Entity } from '../../../../shared/domain/entity.js';
import { JobStatus } from '@monolith/contracts';
import { v4 as uuidv4 } from 'uuid';

export interface ScheduledJobProps {
  name: string;
  cronExpression: string;
  status: JobStatus;
  lastRunAt?: Date;
  nextRunAt?: Date;
  createdAt: Date;
}

export class ScheduledJob extends Entity<ScheduledJobProps> {
  private constructor(id: string, props: ScheduledJobProps) {
    super(id, props);
  }

  get name(): string { return this.props.name; }
  get cronExpression(): string { return this.props.cronExpression; }
  get status(): JobStatus { return this.props.status; }
  get lastRunAt(): Date | undefined { return this.props.lastRunAt; }
  get nextRunAt(): Date | undefined { return this.props.nextRunAt; }
  get createdAt(): Date { return this.props.createdAt; }

  public recordExecutionSuccess(): void {
    this.props.status = 'COMPLETED';
    this.props.lastRunAt = new Date();
  }

  public recordExecutionFailure(): void {
    this.props.status = 'FAILED';
    this.props.lastRunAt = new Date();
  }

  public static create(name: string, cronExpression: string, id?: string): ScheduledJob {
    return new ScheduledJob(id || uuidv4(), {
      name,
      cronExpression,
      status: 'SCHEDULED',
      createdAt: new Date()
    });
  }

  public static reconstitute(id: string, props: ScheduledJobProps): ScheduledJob {
    return new ScheduledJob(id, props);
  }
}
