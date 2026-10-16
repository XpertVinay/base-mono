import React from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../core/auth/authStore';

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Redirect href="/(protected)/home" />;
  }

  return <Redirect href="/(public)/welcome" />;
}
