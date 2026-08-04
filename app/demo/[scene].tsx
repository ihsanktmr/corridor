import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { Screen } from '../../components/chrome';
import { seedDemo, type DemoScene } from '../../services/corridor';
import { color, space } from '../../theme/tokens';
import { type } from '../../theme/type';

/**
 * Demo deep links.
 *
 *   corridor://demo/review     corridor://demo/expired
 *   corridor://demo/inflight   corridor://demo/returned
 *   corridor://demo/receipt    corridor://demo/kyc-resubmit
 *
 * The interesting screens sit three or four steps into a flow that takes real time
 * to walk. This route builds the state a reviewer would have arrived with and jumps
 * straight there — using the same event log the real timeline produces, so nothing
 * here is a special case the screens know about.
 */
export default function Demo() {
  const { scene } = useLocalSearchParams<{ scene?: string }>();

  useEffect(() => {
    const target = seedDemo(scene as DemoScene);
    if (!target) {
      router.replace('/home');
      return;
    }
    // Let the seeded state land before the destination screen reads it.
    const timer = setTimeout(() => {
      router.replace(
        target.id
          ? { pathname: target.pathname as '/transfer/status', params: { id: target.id } }
          : (target.pathname as '/transfer/review'),
      );
    }, 60);
    return () => clearTimeout(timer);
  }, [scene]);

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm }}>
        <Text style={type.micro}>demo scene</Text>
        <Text style={[type.title, { color: color.gold }]}>{scene}</Text>
      </View>
    </Screen>
  );
}
