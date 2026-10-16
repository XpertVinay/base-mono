import React from 'react';
import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../core/auth/authStore';

export default function PublicLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Redirect href="/(protected)/home" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
    </Stack>
  );
}
