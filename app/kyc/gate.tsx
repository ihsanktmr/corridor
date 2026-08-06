import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, Dock } from '../../components/Button';
import { Bloom, Body, Nav, Screen } from '../../components/chrome';
import { Card, Disclose, ListRow, Pill } from '../../components/primitives';
import { Alert, Check, Verified } from '../../components/icons';
import { providers } from '../../providers/registry';
import { startKyc } from '../../services/corridor';
import { useCorridor } from '../../state/useCorridor';
import { color, space } from '../../theme/tokens';
import { face, type } from '../../theme/type';

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
            <Bloom tone="warning"><Verified /></Bloom>
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
            <Text style={{ color: color.paper, fontFamily: face.medium }}>
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

      {/* Short screen — centre it, so it reads as a deliberate stop rather than a
          page that ran out of content. Matches 11a. */}
      <Body scroll={false}>
        <View style={{ flex: 1, justifyContent: 'center', paddingBottom: space.xl }}>
        <View style={{ alignItems: 'center', paddingTop: space.base, paddingBottom: space.lg }}>
          <Bloom tone="warning"><Alert size={30} /></Bloom>
          <Text style={[type.title, { marginTop: space.base, textAlign: 'center' }]}>
            We need one photo again
          </Text>
          <Text style={[type.body, { textAlign: 'center', marginTop: space.sm, maxWidth: 280 }]}>
            Your ID front was too dark to read. Everything else is approved.
          </Text>
        </View>

        <Card tight style={{ marginBottom: space.md }}>
          {/* Lead colour carries the verdict: gold is the brand accent and would
              have read as "fine" on the one row that isn't. */}
          <ListRow
            leadNode={<Alert size={15} color={color.warning} />}
            leadTone="warning"
            title="ID — front"
            subtitle="Low light · retake needed"
            meta={<Pill tone="fail" label="retake" />}
          />
          <ListRow
            leadNode={<Check size={13} color={color.success} />}
            leadTone="success"
            title="ID — back"
            subtitle="Accepted"
            meta={<Pill tone="done" label="ok" />}
          />
          <ListRow
            leadNode={<Check size={13} color={color.success} />}
            leadTone="success"
            title="Selfie"
            subtitle="Matched"
            meta={<Pill tone="done" label="ok" />}
            last
          />
        </Card>

        <Card tight>
          <Text style={[type.label, { fontSize: 11.5, lineHeight: 18 }]}>
            <Text style={{ color: color.paper, fontFamily: face.medium }}>Your transfer is saved. </Text>
            Your rate is re-quoted when you're verified — no money has moved.
          </Text>
        </Card>
        </View>
      </Body>

      <Dock>
        <Button label="Retake ID photo" onPress={() => router.push('/kyc/capture')} />
        <Button label="Do this later" variant="ghost" onPress={() => router.replace('/home')} />
      </Dock>
    </Screen>
  );
}
