import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/state/auth-context';

export default function AppLayout() {
  const { session } = useAuth();

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* A plain full-screen push, not a modal -- the Android camera preview surface renders
          black inside an animated/transformed modal container. */}
      <Stack.Screen name="camera" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
