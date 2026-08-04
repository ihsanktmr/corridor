import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Dock } from '../../components/Button';
import { Body, Nav, Screen } from '../../components/chrome';
import { RouteMini } from '../../components/RouteLine';
import { Card, Disclose, Option, Row } from '../../components/primitives';
import { format, parseAmount } from '../../domain/money';
import type { FiatRail } from '../../domain/quote';
import { onrampFor } from '../../providers/registry';
import { ACTIVE_CORRIDOR } from '../../providers/registry';
import { useCorridor } from '../../state/useCorridor';
import { color, space } from '../../theme/tokens';
import { tabular, type } from '../../theme/type';

/**
 * 04 · Add USD — on-ramp
 *
 * Make the speed-versus-cost trade legible before the user commits to it.
 *
 * A date, not a duration: "arrives Wed, Aug 5" rather than "1–3 business days". The
 * vague version is where remittance apps lose people, because the sender usually
 * has a real deadline on the other end.
 */
export default function Fund() {
  const { quote } = useCorridor();
  const [rail, setRail] = useState<FiatRail>('ach');

  const onramp = onrampFor(ACTIVE_CORRIDOR);
  const charged = quote?.totalCharged ?? parseAmount('USD', '503.75');

  const arrival = useMemo(() => {
    const date = onramp.estimateSettlement(rail, new Date());
    if (rail === 'card') return 'arrives today';
    return `arrives ${date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })}`;
  }, [rail, onramp]);

  return (
    <Screen>
      <Nav title="Add USD" step="2 / 4" />

      <Body>
        <Text style={[type.display, { marginTop: space.md }]}>
          How do you want{'\n'}to pay the {format(charged)}?
        </Text>
        <Text style={[type.body, { marginBottom: space.lg }]}>
          Your USD becomes USDC the moment it lands.
        </Text>

        <View style={{ gap: 10 }}>
          <Option
            selected={rail === 'ach'}
            onPress={() => setRail('ach')}
            title={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                <Text style={type.bodyStrong}>Bank transfer</Text>
                <Text style={[type.label, { fontSize: 10 }]}>ACH</Text>
              </View>
            }
            subtitle={`Chase ···4417 · ${rail === 'ach' ? arrival : 'arrives in 2 business days'}`}
            trailing={
              <Text style={[type.label, { fontSize: 12.5, fontWeight: '600', color: color.success }]}>
                Free
              </Text>
            }
          />

          <Option
            selected={rail === 'card'}
            onPress={() => setRail('card')}
            title="Debit card"
            subtitle="Instant · arrives today"
            trailing={
              <Text style={[type.bodyStrong, tabular, { fontSize: 12.5, fontWeight: '600' }]}>$7.56</Text>
            }
          />

          <Option
            selected={rail === 'wire'}
            onPress={() => setRail('wire')}
            title="Wire"
            subtitle="Same business day if sent before 15:00 ET"
            trailing={
              <Text style={[type.bodyStrong, tabular, { fontSize: 12.5, fontWeight: '600' }]}>$15.00</Text>
            }
          />
        </View>

        <Card tight style={{ marginTop: space.base, marginBottom: space.base }}>
          <Row style={{ marginBottom: space.md }}>
            <Text style={[type.label, { fontSize: 12.5 }]}>You pay</Text>
            <Text style={[type.bodyStrong, tabular, { fontWeight: '600' }]}>{format(charged)}</Text>
          </Row>
          {/* The choice only affects the first hop — the chain and payout legs are
              identical either way. */}
          <RouteMini labels={['Chase', 'USDC · Base', 'Garanti']} filled={2} />
        </Card>

        {/* The simulation notice sits in the flow, at the moment of the lie. Text
            comes from the provider registry, not from a string in this file. */}
        <Disclose text={onramp.meta.disclosure ?? ''} />
      </Body>

      <Dock>
        <Button label={`Pay ${format(charged)}`} onPress={() => router.push('/kyc/gate')} />
      </Dock>
    </Screen>
  );
}
