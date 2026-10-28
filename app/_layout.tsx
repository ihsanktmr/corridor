import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_600SemiBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from '@expo-google-fonts/ibm-plex-mono';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { color } from '../theme/tokens';

/**
 * Hold the splash until the brand faces are ready.
 *
 * Rendering a frame in the system font and swapping it a beat later is worse than
 * waiting. The whole first impression of a design-led app is its typography, and
 * a visible reflow is the one thing guaranteed to be noticed.
 */
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  useEffect(() => {
    // Hide on error too: a missing face should degrade to system type, never to
    // an app that never appears.
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <PhoneColumn>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: color.void },
            // Horizontal push, native stack defaults: 250ms ease-out.
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" options={{ animation: 'fade' }} />
          <Stack.Screen name="transfer/status" options={{ gestureEnabled: false }} />
          <Stack.Screen name="transfer/receipt" options={{ animation: 'slide_from_bottom' }} />
        </Stack>
      </PhoneColumn>
    </SafeAreaProvider>
  );
}

/** The 393-wide frame every screen was designed at, plus a little room. */
const COLUMN = 430;

/**
 * On a desktop browser, hold the app to a phone-width column.
 *
 * Every screen was designed at 393×852 with one primary CTA docked full-width at
 * the bottom; stretched across a laptop, that dock becomes a 1,200px bar and the
 * layout stops reading as an app. Native and phone-width browsers are untouched.
 */
function PhoneColumn({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web' || width <= COLUMN) return <>{children}</>;

  return (
    <View style={{ flex: 1, backgroundColor: color.void, alignItems: 'center' }}>
      <View
        style={{
          flex: 1,
          width: COLUMN,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: color.line,
        }}
      >
        {children}
      </View>
    </View>
  );
}
