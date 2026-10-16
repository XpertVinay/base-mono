import { useQuery } from '@tanstack/react-query';
import { ProfileService } from '../services/profileService';
import { useAuth } from '../../auth/hooks/useAuth';
import { useTenant } from '../../../core/tenant/TenantContext';

export function useProfile() {
  const { user: authUser } = useAuth();
  const { tenantSlug } = useTenant();

  const query = useQuery({
    queryKey: ['userProfile', tenantSlug, authUser?.id],
    queryFn: () => ProfileService.fetchProfile(),
    initialData: authUser || undefined,
    enabled: !!authUser,
  });

  return {
    profile: query.data || authUser,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
