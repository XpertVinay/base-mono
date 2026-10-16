import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AppScreen } from '../components/layout/AppScreen';
import { AppEmptyState } from '../components/feedback/AppEmptyState';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <AppScreen>
      <View style={styles.center}>
        <AppEmptyState
          icon="alert-circle-outline"
          title="Page Not Found"
          description="The screen or feature you are trying to access does not exist or is disabled for this tenant."
          actionTitle="Go to Home"
          onAction={() => router.replace('/')}
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
