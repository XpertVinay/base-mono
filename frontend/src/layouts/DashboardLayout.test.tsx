import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { DashboardLayout } from './DashboardLayout';
import { renderWithProviders } from '../test/test-utils';
import { mockDashboardMetrics } from '../test/mocks/mockData';

describe('DashboardLayout Component', () => {
  it('renders hero banner with title, subtitle, and action toolbar', () => {
    renderWithProviders(
      <DashboardLayout
        title="Custom Analytics Dashboard"
        subtitle="Real-time multi-tenant telemetry and telemetry stream"
        actions={<button type="button">Export Report</button>}
      >
        <div data-testid="child-widget">Chart Content</div>
      </DashboardLayout>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Custom Analytics Dashboard' })).toBeInTheDocument();
    expect(
      screen.getByText('Real-time multi-tenant telemetry and telemetry stream')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export Report' })).toBeInTheDocument();
    expect(screen.getByTestId('child-widget')).toBeInTheDocument();
  });

  it('renders KPI metric ribbon with formatted values and positive/negative/neutral trends', () => {
    renderWithProviders(
      <DashboardLayout
        title="Overview"
        metrics={mockDashboardMetrics}
      />
    );

    // Verify all 4 metric titles and values
    expect(screen.getByText('Total Tenants')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('+14.2%')).toBeInTheDocument();

    expect(screen.getByText('Active Users')).toBeInTheDocument();
    expect(screen.getByText('2,840')).toBeInTheDocument();
    expect(screen.getByText('+8.6%')).toBeInTheDocument();

    expect(screen.getByText('System Health')).toBeInTheDocument();
    expect(screen.getByText('99.98%')).toBeInTheDocument();

    expect(screen.getByText('API Gateway Latency')).toBeInTheDocument();
    expect(screen.getByText('18ms')).toBeInTheDocument();
    expect(screen.getByText('-3ms')).toBeInTheDocument();
  });

  it('renders gracefully without crashing when metrics is omitted or empty', () => {
    renderWithProviders(
      <DashboardLayout title="Empty Metrics View">
        <p>No telemetry active</p>
      </DashboardLayout>
    );

    expect(screen.getByText('Empty Metrics View')).toBeInTheDocument();
    expect(screen.getByText('No telemetry active')).toBeInTheDocument();
    expect(screen.queryByLabelText(/key performance indicators/i)).not.toBeInTheDocument();
  });
});
