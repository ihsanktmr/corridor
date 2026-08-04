import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Dock } from '../../components/Button';
import { Body, Nav, Screen } from '../../components/chrome';
import { Field } from '../../components/inputs';
import { Card, Option, Pill } from '../../components/primitives';
import { format } from '../../domain/money';
import { formatIban, validateTurkishIban, IBAN_MESSAGES } from '../../domain/iban';
import { addRecipient } from '../../services/corridor';
import { useCorridor } from '../../state/useCorridor';
import { color, space } from '../../theme/tokens';
import { face, type } from '../../theme/type';

/**
 * 07 · Recipient
 *
 * Catch the failure here, where it costs a retype — not at payout, where it costs
 * three days.
 *
 * The IBAN is validated locally (TR length + ISO 7064 mod-97) before any network
 * call, and the bank is derived from the IBAN's own bank code and echoed back. That
 * is the cheapest possible confirmation that the user typed the right account: they
 * recognise the bank, or they don't.
 */
export default function RecipientScreen() {
  const { recipients, quote } = useCorridor();
  const [selected, setSelected] = useState(recipients[0]?.id ?? null);
  const [name, setName] = useState('');
  const [iban, setIban] = useState('');

  const validation = useMemo(() => {
    if (iban.trim() === '') return null;
    return validateTurkishIban(iban);
  }, [iban]);

  const canContinue =
    selected !== null || (validation?.ok === true && name.trim().length >= 3);

  const onContinue = () => {
    if (selected === null && validation?.ok === true) {
      const created = addRecipient(name, iban);
      if (!created) return;
      router.push({ pathname: '/transfer/review', params: { recipientId: created.id } });
      return;
    }
    router.push({ pathname: '/transfer/review', params: { recipientId: selected ?? '' } });
  };

  return (
    <Screen>
      <Nav title="Recipient" step="4 / 4" />

      <Body>
        <Text style={[type.display, { marginTop: space.md }]}>
          Who's receiving{'\n'}the {quote ? format(quote.receive) : '₺26,420.00'}?
        </Text>
        <Text style={[type.body, { marginBottom: space.lg }]}>
          Turkish bank account, in Turkish lira.
        </Text>

        {recipients.length > 0 ? (
          <>
            <Text style={[type.micro, { marginBottom: 10 }]}>saved</Text>
            <View style={{ gap: 10, marginBottom: space.lg }}>
              {recipients.map((r) => (
                <Option
                  key={r.id}
                  selected={selected === r.id}
                  onPress={() => setSelected(selected === r.id ? null : r.id)}
                  title={r.holderName}
                  subtitle={`${r.masked} · ${r.bank}`}
                  trailing={r.verified ? <Pill tone="done" label="verified" /> : undefined}
                />
              ))}
            </View>
          </>
        ) : null}

        <Text style={[type.micro, { marginBottom: 10 }]}>or add someone new</Text>

        {/* "Exactly as their bank has it" tells the user what correctness means
            here, which is not what it means anywhere else in the app. */}
        <Field
          label="Full name — exactly as their bank has it"
          value={name}
          onChangeText={(v) => {
            setName(v);
            setSelected(null);
          }}
          placeholder="Ad Soyad"
          autoCapitalize="words"
        />

        <Field
          label="IBAN"
          value={formatIban(iban)}
          onChangeText={(v) => {
            setIban(v);
            setSelected(null);
          }}
          // Middle dots, matching the mask idiom used everywhere else (TR20 ···· 2345).
          // Underscores read as a form to fill rather than a shape to match.
          placeholder="TR·· ···· ···· ···· ···· ···· ··"
          mono
          autoCapitalize="characters"
          tone={validation === null ? 'neutral' : validation.ok ? 'ok' : 'bad'}
          hint={
            validation === null
              ? undefined
              : validation.ok
                ? `✓ Checksum valid · ${validation.bank}`
                : IBAN_MESSAGES[validation.problem]
          }
        />

        {/* The number one cause of Turkish payout rejection, with the actual
            consequence and the actual delay. A user who reads this checks the
            spelling. */}
        <Card tight style={{ marginTop: 6 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Text style={{ color: color.warning, fontSize: 13, lineHeight: 18 }}>!</Text>
            <Text style={[type.label, { flex: 1, fontSize: 11.5, lineHeight: 18 }]}>
              <Text style={{ color: color.paper, fontFamily: face.medium }}>
                Turkish banks reject on name mismatch.{' '}
              </Text>
              If the name doesn't match the account holder exactly, the payout bounces — and takes 2–3
              days to come back.
            </Text>
          </View>
        </Card>
      </Body>

      <Dock>
        <Button label="Continue" onPress={onContinue} disabled={!canContinue} />
      </Dock>
    </Screen>
  );
}
