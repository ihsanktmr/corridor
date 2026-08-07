import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Dock } from '../../components/Button';
import { Body, Nav, RateStrip, Screen } from '../../components/chrome';
import { Keypad } from '../../components/inputs';
import { Amount, Card, FeeLineRow, MarkDivider } from '../../components/primitives';
import { format, parseAmount, type Money } from '../../domain/money';
import { msRemaining, quoteStatus, totalFees } from '../../domain/quote';
import { convert, formatRate } from '../../domain/rate';
import { createQuote, currentRate } from '../../services/corridor';
import { useCorridor } from '../../state/useCorridor';
import { color, space } from '../../theme/tokens';
import { type } from '../../theme/type';

/**
 * 03 · Amount
 *
 * The quote is the product. Everything else is logistics.
 *
 * Mid-market rate with no markup, stated on the screen. Legacy remitters bury a
 * 3-5% spread in a "free transfer", so naming our margin out loud is the entire
 * competitive posture and belongs next to the number.
 */
export default function AmountScreen() {
  const { quote } = useCorridor();
  const [digits, setDigits] = useState('500.00');
  // Collapsed by default. The user is still exploring here; on screen 08 they are
  // committing, so the same data is shown fully open. Same numbers, different
  // disclosure, because the stakes changed.
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const rate = useMemo(() => currentRate(), []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const send: Money | null = useMemo(() => {
    try {
      return parseAmount('USD', digits || '0');
    } catch {
      return null;
    }
  }, [digits]);

  const receive = send ? convert(send, rate) : parseAmount('TRY', '0');

  const fees = quote?.fees ?? [];
  const feeTotal = fees.length > 0 ? totalFees(fees) : parseAmount('USD', '3.75');
  const charged =
    send !== null ? { currency: 'USD' as const, minor: send.minor + feeTotal.minor } : null;

  const rejection = useMemo(() => {
    if (!send) return 'Enter an amount';
    if (send.minor < 1_000n) return 'Minimum transfer is $10.00';
    if (send.minor > 299_900n) return 'Above your $2,999.00 per-transfer limit';
    return null;
  }, [send]);

  const onContinue = () => {
    const result = createQuote(digits);
    if (result.ok) router.push('/transfer/fund');
  };

  return (
    <Screen>
      <Nav title="New transfer" step="1 / 4" />

      <Body scroll={false}>
        <View style={{ paddingTop: space.base, paddingBottom: space.xs }}>
          <Text style={[type.label, { marginBottom: 4 }]}>you send</Text>
          <Amount
            value={send ?? parseAmount('USD', '0')}
            size="hero"
            showCurrency={false}
            caret
          />
        </View>

        {/* The mark doubles as the divider between the two currencies, phase 1's
            own applied pattern, doing its job. */}
        <MarkDivider />

        <View style={{ paddingBottom: space.base }}>
          <Text style={[type.label, { marginBottom: 4 }]}>Elif receives</Text>
          <Amount value={receive} size="sub" />
        </View>

        {quote ? (
          <RateStrip
            rate={formatRate(quote.rate)}
            remainingMs={msRemaining(quote, now)}
            status={quoteStatus(quote, now)}
          />
        ) : (
          <RateStrip rate={formatRate(rate)} remainingMs={15 * 60_000} status="live" />
        )}

        <Card tight style={{ marginTop: space.md, marginBottom: space.base }}>
          <Pressable
            onPress={() => setExpanded((e) => !e)}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Text style={[type.label, { fontSize: 12.5 }]}>Fees</Text>
            <Text style={[type.label, { fontSize: 12.5, color: color.paper }]}>
              {format(feeTotal)} {expanded ? '⌃' : '⌄'}
            </Text>
          </Pressable>

          {expanded ? (
            <View style={{ borderTopWidth: 1, borderTopColor: color.line, marginTop: 11, paddingTop: 4 }}>
              <FeeLineRow label="On-ramp · ACH → USDC" value="$1.25" />
              <FeeLineRow label="Network · Base" value="$0.01" />
              <FeeLineRow label="Payout · USDC → TRY" value="$2.49" />
              <FeeLineRow
                label="Total charged"
                value={charged ? format(charged) : '—'}
                total
              />
            </View>
          ) : null}

          <Text style={{ fontSize: 10.5, color: color.success, marginTop: space.md, lineHeight: 16 }}>
            No FX markup. You get the mid-market rate. Our margin is the {format(feeTotal)}.
          </Text>
        </Card>

        {/* The keypad is the floor of the screen, never a layer over the card
            above it. `minHeight: 0` lets this column shrink instead of letting
            the keypad's intrinsic height push it into the fee breakdown. */}
        <View style={{ flex: 1, minHeight: 0, justifyContent: 'flex-end' }}>
          <Keypad value={digits} onChange={setDigits} />
        </View>
      </Body>

      <Dock>
        {rejection && digits !== '' ? (
          <Text style={{ fontSize: 11.5, color: color.warning, textAlign: 'center', marginBottom: 6 }}>
            {rejection}
          </Text>
        ) : null}
        <Button label="Continue" onPress={onContinue} disabled={rejection !== null} />
      </Dock>
    </Screen>
  );
}
