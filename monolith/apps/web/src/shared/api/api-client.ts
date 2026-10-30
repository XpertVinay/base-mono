import { ApiResponse } from '@monolith/contracts';

class ApiClient {
  private baseUrl = '';

  private getAuthToken(): string | null {
    try {
      return localStorage.getItem('auth_token');
    } catch {
      return null;
    }
  }

  private getTenantId(): string | null {
    try {
      return localStorage.getItem('app_tenant_id') || localStorage.getItem('active_tenant_slug');
    } catch {
      return null;
    }
  }

  private getDeviceFingerprint(): string {
    try {
      let fgp = localStorage.getItem('app_device_fingerprint');
      if (!fgp) {
        const screenRes = typeof window !== 'undefined' && window.screen ? `${window.screen.width}x${window.screen.height}` : 'generic';
        fgp = `web-${screenRes}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem('app_device_fingerprint', fgp);
      }
      return fgp;
    } catch {
      return 'web-client-ephemeral';
    }
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const token = this.getAuthToken();
    const tenantId = this.getTenantId();
    const deviceFingerprint = this.getDeviceFingerprint();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-Id': `web-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      'X-Device-Fingerprint': deviceFingerprint,
      ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
      ...(options.headers as Record<string, string> || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        credentials: 'same-origin', // Supports httpOnly cookie session authentication alongside Bearer token
        ...options,
        headers
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
        }

        return {
          success: false,
          error: data.error || {
            code: `HTTP_${response.status}`,
            message: data.message || `Request failed with status ${response.status}`,
            details: data.error?.details
          }
        };
      }

      return data;
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: err instanceof Error ? err.message : 'Network request failed'
        }
      };
    }
  }

  get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    });
  }

  delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
