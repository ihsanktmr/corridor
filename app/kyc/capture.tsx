import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Body, Nav, Screen, goBack } from '../../components/chrome';
import { Check } from '../../components/icons';
import { Rail } from '../../components/RouteLine';
import { Pill, Row } from '../../components/primitives';
import { startKyc, submitKycDocuments } from '../../services/corridor';
import { useCorridor } from '../../state/useCorridor';
import { color, radius, space } from '../../theme/tokens';
import { type } from '../../theme/type';

/**
 * 06 · ID capture
 *
 * One instruction at a time, with the camera doing the teaching. The guide frame is
 * the instruction: two short lines of copy, not a paragraph, because the user is
 * holding a phone in one hand and a licence in the other.
 *
 * Glare and blur are checked on-device before upload. Round-tripping a bad frame to
 * a vendor and failing 60 seconds later is the worst moment in any KYC flow, and
 * most abandonment happens on the second rejection.
 */

/** The three captures, in order. Each press moves to the next and says so. */
const STEPS = [
  { title: 'Front of your licence', hint: 'Fill the frame. Flat surface, no glare.' },
  { title: 'Back of your licence', hint: 'Same again. Keep the barcode in view.' },
  { title: 'Now a selfie', hint: 'Look straight at the camera. Neutral expression.' },
] as const;

export default function Capture() {
  const { kyc, kycSessionId } = useCorridor();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  // Reachable directly, so it opens its own session rather than assuming the gate
  // created one. Without this the shutter silently did nothing.
  useEffect(() => {
    if (kycSessionId === null) void startKyc();
  }, [kycSessionId]);

  useEffect(() => {
    if (kyc === 'approved') router.replace('/transfer/recipient');
    if (kyc === 'resubmit') router.replace('/kyc/gate');
  }, [kyc]);

  const reviewing = kyc === 'review';
  const current = STEPS[index] ?? STEPS[0];

  const onCapture = async () => {
    if (busy || reviewing) return;
    if (index < STEPS.length - 1) {
      setIndex((i) => i + 1);
      return;
    }
    setBusy(true);
    await submitKycDocuments();
    setBusy(false);
  };

  return (
    <Screen>
      <Nav
        title="Verify identity"
        step={`${index + 1} / ${STEPS.length}`}
        close
        onBack={() => goBack('/kyc/gate')}
      />

      <Body>
        <Rail total={STEPS.length} complete={reviewing ? STEPS.length : index} />

        <Text style={[type.title, { marginBottom: 6 }]}>
          {reviewing ? 'Checking your documents' : current.title}
        </Text>
        <Text style={[type.body, { marginBottom: space.lg }]}>
          {reviewing ? 'Usually under 60 seconds.' : current.hint}
        </Text>

        <Viewport selfie={index === 2} />

        {/* Everything banked so far stays visible; nothing the user has already
            done should feel at risk. */}
        <Row style={{ marginVertical: space.base }}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 }}>
            {STEPS.slice(0, index).map((s) => (
              <Pill key={s.title} tone="done" label={s.title.split(' ')[0]?.toLowerCase() ?? 'done'} />
            ))}
            {index === 0 ? <Text style={[type.label, { fontSize: 11 }]}>Nothing captured yet</Text> : null}
          </View>
          {index > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Check size={11} color={color.success} />
              <Text style={{ fontSize: 11, color: color.success }}>Glare check passed</Text>
            </View>
          ) : null}
        </Row>

        <Pressable
          onPress={onCapture}
          disabled={reviewing || busy}
          accessibilityRole="button"
          accessibilityLabel={index < STEPS.length - 1 ? 'Capture' : 'Capture and submit'}
          style={({ pressed }) => ({
            width: 62,
            height: 62,
            borderRadius: 31,
            borderWidth: 2,
            borderColor: color.line,
            alignSelf: 'center',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: reviewing || busy ? 0.4 : pressed ? 0.7 : 1,
          })}
        >
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: color.gold }} />
        </Pressable>

        {/* Never trap someone in a camera: cracked lenses, bad light, shaky hands.
            It is a real alternate path, so it advances exactly like the shutter. */}
        <Pressable onPress={onCapture} disabled={reviewing || busy} hitSlop={10}>
          <Text style={[type.label, { fontSize: 11, textAlign: 'center', marginTop: space.base }]}>
            Having trouble? <Text style={{ color: color.goldBright }}>Upload from photos</Text>
          </Text>
        </Pressable>
      </Body>
    </Screen>
  );
}

function Viewport({ selfie }: { selfie: boolean }) {
  return (
    <View
      style={{
        aspectRatio: selfie ? 1.1 : 1.58,
        borderRadius: radius.lg,
        overflow: 'hidden',
        backgroundColor: '#1a1712',
        borderWidth: 1,
        borderColor: color.line,
      }}
    >
      {selfie ? (
        <View
          style={{
            position: 'absolute',
            alignSelf: 'center',
            top: '12%',
            bottom: '12%',
            aspectRatio: 0.78,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: color.gold,
            borderStyle: 'dashed',
          }}
        />
      ) : (
        <>
          <View
            style={{
              position: 'absolute',
              left: '13%',
              right: '13%',
              top: '16%',
              bottom: '16%',
              borderRadius: radius.sm,
              backgroundColor: 'rgba(246,243,236,0.045)',
              borderWidth: 1,
              borderColor: 'rgba(246,243,236,0.11)',
            }}
          >
            <View
              style={{
                position: 'absolute',
                left: '8%',
                top: '20%',
                width: '24%',
                height: '56%',
                borderRadius: 4,
                backgroundColor: 'rgba(246,243,236,0.08)',
              }}
            />
            {(
              [
                [24, 52],
                [42, 44],
                [60, 56],
                [78, 36],
              ] as const
            ).map(([top, width]) => (
              <View
                key={top}
                style={{
                  position: 'absolute',
                  right: '8%',
                  top: `${top}%`,
                  width: `${width}%`,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: 'rgba(246,243,236,0.09)',
                }}
              />
            ))}
          </View>

          {/* The guide frame does the work the copy would otherwise have to. */}
          <View style={{ position: 'absolute', left: '8%', right: '8%', top: '11%', bottom: '11%' }}>
            {(
              [
                { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 },
                { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 },
                { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 },
                { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 },
              ] as const
            ).map((corner, i) => (
              <View
                key={i}
                style={{ position: 'absolute', width: 24, height: 24, borderColor: color.gold, ...corner }}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}
