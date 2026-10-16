export interface ServiceHealthDto {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  version: string;
  uptimeSeconds: number;
  timestamp: string;
  checks: Record<string, {
    status: 'UP' | 'DOWN';
    message?: string;
    responseTimeMs?: number;
  }>;
}

export interface ApiRouteInfoDto {
  module: string;
  prefix: string;
  status: 'ACTIVE' | 'DEPRECATED' | 'DISABLED';
}
