import { DomainIntegrationEvent } from '../../shared/infrastructure/messaging/rabbitmq.service.js';

export function createRoleCreatedEvent(role: {
  id: string;
  tenantId: string;
  name: string;
  isSystem: boolean;
  permissions: string[];
}): DomainIntegrationEvent {
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    eventName: 'rbac.role.created',
    aggregateId: role.id,
    occurredAt: new Date().toISOString(),
    version: 1,
    tenantId: role.tenantId,
    payload: role
  };
}

export function createRoleUpdatedEvent(role: {
  id: string;
  tenantId: string;
  name: string;
  permissions: string[];
}): DomainIntegrationEvent {
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    eventName: 'rbac.role.updated',
    aggregateId: role.id,
    occurredAt: new Date().toISOString(),
    version: 1,
    tenantId: role.tenantId,
    payload: role
  };
}

export function createRoleDeletedEvent(data: {
  roleId: string;
  tenantId: string;
  name: string;
}): DomainIntegrationEvent {
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    eventName: 'rbac.role.deleted',
    aggregateId: data.roleId,
    occurredAt: new Date().toISOString(),
    version: 1,
    tenantId: data.tenantId,
    payload: data
  };
}

export function createUserRoleAssignedEvent(data: {
  assignmentId: string;
  tenantId: string;
  userId: string;
  roleId: string;
  assignedBy?: string | null;
}): DomainIntegrationEvent {
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    eventName: 'rbac.user_role.assigned',
    aggregateId: data.assignmentId,
    occurredAt: new Date().toISOString(),
    version: 1,
    tenantId: data.tenantId,
    payload: data
  };
}

export function createUserRoleRevokedEvent(data: {
  tenantId: string;
  userId: string;
  roleId: string;
}): DomainIntegrationEvent {
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    eventName: 'rbac.user_role.revoked',
    aggregateId: `${data.tenantId}:${data.userId}:${data.roleId}`,
    occurredAt: new Date().toISOString(),
    version: 1,
    tenantId: data.tenantId,
    payload: data
  };
}

