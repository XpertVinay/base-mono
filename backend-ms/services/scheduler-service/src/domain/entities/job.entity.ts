import { Entity } from '../../shared/domain/entity.js';

export type JobStatus = 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface JobProps {
  name: string;
  cronExpression: string;
  status: JobStatus;
  lastRunAt?: Date;
  nextRunAt?: Date;
  createdAt?: Date;
}

export class Job extends Entity<JobProps> {
  private constructor(props: JobProps, id?: string) {
    super(props, id);
  }

  public static create(
    props: Omit<JobProps, 'status' | 'createdAt'>,
    id?: string
  ): Job {
    return new Job(
      {
        ...props,
        status: 'SCHEDULED',
        createdAt: new Date()
      },
      id
    );
  }

  get name(): string { return this.props.name; }
  get cronExpression(): string { return this.props.cronExpression; }
  get status(): JobStatus { return this.props.status; }
  get lastRunAt(): Date | undefined { return this.props.lastRunAt; }
  get nextRunAt(): Date | undefined { return this.props.nextRunAt; }
  get createdAt(): Date { return this.props.createdAt!; }

  public markRunning(): void {
    this.props.status = 'RUNNING';
    this.props.lastRunAt = new Date();
  }

  public markCompleted(): void {
    this.props.status = 'COMPLETED';
  }

  public markFailed(): void {
    this.props.status = 'FAILED';
  }

  public update(props: {
    name?: string;
    cronExpression?: string;
    status?: JobStatus;
  }): void {
    if (props.name !== undefined) this.props.name = props.name;
    if (props.cronExpression !== undefined) this.props.cronExpression = props.cronExpression;
    if (props.status !== undefined) this.props.status = props.status;
  }
}
