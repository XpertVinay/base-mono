import { ToolInvocationLog } from '../entities/tool-invocation.entity.js';

export interface ToolInvocationFilter {
  tenantId: string;
  providerSlug?: string;
  toolName?: string;
  status?: 'SUCCESS' | 'ERROR';
  limit?: number;
}

export interface IToolInvocationRepository {
  save(log: ToolInvocationLog): Promise<void>;
  list(filter: ToolInvocationFilter): Promise<ToolInvocationLog[]>;
}

