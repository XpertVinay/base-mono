import {
  EntityRecord,
  OrganizationRecord,
  ConfigRecord,
  RoleRecord,
  NotificationRecord,
} from '../../core/api/mockBackend';
import { EntityRecordFormData } from '../../features/records/recordSchema';

export const mockRecordItem: EntityRecord = {
  id: 'rec_test_101',
  tenantId: 'ten_apex_health_01',
  title: 'Diagnostic Workup #DW-101',
  category: 'Critical Care',
  amount: 3450.0,
  priority: 'high',
  status: 'active',
  notes: 'Patient stabilized. Baseline panels pending review.',
  createdAt: '2026-03-01T10:00:00.000Z',
};

export const mockNewRecordFormData: EntityRecordFormData = {
  title: 'Emergency Pediatric Triage #PD-505',
  category: 'Urgent Care',
  amount: 1850.5,
  priority: 'critical',
  status: 'active',
  notes: 'Direct admission to pediatric ICU triage bay.',
};

export const mockUpdatedRecordFormData: EntityRecordFormData = {
  title: 'Emergency Pediatric Triage #PD-505 (Resolved)',
  category: 'Urgent Care',
  amount: 2100.0,
  priority: 'low',
  status: 'completed',
  notes: 'Patient discharged in stable condition.',
};

export const mockOrganizationItem: OrganizationRecord = {
  id: 'org_apex_01',
  name: 'Apex Health Systems',
  slug: 'apex-health',
  domain: 'apexhealth.org',
  industry: 'healthcare',
  tier: 'ENTERPRISE',
  status: 'ACTIVE',
  branding: { primaryColor: '#0d9488', secondaryColor: '#06b6d4' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const mockConfigItem: ConfigRecord = {
  key: 'TEST_FEATURE_FLAG_MFA',
  value: 'true',
  description: 'Test flag for multi-factor authentication',
  target: 'ALL',
  updatedAt: '2026-02-01T00:00:00.000Z',
};

export const mockRoleItem: RoleRecord = {
  id: 'role_test_support',
  name: 'SUPPORT',
  description: 'Test support technician role',
  isSystem: true,
  permissions: ['records:read', 'users:read', 'audit:read'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const mockNotificationItem: NotificationRecord = {
  id: 'notif_test_01',
  recipient: 'operator@apexhealth.demo',
  channel: 'EMAIL',
  subject: 'Test Notification Alert',
  body: 'Security notification for test environment verification.',
  status: 'DELIVERED',
  isDryRun: true,
  createdAt: '2026-03-01T10:00:00.000Z',
};
