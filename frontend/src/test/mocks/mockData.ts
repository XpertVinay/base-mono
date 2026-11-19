import { KpiMetric } from '../../layouts/DashboardLayout';

export const mockDashboardMetrics: KpiMetric[] = [
  {
    id: 'm-tenants',
    title: 'Total Tenants',
    value: '42',
    change: '+14.2%',
    changeType: 'positive',
    icon: 'Building2',
  },
  {
    id: 'm-users',
    title: 'Active Users',
    value: '2,840',
    change: '+8.6%',
    changeType: 'positive',
    icon: 'Users',
  },
  {
    id: 'm-health',
    title: 'System Health',
    value: '99.98%',
    change: '0.0%',
    changeType: 'neutral',
    icon: 'Activity',
  },
  {
    id: 'm-latency',
    title: 'API Gateway Latency',
    value: '18ms',
    change: '-3ms',
    changeType: 'positive',
    icon: 'ServerCog',
  },
];

export const mockSampleRoles = [
  'SUPER_ADMIN',
  'TENANT_ADMIN',
  'SUPPORT',
  'CUSTOMER',
] as const;
