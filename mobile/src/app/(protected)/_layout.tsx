import React from 'react';
import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../core/auth/authStore';

export default function ProtectedLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Redirect href="/(public)/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="language" />
      <Stack.Screen name="tenant-preview" />
    </Stack>
  );
}
