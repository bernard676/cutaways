import { Redirect, Stack } from 'expo-router';
import { useReducedMotion } from 'react-native-reanimated';

import { useAuth } from '@/state/auth-context';

export default function AppLayout() {
  const { session } = useAuth();
  const reduced = useReducedMotion();

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animationMatchesGesture: true }}>
      {/* A plain full-screen push, not a modal -- the Android camera preview surface renders
          black inside an animated/transformed modal container. Reduced motion swaps the
          upward slide for a plain cross-fade. */}
      <Stack.Screen
        name="camera"
        options={{ animation: reduced ? 'fade' : 'slide_from_bottom' }}
      />
    </Stack>
  );
}
