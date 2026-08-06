import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, Share as RNShare, Text, View } from 'react-native';

import { Button, Dock } from '../../components/Button';
import { Bloom, Body, Nav, Screen } from '../../components/chrome';
import { Check, ExternalLink, Share } from '../../components/icons';
import { Amount, Card, Chip, FeeLineRow, Row } from '../../components/primitives';
import { format } from '../../domain/money';
import { formatRate } from '../../domain/rate';
import { CONFIRMATIONS_REQUIRED, shortHash } from '../../domain/transfer';
import { totalFees } from '../../domain/quote';
import { recipientById, transferById } from '../../services/corridor';
import { useCorridor } from '../../state/useCorridor';
import { color, space } from '../../theme/tokens';
import { type } from '../../theme/type';

/**
 * The amount actually settled on Base Sepolia, from `proof-artifact.json`.
 * Constrained by Circle's testnet faucet, not by the design.
 */
const PROOF_AMOUNT = '1.00';

/**
 * 10 · Receipt
 *
 * The proof artifact. This is the screen that gets screenshotted and sent to the
 * person on the other end.
 *
 * The tx hash is copyable and links out to BaseScan — a real, independently
 * verifiable Base Sepolia transfer. Anyone reviewing this can check it without
 * taking my word for anything.
 */
export default function Receipt() {
  const params = useLocalSearchParams<{ id?: string }>();
  const state = useCorridor();
  const transfer = transferById(params.id ?? state.activeTransferId);

  if (!transfer) {
    return (
      <Screen>
        <Nav title="Receipt" close onBack={() => router.replace('/home')} />
        <Body>
          <Text style={[type.body, { marginTop: space.lg }]}>Receipt not found.</Text>
        </Body>
      </Screen>
    );
  }

  const recipient = recipientById(transfer.recipientId);
  const { quote } = transfer;
  const explorer = `https://sepolia.basescan.org/tx/${transfer.txHash ?? ''}`;

  /** Real, and the most common next action — the sender forwards this. */
  const onShare = () => {
    void RNShare.share({
      message:
        `Corridor — ${format(quote.receive)} delivered to ${recipient?.holderName ?? 'recipient'}\n` +
        `Ref CRD-8F2A-4417\n${explorer}`,
    });
  };

  const firstAt = transfer.events[0]?.at;
  const lastAt = transfer.events[transfer.events.length - 1]?.at;
  const transit =
    firstAt && lastAt ? humanDuration(Date.parse(lastAt) - Date.parse(firstAt)) : '—';

  return (
    <Screen>
      <Nav
        title="Receipt"
        close
        onBack={() => router.replace('/home')}
        right={
          <Pressable onPress={onShare} hitSlop={12} accessibilityLabel="Share receipt">
            <Share />
          </Pressable>
        }
      />

      <Body>
        <View style={{ alignItems: 'center', paddingTop: space.base, paddingBottom: space.lg }}>
          <Bloom tone="success"><Check size={32} color={color.success} strokeWidth={2.4} /></Bloom>
          <Text style={[type.micro, { marginTop: space.lg, marginBottom: 10 }]}>delivered</Text>
          {/* Delivered amount is the hero, in the recipient's currency — the
              sender's mental model ends at "did she get the lira". */}
          <Amount value={quote.receive} size="hero" showCurrency={false} />
          <Text style={[type.label, { fontSize: 13, marginTop: space.md }]}>
            to {recipient?.holderName ?? 'recipient'} · {recipient?.bank ?? ''}
          </Text>
          <Text style={[type.label, { fontSize: 12, marginTop: 4 }]}>
            {lastAt
              ? new Date(lastAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })
              : ''}
          </Text>
        </View>

        {/* Rate used and fees restated after the fact — a quote you can only see
            before you commit isn't a quote you can audit, and disputes are always
            after. */}
        <Card tight style={{ marginBottom: space.md }}>
          <FeeLineRow label="You paid" value={format(quote.totalCharged)} />
          <FeeLineRow label="Rate used" value={`${formatRate(quote.rate)} ₺ / USD`} />
          <FeeLineRow label="Total fees" value={format(totalFees(quote.fees))} />
          {/* Reported honestly rather than quietly omitted: ACH was the slow leg,
              the chain leg took seconds. That contrast is the argument for
              stablecoin rails, and hiding it would throw the point away. */}
          <FeeLineRow label="Time in transit" value={transit} />
          <FeeLineRow label={`${recipient?.holderName ?? 'Recipient'} received`} value={format(quote.receive)} total />
        </Card>

        <Card tight style={{ marginBottom: space.md }}>
          <Text style={[type.micro, { marginBottom: 11 }]}>on-chain proof</Text>
          <Chip
            value={transfer.txHash ? shortHash(transfer.txHash) : '—'}
            onPress={() => {
              if (transfer.txHash) void Linking.openURL(explorer);
            }}
          />
          <Row style={{ marginTop: 11 }}>
            <Text style={[type.label, { fontSize: 11 }]}>
              Base Sepolia · {PROOF_AMOUNT} USDC · {CONFIRMATIONS_REQUIRED}+ confs
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ fontSize: 11.5, color: color.goldBright }}>BaseScan</Text>
              <ExternalLink />
            </View>
          </Row>
          {/*
            The hash above is a real transaction, and it carries a different amount
            from the figures on this receipt. Saying so here — rather than only in
            the README — is the point: a receipt that implied a 500.00 settlement
            over a 1.00 transaction would be the exact thing this project argues
            against.
          */}
          <Text style={[type.label, { fontSize: 10, marginTop: 9, lineHeight: 15 }]}>
            Figures above are demo values; the transaction is {PROOF_AMOUNT} USDC — faucet-capped,
            same contract and signing path.
          </Text>
        </Card>

        <Row style={{ paddingVertical: 2, paddingBottom: space.md }}>
          <Text style={[type.label, { fontSize: 11.5 }]}>Reference</Text>
          <Text style={[type.mono, { fontSize: 11.5, color: color.paper }]}>CRD-8F2A-4417</Text>
        </Row>
      </Body>

      <Dock>
        {/* Remittance is a habit — most senders are on a monthly cycle to the same
            person, so "Send again" beats "Done". */}
        <Button label="Send again" onPress={() => router.replace('/transfer/amount')} />
        <Button label="Share receipt" variant="ghost" onPress={onShare} />
      </Dock>
    </Screen>
  );
}

function humanDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
