import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/state/auth-context';

export default function AuthLayout() {
  const { session } = useAuth();

  if (session) {
    return <Redirect href="/(app)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
