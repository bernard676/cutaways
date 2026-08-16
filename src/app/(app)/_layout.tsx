import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/state/auth-context';

export default function AppLayout() {
  const { session } = useAuth();

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
