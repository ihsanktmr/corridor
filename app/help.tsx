import { router } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';

import { Button, Dock } from '../components/Button';
import { Body, Nav, Screen, goBack } from '../components/chrome';
import { ExternalLink } from '../components/icons';
import { Card, Chip, ListRow, Row } from '../components/primitives';
import { shortHash } from '../domain/transfer';
import { activeProviders } from '../providers/registry';
import { logout } from '../services/corridor';
import { color, space } from '../theme/tokens';
import { type } from '../theme/type';

const PROOF_TX = '0x551c67045ddfe8e8fb94fdad1ca0b5ffd078d3ca50f167531f0680722a55ba10';
const EXPLORER = `https://sepolia.basescan.org/tx/${PROOF_TX}`;
const REPO = 'https://github.com/ihsanktmr/corridor';

/**
 * Help & about.
 *
 * Every "Get help" and the account control resolve here. A support affordance that
 * goes nowhere is worse than none at all — it teaches the user that the app's
 * controls are decorative, which is precisely the wrong lesson on a screen where
 * their money is in flight.
 *
 * It doubles as the disclosure surface: the simulated-leg list is read from the
 * provider registry, so it cannot drift from what the app is actually doing.
 */
export default function Help() {
  const providers = activeProviders();

  return (
    <Screen>
      <Nav title="Help" close onBack={() => goBack('/home')} />

      <Body>
        <Text style={[type.display, { marginTop: space.sm, marginBottom: space.sm }]}>
          This is a case study.
        </Text>
        <Text style={[type.body, { marginBottom: space.lg }]}>
          Corridor is a portfolio build, not a licensed money transmitter. No real funds move, and
          nothing here can be used to send money.
        </Text>

        <Text style={[type.micro, { marginBottom: 10 }]}>what's simulated</Text>
        <Card style={{ marginBottom: space.base }}>
          {providers.map((p, i) => (
            <ListRow
              key={p.id}
              title={p.label}
              subtitle={p.disclosure ?? 'Real — no simulation on this leg.'}
              meta={
                <Text
                  style={{
                    fontSize: 10,
                    color: p.fidelity === 'real' ? color.success : color.warning,
                  }}
                >
                  {p.fidelity}
                </Text>
              }
              last={i === providers.length - 1}
            />
          ))}
        </Card>

        <Text style={[type.micro, { marginBottom: 10 }]}>the one real transaction</Text>
        <Card tight style={{ marginBottom: space.base }}>
          <Chip value={shortHash(PROOF_TX)} onPress={() => void Linking.openURL(EXPLORER)} />
          <Row style={{ marginTop: 11 }}>
            <Text style={[type.label, { fontSize: 11 }]}>Base Sepolia · 1.00 USDC</Text>
            <Pressable
              onPress={() => void Linking.openURL(EXPLORER)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
            >
              <Text style={{ fontSize: 11.5, color: color.goldBright }}>BaseScan</Text>
              <ExternalLink />
            </Pressable>
          </Row>
        </Card>

        <Pressable onPress={() => void Linking.openURL(REPO)}>
          <Card tight style={{ marginBottom: space.base }}>
            <Row>
              <View style={{ flex: 1 }}>
                <Text style={type.bodyStrong}>Source, architecture &amp; failure modes</Text>
                <Text style={[type.label, { fontSize: 11, marginTop: 3 }]}>
                  github.com/ihsanktmr/corridor
                </Text>
              </View>
              <ExternalLink />
            </Row>
          </Card>
        </Pressable>
      </Body>

      <Dock>
        <Button
          label="Reset demo"
          variant="secondary"
          onPress={() => {
            void logout();
            router.replace('/');
          }}
        />
      </Dock>
    </Screen>
  );
}
