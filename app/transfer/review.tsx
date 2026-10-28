import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Dock } from '../../components/Button';
import { Bloom, Body, Nav, RateStrip, Screen } from '../../components/chrome';
import { ConfirmSlider } from '../../components/inputs';
import { RouteMini } from '../../components/RouteLine';
import { Amount, Card, FeeLineRow, MarkDivider, Row } from '../../components/primitives';
import { format } from '../../domain/money';
import { msRemaining, quoteStatus } from '../../domain/quote';
import { convert, formatRate } from '../../domain/rate';
import { Refresh } from '../../components/icons';
import { ACTIVE_CORRIDOR, onrampFor } from '../../providers/registry';
import { currentRate, recipientById, requote, submitTransfer } from '../../services/corridor';
import { useCorridor } from '../../state/useCorridor';
import { color, space } from '../../theme/tokens';
import { tabular, type } from '../../theme/type';

/**
 * 08 · Review & confirm  ·  and 11a · rate expired
 *
 * The last screen where anything can be changed. Every number that will be charged
 * is visible without tapping anything. On screen 03 the breakdown collapses because
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

  // Same source as screen 04: one estimate, quoted once.
  const arrival = useMemo(() => {
    const rail = quote?.rail ?? 'ach';
    if (rail === 'card') return 'Today';
    const date = onrampFor(ACTIVE_CORRIDOR).estimateSettlement(rail, new Date());
    return `${date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })} · by 14:00`;
  }, [quote?.rail]);

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
  if (status === 'expired') return <RateExpired recipientName={recipient?.holderName ?? null} />;

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
            {/*
              Computed from the same provider method screen 04 used, not written
              here. Hardcoding it meant a user could pick ACH, read "arrives Fri,
              Aug 7", and then be told "Wed, Aug 5" one screen later, which
              defeats the whole point of promising a date instead of a duration.
            */}
            <Text style={[type.bodyStrong, { fontSize: 12.5 }]}>{arrival}</Text>
          </Row>
          {/* The user has already seen the map before they watch the dot move. */}
          <RouteMini labels={['ACH', 'USDC', 'Base', 'TRY']} filled={1} />
        </Card>
      </Body>

      <Dock bordered>
        {/* Slide, not tap. Deliberate friction proportional to irreversibility;
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
 * the delta: old, new, and what it costs in the currency the recipient cares about.
 * Re-accepting is an explicit choice with a fresh lock, never a silent re-quote: an
 * app that quietly repriced would be indistinguishable from one that skimmed.
 */
function RateExpired({ recipientName }: { recipientName: string | null }) {
  const { quote } = useCorridor();
  // The same feed "Accept new rate" quotes from, so the number shown here is the
  // number the server will issue. The demo scene moves the feed; a real expiry
  // shows whatever the market did, including nothing.
  const fresh = currentRate();
  const newReceive = quote ? convert(quote.send, fresh) : null;
  const delta = quote && newReceive ? quote.receive.minor - newReceive.minor : 0n;

  return (
    <Screen>
      <Nav title="Review" />

      <Body scroll={false}>
        {/* Short screen: distribute rather than top-load, or the dock floats under
            a large dead void. */}
        <View style={{ flex: 1, justifyContent: 'center', paddingBottom: space.xl }}>
        <View style={{ alignItems: 'center', paddingTop: space.base, paddingBottom: space.base }}>
          <Bloom tone="warning"><Refresh size={30} /></Bloom>
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
            <Text style={[type.label, tabular, delta > 0n ? { color: color.warning } : null]}>
              {formatRate(fresh)} ₺
            </Text>
          </Row>
          <FeeLineRow
            label={`${recipientName ?? 'Recipient'} now receives`}
            value={newReceive ? format(newReceive) : '—'}
            total
          />
          {delta !== 0n ? (
            <Text style={{ fontSize: 10.5, color: delta > 0n ? color.warning : color.success, marginTop: 9 }}>
              {format({ currency: 'TRY', minor: delta > 0n ? delta : -delta })}{' '}
              {delta > 0n ? 'less' : 'more'} than your expired quote.
            </Text>
          ) : null}
        </Card>

        <RateStrip rate={formatRate(fresh)} remainingMs={15 * 60_000} status="live" showSource={false} />
        </View>
      </Body>

      <Dock>
        <Button
          label="Accept new rate"
          onPress={() => {
            requote();
            router.replace('/transfer/review');
          }}
        />
        <Button label="Cancel transfer" variant="ghost" onPress={() => router.replace('/home')} />
      </Dock>
    </Screen>
  );
}
