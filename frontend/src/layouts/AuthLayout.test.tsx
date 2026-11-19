import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { AuthLayout } from './AuthLayout';
import { renderWithProviders } from '../test/test-utils';

describe('AuthLayout Component', () => {
  it('renders healthcare showcase branding and compliance telemetry for apex-health tenant', () => {
    renderWithProviders(<AuthLayout />, { initialSlug: 'apex-health' });

    expect(screen.getByText('HEALTHCARE CLOUD V3.4')).toBeInTheDocument();
    expect(screen.getByText('99.99% HIPAA SLA')).toBeInTheDocument();
    expect(screen.getByText('Dr. Evelyn Marcus')).toBeInTheDocument();
    expect(screen.getByText('HIPAA Certified')).toBeInTheDocument();
  });

  it('renders logistics fleet telematics showcase for nexus-logistics tenant', () => {
    renderWithProviders(<AuthLayout />, { initialSlug: 'nexus-logistics' });

    expect(screen.getByText('LOGISTICS FLEET CORE V3.4')).toBeInTheDocument();
    expect(screen.getByText('99.95% Dispatch SLA')).toBeInTheDocument();
    expect(screen.getByText('Marcus Sterling')).toBeInTheDocument();
  });

  it('renders institutional clearing showcase for aura-fintech tenant', () => {
    renderWithProviders(<AuthLayout />, { initialSlug: 'aura-fintech' });

    expect(screen.getByText('INSTITUTIONAL CLEARING V3.4')).toBeInTheDocument();
    expect(screen.getByText('99.999% SLA')).toBeInTheDocument();
  });

  it('renders form container area and security footer', () => {
    renderWithProviders(<AuthLayout />, { initialSlug: 'apex-health' });

    expect(screen.getByText(/enterprise portal security/i)).toBeInTheDocument();
  });
});
