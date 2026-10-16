import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppScreen } from '../../components/layout/AppScreen';
import { AppHeader, AppButton, AppCard, AppText, AppIcon } from '../../components/ui';
import { useTheme } from '../../core/theme';
import { useAuth } from '../../features/auth';
import { ProfileCard } from '../../features/profile';

export default function ProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation(['common']);
  const { theme } = useTheme();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to sign out of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(public)/welcome');
          },
        },
      ]
    );
  };

  return (
    <AppScreen scrollable edges={['top', 'left', 'right']} contentContainerStyle={styles.container}>
      <AppHeader title="User Profile" showBack onBack={() => router.back()} />

      <View style={styles.body}>
        {user && <ProfileCard user={user} />}

        <AppCard variant="outlined" style={styles.securityCard}>
          <AppText variant="h3" style={{ marginBottom: 12 }}>
            Account Security & Storage
          </AppText>
          <View style={styles.infoRow}>
            <AppIcon name="lock-closed-outline" size="sm" color={theme.colors.primary} />
            <View style={styles.infoTextContainer}>
              <AppText variant="body" weight="semibold">
                Expo SecureStore
              </AppText>
              <AppText variant="caption" color={theme.colors.textMuted}>
                Credentials and access tokens stored securely on device
              </AppText>
            </View>
          </View>
        </AppCard>

        <AppButton
          title={t('common:logout')}
          onPress={handleLogout}
          variant="danger"
          size="md"
          leftIcon={<AppIcon name="log-out-outline" size="sm" color="#FFFFFF" />}
          style={styles.logoutBtn}
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 0,
  },
  body: {
    padding: 16,
    gap: 16,
  },
  securityCard: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoTextContainer: {
    marginLeft: 12,
  },
  logoutBtn: {
    marginTop: 8,
  },
});
