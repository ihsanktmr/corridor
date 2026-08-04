import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, Dock } from '../../components/Button';
import { Bloom, Body, Nav, Screen } from '../../components/chrome';
import { Card, Disclose, ListRow, Pill } from '../../components/primitives';
import { providers } from '../../providers/registry';
import { startKyc } from '../../services/corridor';
import { useCorridor } from '../../state/useCorridor';
import { color, space } from '../../theme/tokens';
import { type } from '../../theme/type';

/**
 * 05 · KYC gate  ·  and 11b · resubmit
 *
 * Explain before demanding. A verification wall with no stated reason reads as a
 * scam to exactly the users who most need this product.
 *
 * Placed after the quote and before funding, so the user is verifying *for*
 * something concrete they have already seen.
 */
export default function KycGate() {
  const { kyc } = useCorridor();

  if (kyc === 'resubmit') return <Resubmit />;

  const onStart = async () => {
    await startKyc();
    router.push('/kyc/capture');
  };

  return (
    <Screen>
      <Nav title="Verify identity" step="3 / 4" />

      <Body>
        <View style={{ paddingTop: space.base, paddingBottom: space.lg }}>
          <View style={{ marginBottom: space.lg }}>
            <Bloom tone="warning" glyph="⌾" />
          </View>

          <Text style={[type.display, { marginBottom: space.sm }]}>
            One check before{'\n'}your first payout.
          </Text>

          {/* Names the actual reason. Diaspora senders have usually been asked for
              documents by someone who shouldn't have asked; specificity is what
              separates us from that. */}
          <Text style={[type.body, { maxWidth: 300 }]}>
            US money-transmission rules require us to verify who you are before dollars can leave for a
            foreign bank account. Once. Not every transfer.
          </Text>
        </View>

        <Card style={{ marginBottom: space.base }}>
          <Text style={[type.micro, { marginBottom: space.base }]}>
            what you'll need · about 2 minutes
          </Text>
          <ListRow lead="1" title="Government ID" subtitle="Driver's licence or passport" />
          <ListRow lead="2" title="A selfie" subtitle="Matched against the ID photo" />
          <ListRow lead="3" title="Home address" subtitle="Pre-filled from your ID" last />
        </Card>

        {/* Says what we don't keep, unprompted, before the camera opens. */}
        <Card tight style={{ marginBottom: space.md }}>
          <Text style={[type.label, { fontSize: 11.5, lineHeight: 18 }]}>
            <Text style={{ color: color.paper, fontWeight: '500' }}>
              Corridor never stores your documents.{' '}
            </Text>
            Images go straight to our verification provider. We keep the result and a reference — never
            the file.
          </Text>
        </Card>

        <Disclose text={providers.kyc.meta.disclosure ?? ''} />
      </Body>

      <Dock>
        <Button label="Start verification" onPress={onStart} />
        {/* A real exit — the quote survives, the transfer parks. */}
        <Button label="Not now" variant="ghost" onPress={() => router.back()} />
      </Dock>
    </Screen>
  );
}

/**
 * 11b · KYC resubmit
 *
 * Rejection is scoped, not total — one item failed, two passed, and the ledger is
 * shown so the user doesn't fear starting over. The reason is specific and
 * actionable ("too dark to read", not "could not be verified").
 */
function Resubmit() {
  return (
    <Screen>
      <Nav title="Verify identity" />

      <Body>
        <View style={{ alignItems: 'center', paddingTop: space.base, paddingBottom: space.lg }}>
          <Bloom tone="warning" glyph="!" />
          <Text style={[type.title, { marginTop: space.base, textAlign: 'center' }]}>
            We need one photo again
          </Text>
          <Text style={[type.body, { textAlign: 'center', marginTop: space.sm, maxWidth: 280 }]}>
            Your ID front was too dark to read. Everything else is approved.
          </Text>
        </View>

        <Card tight style={{ marginBottom: space.md }}>
          <ListRow
            lead="!"
            title="ID — front"
            subtitle="Low light · retake needed"
            meta={<Pill tone="fail" label="retake" />}
          />
          <ListRow lead="✓" title="ID — back" subtitle="Accepted" meta={<Pill tone="done" label="ok" />} />
          <ListRow lead="✓" title="Selfie" subtitle="Matched" meta={<Pill tone="done" label="ok" />} last />
        </Card>

        <Card tight>
          <Text style={[type.label, { fontSize: 11.5, lineHeight: 18 }]}>
            <Text style={{ color: color.paper, fontWeight: '500' }}>Your transfer is saved. </Text>
            Your rate is re-quoted when you're verified — no money has moved.
          </Text>
        </Card>
      </Body>

      <Dock>
        <Button label="Retake ID photo" onPress={() => router.push('/kyc/capture')} />
        <Button label="Do this later" variant="ghost" onPress={() => router.replace('/home')} />
      </Dock>
    </Screen>
  );
}
