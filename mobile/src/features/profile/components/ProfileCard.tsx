import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AuthUser } from '../../../core/auth/types';
import { useTheme } from '../../../core/theme';
import { useTenant } from '../../../core/tenant/TenantContext';
import { AppCard, AppAvatar, AppText, AppIcon } from '../../../components/ui';

export interface ProfileCardProps {
  user: AuthUser;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({ user }) => {
  const { theme } = useTheme();
  const { tenant } = useTenant();

  return (
    <AppCard variant="elevated" style={styles.card}>
      <View style={styles.headerRow}>
        <AppAvatar name={user.fullName} imageUrl={user.avatarUrl} size="lg" />
        <View style={styles.userInfo}>
          <AppText variant="h3">{user.fullName}</AppText>
          <AppText variant="caption" color={theme.colors.textSecondary}>
            {user.email}
          </AppText>
          <View style={styles.roleTag}>
            <View style={[styles.roleDot, { backgroundColor: theme.colors.primary }]} />
            <AppText variant="caption" style={{ textTransform: 'uppercase', fontWeight: '600' }}>
              {user.role}
            </AppText>
          </View>
        </View>
      </View>

      <View style={[styles.tenantSection, { backgroundColor: theme.colors.surfaceSubtle }]}>
        <AppIcon name="business-outline" size="sm" color={theme.colors.primary} />
        <View style={styles.tenantTextContainer}>
          <AppText variant="caption" color={theme.colors.textMuted}>
            Active Organization
          </AppText>
          <AppText variant="body" weight="semibold">
            {tenant.displayName} ({tenant.industry})
          </AppText>
        </View>
      </View>
    </AppCard>
  );
};

const styles = StyleSheet.create({
  card: {
    marginVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfo: {
    marginLeft: 16,
    flex: 1,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  roleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  tenantSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
  },
  tenantTextContainer: {
    marginLeft: 10,
  },
});
