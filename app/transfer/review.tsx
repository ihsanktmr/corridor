import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Dock } from '../../components/Button';
import { Bloom, Body, Nav, RateStrip, Screen } from '../../components/chrome';
import { ConfirmSlider } from '../../components/inputs';
import { RouteMini } from '../../components/RouteLine';
import { Amount, Card, FeeLineRow, MarkDivider, Row } from '../../components/primitives';
import { format } from '../../domain/money';
import { msRemaining, quoteStatus } from '../../domain/quote';
import { convert, formatRate } from '../../domain/rate';
import { createQuote, currentRate, recipientById, submitTransfer } from '../../services/corridor';
import { useCorridor } from '../../state/useCorridor';
import { color, space } from '../../theme/tokens';
import { tabular, type } from '../../theme/type';

/**
 * 08 · Review & confirm  ·  and 11a · rate expired
 *
 * The last screen where anything can be changed. Every number that will be charged
 * is visible without tapping anything — on screen 03 the breakdown collapses because
 * the user is still exploring; here they are committing, so it is all open. Same
 * data, different disclosure, because the stakes changed.
 */
export default function Review() {
  const { quote, recipients } = useCorridor();
  const params = useLocalSearchParams<{ recipientId?: string }>();
  const [now, setNow] = useState(() => new Date());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const recipient = recipientById(params.recipientId ?? '') ?? recipients[0] ?? null;

  if (!quote) {
    return (
      <Screen>
        <Nav title="Review" />
        <Body>
          <Text style={[type.body, { marginTop: space.lg }]}>This transfer has no active quote.</Text>
        </Body>
        <Dock>
          <Button label="Start over" onPress={() => router.replace('/home')} />
        </Dock>
      </Screen>
    );
  }

  const status = quoteStatus(quote, now);
  if (status === 'expired') return <RateExpired />;

  const onConfirm = () => {
    setSubmitting(true);
    const result = submitTransfer(recipient?.id ?? '');
    if (result.ok) {
      router.replace({ pathname: '/transfer/status', params: { id: result.transferId } });
    } else {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Nav title="Review" />

      <Body>
        <Card style={{ marginTop: 6, marginBottom: space.md }}>
          <Text style={[type.label, { marginBottom: 4 }]}>you send</Text>
          <Amount value={quote.totalCharged} size="sub" />
          <Text style={[type.label, { fontSize: 11, marginTop: 2 }]}>from Chase ···4417</Text>

          <MarkDivider />

          <Text style={[type.label, { marginBottom: 4 }]}>
            {recipient?.holderName ?? 'Recipient'} receives
          </Text>
          <Amount value={quote.receive} size="sub" />
          {/* Restated at the last responsible moment, in mono. Wrong-account sends
              are unrecoverable; wrong-account reviews cost one tap back. */}
          <Text style={[type.mono, { fontSize: 11, color: color.mist, marginTop: 2 }]}>
            {recipient?.masked} · {recipient?.bank}
          </Text>
        </Card>

        <RateStrip
          rate={formatRate(quote.rate)}
          remainingMs={msRemaining(quote, now)}
          status={status}
          showSource={false}
        />

        <Card tight style={{ marginTop: space.md, marginBottom: space.md }}>
          <FeeLineRow label="Transfer amount" value={format(quote.send)} />
          {quote.fees.map((f) => (
            <FeeLineRow key={f.kind} label={f.label} value={format(f.amount)} />
          ))}
          <FeeLineRow label="Total charged" value={format(quote.totalCharged)} total />
        </Card>

        <Card tight style={{ marginBottom: space.md }}>
          <Row style={{ marginBottom: space.base }}>
            <Text style={[type.label, { fontSize: 12 }]}>Estimated arrival</Text>
            <Text style={[type.bodyStrong, { fontSize: 12.5 }]}>Wed, Aug 5 · by 14:00</Text>
          </Row>
          {/* The user has already seen the map before they watch the dot move. */}
          <RouteMini labels={['ACH', 'USDC', 'Base', 'TRY']} filled={1} />
        </Card>
      </Body>

      <Dock bordered>
        {/* Slide, not tap. Deliberate friction proportional to irreversibility —
            this is the moment money leaves. */}
        <ConfirmSlider
          label={`Slide to send ${format(quote.totalCharged)}`}
          onConfirm={onConfirm}
          disabled={submitting}
        />
      </Dock>
    </Screen>
  );
}

/**
 * 11a · Rate expired
 *
 * "Nothing was sent" is the first line, because that is the user's first fear. Then
 * the delta — old, new, and what it costs in the currency the recipient cares about.
 * Re-accepting is an explicit choice with a fresh lock, never a silent re-quote: an
 * app that quietly repriced would be indistinguishable from one that skimmed.
 */
function RateExpired() {
  const { quote } = useCorridor();
  const fresh = currentRate();

  // A visibly worse rate, so the delta is real rather than decorative.
  const worse = { ...fresh, num: fresh.num - 23n };
  const newReceive = quote ? convert(quote.send, worse) : null;
  const delta =
    quote && newReceive ? { currency: 'TRY' as const, minor: quote.receive.minor - newReceive.minor } : null;

  return (
    <Screen>
      <Nav title="Review" />

      <Body>
        <View style={{ alignItems: 'center', paddingTop: space.base, paddingBottom: space.base }}>
          <Bloom tone="warning" glyph="↻" />
          <Text style={[type.title, { marginTop: space.base }]}>Your rate expired</Text>
          <Text style={[type.body, { textAlign: 'center', marginTop: 6 }]}>
            Nothing was sent. Here's the current rate.
          </Text>
        </View>

        <Card tight style={{ marginBottom: space.md }}>
          <Row style={{ paddingVertical: 5 }}>
            <Text style={[type.label, { fontSize: 12 }]}>Old rate</Text>
            <Text style={[type.label, tabular, { textDecorationLine: 'line-through' }]}>
              {quote ? formatRate(quote.rate) : '52.84'} ₺
            </Text>
          </Row>
          <Row style={{ paddingVertical: 5 }}>
            <Text style={[type.label, { fontSize: 12 }]}>Current rate</Text>
            <Text style={[type.label, tabular, { color: color.warning }]}>{formatRate(worse)} ₺</Text>
          </Row>
          <FeeLineRow
            label="Elif now receives"
            value={newReceive ? format(newReceive) : '—'}
            total
          />
          {delta ? (
            <Text style={{ fontSize: 10.5, color: color.warning, marginTop: 9 }}>
              {format(delta)} less than your expired quote.
            </Text>
          ) : null}
        </Card>

        <RateStrip rate={formatRate(worse)} remainingMs={15 * 60_000} status="live" showSource={false} />
      </Body>

      <Dock>
        <Button
          label="Accept new rate"
          onPress={() => {
            createQuote(quote ? (Number(quote.send.minor) / 100).toFixed(2) : '500.00');
            router.replace('/transfer/review');
          }}
        />
        <Button label="Cancel transfer" variant="ghost" onPress={() => router.replace('/home')} />
      </Dock>
    </Screen>
  );
}
