import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
} from '@expo-google-fonts/playfair-display';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { ToastHost } from '@/components/toast';
import { useColorScheme } from '@/hooks/use-theme';
import { AuthProvider, useAuth } from '@/state/auth-context';
import { ToastProvider } from '@/hooks/use-toast';
import { loadSettings } from '@/state/settings-store';
import { loadThemePreference } from '@/state/theme-store';

SplashScreen.preventAutoHideAsync();
loadSettings();
loadThemePreference();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function RootNavigator({ isReady }: { isReady: boolean }) {
  const { isLoading } = useAuth();

  useEffect(() => {
    if (isReady && !isLoading) SplashScreen.hideAsync();
  }, [isReady, isLoading]);

  if (isLoading || !isReady) {
    return <ThemedView style={{ flex: 1 }} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_500Medium,
    Inter_600SemiBold,
    PlayfairDisplay_400Regular,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <QueryClientProvider client={queryClient}>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <AuthProvider>
              <ToastProvider>
                {/* ToastHost renders outside the bottom-sheet provider so toasts always
                    paint above an open sheet (e.g. an explore-generation error triggered
                    from within the component detail sheet) instead of behind its portal. */}
                <BottomSheetModalProvider>
                  <RootNavigator isReady={fontsLoaded} />
                </BottomSheetModalProvider>
                <ToastHost />
              </ToastProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
