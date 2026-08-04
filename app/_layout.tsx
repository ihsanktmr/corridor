import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { color } from '../theme/tokens';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: color.void },
          // Horizontal push, native stack defaults — 250ms ease-out.
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="transfer/status" options={{ gestureEnabled: false }} />
        <Stack.Screen name="transfer/receipt" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
