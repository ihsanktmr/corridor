import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Body, DemoStrip, Screen, Wordmark } from '../components/chrome';
import { Account } from '../components/icons';
import { Amount, Card, Chip, CorridorStrip, ListRow, Pill, Row } from '../components/primitives';
import { format } from '../domain/money';
import { formatRate } from '../domain/rate';
import { shortAddress, type Transfer } from '../domain/transfer';
import { currentRate } from '../services/corridor';
import { useCorridor } from '../state/useCorridor';
import { color, space } from '../theme/tokens';
import { tabular, type } from '../theme/type';

/**
 * 02 · Home
 *
 * One balance, one corridor, one action. Everything else is history.
 *
 * A single primary CTA — not "send / receive / swap / buy". This app does one thing
 * and the home screen should be embarrassed to pretend otherwise.
 */
export default function Home() {
  const { balance, session, transfers } = useCorridor();

  return (
    <Screen>
      <DemoStrip />

      <View
        style={{
          height: 50,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: space.lg,
        }}
      >
        <Wordmark />
        <Pressable
          onPress={() => router.push('/help')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Help and about"
        >
          <Account />
        </Pressable>
      </View>

      <Body>
        <Card style={{ marginTop: space.sm, marginBottom: space.base }}>
          <Text style={[type.micro, { marginBottom: space.md }]}>your balance</Text>
          <Amount value={balance} size="hero" showCurrency={false} />
          <Text style={[type.label, tabular, { fontSize: 13, marginTop: 9, marginBottom: space.base }]}>
            {/* The whole reason a remittance user tolerates a stablecoin is that it
                doesn't move. Say it where the number is. */}
            ≈ {format({ currency: 'USD', minor: balance.minor / 10_000n })} — always 1:1
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Chip value={shortAddress(session?.address ?? '0x0000')} muted />
            <Text style={[type.label, { fontSize: 10.5 }]}>Base</Text>
          </View>
        </Card>

        <CorridorStrip
          right={
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[type.bodyStrong, tabular, { fontSize: 12 }]}>
                {formatRate(currentRate())} ₺
              </Text>
              <Text style={{ fontSize: 10, color: color.success, marginTop: 1 }}>▲ 0.4% today</Text>
            </View>
          }
        />

        <Button
          label="Send to Turkey"
          onPress={() => router.push('/transfer/amount')}
          style={{ marginTop: space.base, marginBottom: space.lg }}
        />

        {/* No "See all" — this list is already everything. An affordance that
            implies more content teaches the user the controls are decorative. */}
        <Text style={[type.micro, { marginBottom: 2 }]}>activity</Text>

        {transfers.length === 0 ? (
          <Text style={[type.label, { paddingVertical: space.lg }]}>
            No transfers yet. Your first one takes about two minutes.
          </Text>
        ) : (
          transfers.map((t, i) => (
            <ActivityRow key={t.id} transfer={t} last={i === transfers.length - 1} />
          ))
        )}
      </Body>
    </Screen>
  );
}

function ActivityRow({ transfer, last }: { transfer: Transfer; last: boolean }) {
  const { tone, label } = statusOf(transfer);

  return (
    <View>
      <ListRow
        lead="TR"
        title="Elif Yıldız"
        subtitle={`${new Date(transfer.events[0]?.at ?? Date.now()).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })} · Garanti BBVA`}
        value={format(transfer.quote.receive)}
        meta={<Pill tone={tone} label={label} />}
        last={last}
      />
    </View>
  );
}

/**
 * `in transit` is a first-class state here, not an edge case — the ACH leg means
 * transfers genuinely live for days.
 */
function statusOf(t: Transfer): { tone: 'done' | 'live' | 'wait' | 'fail'; label: string } {
  switch (t.state) {
    case 'delivered':
      return { tone: 'done', label: 'delivered' };
    case 'payout_returned':
      return { tone: 'fail', label: 'returned' };
    case 'refunded':
      return { tone: 'fail', label: 'refunded' };
    case 'clawback':
      return { tone: 'fail', label: 'under review' };
    case 'funded_held':
      return { tone: 'wait', label: 'funds held' };
    default:
      return { tone: 'live', label: 'in transit' };
  }
}
