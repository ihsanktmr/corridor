import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Body, Nav, Screen } from '../../components/chrome';
import { Rail } from '../../components/RouteLine';
import { Pill, Row } from '../../components/primitives';
import { submitKycDocuments } from '../../services/corridor';
import { useCorridor } from '../../state/useCorridor';
import { color, radius, space } from '../../theme/tokens';
import { type } from '../../theme/type';

/**
 * 06 · ID capture
 *
 * One instruction at a time, with the camera doing the teaching. The guide frame is
 * the instruction — two short lines of copy, not a paragraph, because the user is
 * holding a phone in one hand and a licence in the other.
 *
 * Glare and blur are checked on-device before upload. Round-tripping a bad frame to
 * a vendor and failing 60 seconds later is the worst moment in any KYC flow, and
 * most abandonment happens on the second rejection.
 */
export default function Capture() {
  const { kyc } = useCorridor();
  const [step, setStep] = useState(2);

  useEffect(() => {
    if (kyc === 'approved') router.replace('/transfer/recipient');
    if (kyc === 'resubmit') router.replace('/kyc/gate');
  }, [kyc]);

  const onCapture = async () => {
    if (step < 3) {
      setStep((s) => s + 1);
      return;
    }
    await submitKycDocuments();
  };

  const reviewing = kyc === 'review';

  return (
    <Screen>
      <Nav title="Government ID" step={`${step} / 3`} close onBack={() => router.back()} />

      <Body>
        <Rail total={3} complete={step} />

        <Text style={[type.title, { marginBottom: 6 }]}>
          {reviewing ? 'Checking your documents' : 'Back of your licence'}
        </Text>
        <Text style={[type.body, { marginBottom: space.lg }]}>
          {reviewing ? 'Usually under 60 seconds.' : 'Fill the frame. Flat surface, no glare.'}
        </Text>

        <Viewport />

        <Row style={{ marginVertical: space.base }}>
          <Pill tone="done" label="front captured" />
          <Text style={{ fontSize: 11, color: color.success }}>✓ Glare check passed</Text>
        </Row>

        <Pressable
          onPress={onCapture}
          disabled={reviewing}
          style={{
            width: 62,
            height: 62,
            borderRadius: 31,
            borderWidth: 2,
            borderColor: color.line,
            alignSelf: 'center',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: reviewing ? 0.4 : 1,
          }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: color.gold }} />
        </Pressable>

        {/* Never trap someone in a camera — cracked lenses, bad light, shaky hands. */}
        <Text style={[type.label, { fontSize: 11, textAlign: 'center', marginTop: space.base }]}>
          Having trouble? <Text style={{ color: color.goldBright }}>Upload from photos</Text>
        </Text>
      </Body>
    </Screen>
  );
}

function Viewport() {
  return (
    <View
      style={{
        aspectRatio: 1.58,
        borderRadius: radius.lg,
        overflow: 'hidden',
        backgroundColor: '#1a1712',
        borderWidth: 1,
        borderColor: color.line,
      }}
    >
      {/* The document, faintly */}
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
            style={{
              position: 'absolute',
              width: 24,
              height: 24,
              borderColor: color.gold,
              ...corner,
            }}
          />
        ))}
      </View>
    </View>
  );
}
