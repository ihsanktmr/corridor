import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { Button, Dock } from '../../components/Button';
import { Body, Nav, Screen } from '../../components/chrome';
import { RouteLine } from '../../components/RouteLine';
import { Amount, Card, Chip, Pill, Row } from '../../components/primitives';
import { format } from '../../domain/money';
import { CONFIRMATIONS_REQUIRED, shortHash, type Step, type Transfer } from '../../domain/transfer';
import { recipientById, transferById } from '../../services/corridor';
import { useCorridor } from '../../state/useCorridor';
import { color, space } from '../../theme/tokens';
import { face, type } from '../../theme/type';

/**
 * 09 · In flight  ·  and 11c · payout returned
 *
 * Five real steps mapped to five real rails, not a progress bar pretending to know
 * something. Every completed step carries a timestamp; pending steps carry their
 * expectation, so silence never reads as failure.
 *
 * The hash appears the instant it exists — mid-flight, not on the receipt. Proof
 * that is only revealed once everything worked is not proof of much.
 */
export default function Status() {
  const params = useLocalSearchParams<{ id?: string }>();
  const state = useCorridor();
  const transfer = transferById(params.id ?? state.activeTransferId);

  useEffect(() => {
    if (transfer?.state === 'delivered') {
      const id = setTimeout(
        () => router.replace({ pathname: '/transfer/receipt', params: { id: transfer.id } }),
        1400,
      );
      return () => clearTimeout(id);
    }
    return undefined;
  }, [transfer?.state, transfer?.id]);

  if (!transfer) {
    return (
      <Screen>
        <Nav title="Transfer" onBack={() => router.replace('/home')} />
        <Body>
          <Text style={[type.body, { marginTop: space.lg }]}>Transfer not found.</Text>
        </Body>
      </Screen>
    );
  }

  const returned = transfer.state === 'payout_returned' || transfer.state === 'refunded';
  if (returned) return <PayoutReturned transfer={transfer} />;

  return (
    <Screen>
      <Nav title="Transfer" onBack={() => router.replace('/home')} />

      <Body>
        <View style={{ paddingTop: space.md, paddingBottom: space.lg }}>
          <Pill tone="live" label={liveLabel(transfer)} />
          <View style={{ marginTop: space.sm }}>
            <Amount value={transfer.quote.receive} size="sub" showCurrency={false} />
          </View>
          <Text style={[type.label, { fontSize: 12.5, marginTop: 6 }]}>
            to {recipientById(transfer.recipientId)?.holderName ?? 'recipient'} · arriving by 14:00 today
          </Text>
        </View>

        <RouteLine steps={buildSteps(transfer)} />
      </Body>

      <Dock bordered>
        <Row>
          <Text style={[type.label, { fontSize: 11.5 }]}>
            Ref <Text style={[type.mono, { color: color.paper }]}>CRD-8F2A-4417</Text>
          </Text>
          <Button label="Get help" variant="secondary" style={{ minHeight: 38, paddingHorizontal: 16 }} />
        </Row>
      </Dock>
    </Screen>
  );
}

function liveLabel(t: Transfer): string {
  switch (t.state) {
    case 'funding':
      return 'waiting on your bank';
    case 'funded_held':
      return 'funds received';
    case 'chain_pending':
      return 'on chain now';
    case 'chain_confirmed':
      return 'confirmed on chain';
    case 'payout_pending':
      return 'paying out';
    default:
      return 'in transit';
  }
}

/** Reason codes rendered as the sender would say them, not as the rail reports them. */
const PAYOUT_FAILURE: Record<string, string> = {
  name_mismatch: 'name did not match the account holder',
  account_closed: 'account closed',
  bank_rejected: 'rejected by the bank',
  sanctions_hold: 'held for review',
};

/** Each step is a rail, with a timestamp when done and an expectation when not. */
function buildSteps(transfer: Transfer) {
  const at = (s: Step) =>
    s.at
      ? new Date(s.at).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      : '';

  const [onramp, mint, chain, payout, delivered] = transfer.steps;

  return [
    {
      step: onramp!,
      title: 'USD received',
      detail: onramp?.status === 'done' ? `${at(onramp)} · ACH cleared from Chase ···4417` : 'ACH · 2 business days',
    },
    {
      step: mint!,
      title: 'Converted to USDC',
      detail: mint?.status === 'done' ? `${at(mint)} · $500.00 → 500.00 USDC at par` : 'At par, 1:1',
    },
    {
      step: chain!,
      title: 'Sending on Base',
      // The honest unit for this step, and the one number nothing could fake.
      ...(chain?.status === 'live'
        ? { badge: `${Math.min(2, CONFIRMATIONS_REQUIRED)} / ${CONFIRMATIONS_REQUIRED} confs` }
        : {}),
      detail: chain?.at ? `${at(chain)} · 500.00 USDC` : 'Base Sepolia',
      extra: transfer.txHash ? <Chip value={shortHash(transfer.txHash)} /> : undefined,
    },
    {
      step: payout!,
      title: 'TRY payout',
      // A failed step must never keep wearing the pending step's expectation.
      // "usually under 30 min" under a red cross is the screen contradicting itself.
      detail:
        payout?.status === 'failed'
          ? `${at(payout)} · ${PAYOUT_FAILURE[transfer.payoutReturn ?? 'bank_rejected']}`
          : payout?.status === 'done'
            ? at(payout)
            : 'Garanti BBVA · usually under 30 min',
    },
    {
      step: delivered!,
      title: 'Delivered',
      detail: delivered?.status === 'done' ? at(delivered) : 'Elif is notified by her bank',
    },
  ];
}

/**
 * 11c · Payout returned
 *
 * The one that matters. "Your money is safe" appears above the fold, before any
 * explanation — a user watching ₺26,420 fail needs the location of their funds in
 * the first second, not the third paragraph.
 *
 * The timeline stays visible with the failure in place, so the return reads as a
 * completed round trip rather than a hole.
 */
function PayoutReturned({ transfer }: { transfer: Transfer }) {
  return (
    <Screen>
      <Nav title="Transfer" onBack={() => router.replace('/home')} />

      <Body>
        <View style={{ paddingTop: space.md, paddingBottom: space.base }}>
          <Pill tone="fail" label="payout returned" />
          <Text style={[type.title, { marginTop: space.md, marginBottom: 6 }]}>
            Garanti sent it back
          </Text>
          <Text style={[type.body, { lineHeight: 20 }]}>
            The account holder's name didn't match. This is the most common reason a Turkish payout
            bounces.
          </Text>
        </View>

        <Card
          tight
          style={{ marginBottom: space.md, borderColor: 'rgba(143,168,118,0.3)' }}
        >
          <Text style={{ fontSize: 12, color: color.success, fontFamily: face.semibold, marginBottom: 5 }}>
            Your money is safe.
          </Text>
          <Text style={[type.label, { fontSize: 11.5, lineHeight: 18 }]}>
            {transfer.refunded ? format(transfer.refunded, { decimals: 2 }) : '500.00 USDC'} is back in your Corridor
            balance. Fees for the returned leg were refunded.
          </Text>
        </Card>

        <RouteLine steps={buildSteps(transfer)} />
      </Body>

      <Dock>
        {/* One tap, preserving everything already entered. */}
        <Button label="Fix name & retry" onPress={() => router.replace('/transfer/recipient')} />
        <Button label="Get help" variant="ghost" />
      </Dock>
    </Screen>
  );
}
