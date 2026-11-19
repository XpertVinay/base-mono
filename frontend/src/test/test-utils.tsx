import React, { ReactElement } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TenantProvider } from '../core/tenant/TenantContext';
import { useAuthStore } from '../core/auth/authStore';
import { useApiTrafficStore } from '../core/api/trafficStore';
import { User } from '../core/auth/types';

export interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Single route path to mount (e.g. '/dashboard'). Defaults to '/'. */
  initialRoute?: string;
  /** Array of route history entries for MemoryRouter (e.g. ['/iam/tenants']). Takes precedence over initialRoute. */
  initialEntries?: string[];
  /** Tenant slug alias for backward/contract compatibility (e.g. 'apex-health', 'nexus-logistics'). */
  initialSlug?: string;
  /** Canonical tenant slug for TenantProvider (e.g. 'apex-health'). Defaults to initialSlug or 'apex-health'. */
  initialTenantSlug?: string;
  /** Explicit user to initialize in authStore. If undefined, pre-existing authStore state (e.g. from beforeEach) is preserved. */
  currentUser?: User | null;
  /** API traffic connection mode: 'mock' for hermetic tests or 'live'. Defaults to 'mock'. */
  connectionMode?: 'mock' | 'live';
  /** Optional custom QueryClient instance for tests requiring isolated cache state. */
  queryClient?: QueryClient;
}

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function resetAuthStore(user: User | null = null, mode: 'live' | 'demo' = 'live'): void {
  if (user) {
    useAuthStore.setState({
      user,
      isAuthenticated: true,
      token: `mock_jwt_token_${user.id}`,
      sessionId: `sso_session_${user.id}`,
      connectionMode: mode,
      isLoading: false,
    });
  } else {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      token: null,
      sessionId: null,
      expiresAt: null,
      connectionMode: 'live',
      isLoading: false,
    });
  }
}

export function resetTrafficStore(mode: 'auto' | 'live' | 'mock' = 'mock'): void {
  useApiTrafficStore.setState({
    connectionMode: mode,
    records: [],
    activeRecordId: null,
    isDrawerOpen: false,
    filter: {
      search: '',
      method: 'all',
      statusCategory: 'all',
    },
  });
}

export interface RenderWithProvidersResult extends RenderResult {
  queryClient: QueryClient;
}

export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
): RenderWithProvidersResult {
  const {
    initialRoute = '/',
    initialEntries,
    initialSlug,
    initialTenantSlug,
    currentUser,
    connectionMode = 'mock',
    queryClient: customQueryClient,
    ...renderOptions
  } = options;

  // Resolve routing entries: prefer explicit initialEntries array, fallback to [initialRoute]
  const resolvedEntries =
    initialEntries && initialEntries.length > 0
      ? initialEntries
      : [initialRoute];

  // Resolve tenant slug: support both initialTenantSlug and initialSlug with fallback to default
  const resolvedSlug = initialTenantSlug || initialSlug || 'apex-health';

  // 1. Auth Store Management:
  // If currentUser is explicitly provided (including null), reset authStore accordingly.
  // If currentUser is omitted (undefined), preserve pre-existing store state (e.g. from beforeEach)
  // while ensuring connectionMode is aligned.
  if (currentUser !== undefined) {
    resetAuthStore(currentUser, connectionMode === 'mock' ? 'demo' : 'live');
  } else {
    useAuthStore.setState({
      connectionMode: connectionMode === 'mock' ? 'demo' : 'live',
    });
  }

  // 2. Set API Connection Mode to mock by default for hermetic fast test execution
  resetTrafficStore('mock');

  // 3. Isolated Query Client
  const testQueryClient = customQueryClient || createTestQueryClient();

  const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
      <QueryClientProvider client={testQueryClient}>
        <TenantProvider initialSlug={resolvedSlug}>
          <MemoryRouter initialEntries={resolvedEntries}>
            {children}
          </MemoryRouter>
        </TenantProvider>
      </QueryClientProvider>
    );
  };

  const rendered = render(ui, { wrapper: AllTheProviders, ...renderOptions });

  return {
    ...rendered,
    queryClient: testQueryClient,
  };
}

// Re-export all React Testing Library helpers
export * from '@testing-library/react';
