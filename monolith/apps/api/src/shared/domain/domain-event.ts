export interface IDomainEvent {
  id: string;
  eventName: string;
  aggregateId: string;
  occurredAt: Date;
  payload: unknown;
  version: number;
}
