import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Dock } from '../components/Button';
import { Body, Screen } from '../components/chrome';
import { Mark } from '../components/Mark';
import { CorridorStrip } from '../components/primitives';
import { Field } from '../components/inputs';
import { currentRate, login } from '../services/corridor';
import { formatRate } from '../domain/rate';
import { demoStripLabel } from '../providers/registry';
import { color, space } from '../theme/tokens';
import { tabular, type } from '../theme/type';

/**
 * 01 · Welcome & auth
 *
 * Get someone to a funded, non-custodial wallet without them ever learning they now
 * have one. Email or passkey, nothing else — no seed phrase, no extension, no
 * "connect wallet".
 *
 * The word "wallet" appears once, in the footnote, as reassurance rather than as a
 * concept the user has to learn before signing up.
 */
export default function Welcome() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const onContinue = async () => {
    setBusy(true);
    await login(email.trim());
    setBusy(false);
    router.replace('/home');
  };

  return (
    <Screen>
      <Body scroll={false}>
        <View style={{ flex: 1, paddingTop: space.xxl }}>
          <Mark size={44} />

          <Text style={[type.displayL, { fontSize: 38, marginTop: space.lg, marginBottom: space.base }]}>
            corridor
          </Text>

          {/* The positioning line is the hero — a remittance sender's real fear is
              that value shrinks in transit, answered in one sentence, no jargon. */}
          <Text
            style={{
              fontSize: 19,
              lineHeight: 26,
              fontStyle: 'italic',
              color: color.paper,
              maxWidth: 260,
            }}
          >
            Your dollars, still dollars, on the other side.
          </Text>

          <View style={{ flex: 1 }} />

          {/* The live rate sits on the first screen. Rate is the number this
              audience shops on; making them sign up to see it is a conversion tax. */}
          <CorridorStrip
            right={
              <Text style={[type.label, tabular, { fontSize: 11 }]}>
                1 USD = {formatRate(currentRate())} ₺
              </Text>
            }
          />

          <View style={{ marginTop: space.lg }}>
            <Field
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              keyboardType="email-address"
            />
            <Button
              label="Continue"
              onPress={onContinue}
              disabled={!valid}
              loading={busy}
            />
            <Button label="Use a passkey instead" variant="ghost" onPress={onContinue} />
          </View>
        </View>
      </Body>

      <Dock>
        <Text style={[type.label, { fontSize: 10.5, textAlign: 'center', lineHeight: 17 }]}>
          Wallet secured by Privy · no seed phrase, ever{'\n'}
          <Text style={{ color: '#7d776c' }}>{demoStripLabel()}</Text>
        </Text>
      </Dock>
    </Screen>
  );
}
