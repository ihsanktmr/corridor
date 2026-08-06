import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatCountdown, type QuoteStatus } from '../domain/quote';
import { demoStripLabel } from '../providers/registry';
import { color, radius, space } from '../theme/tokens';
import { face, type } from '../theme/type';
import { ChevronLeft, Close, Lock as LockIcon } from './icons';
import { Mark } from './Mark';

/** Every screen sits on the void with safe-area insets honoured. */
export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.void }} edges={['top', 'bottom']}>
      {children}
    </SafeAreaView>
  );
}

export function Body({
  children,
  scroll = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
}) {
  if (!scroll) {
    return <View style={{ flex: 1, paddingHorizontal: space.lg }}>{children}</View>;
  }
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function Nav({
  title,
  step,
  onBack,
  close = false,
  right,
}: {
  title?: string;
  step?: string;
  onBack?: () => void;
  close?: boolean;
  right?: React.ReactNode;
}) {
  const back = onBack ?? (() => router.back());

  return (
    <View
      style={{
        height: 50,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: space.lg,
        gap: space.md,
      }}
    >
      <Pressable
        onPress={back}
        accessibilityRole="button"
        accessibilityLabel={close ? 'Close' : 'Back'}
        hitSlop={12}
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: color.concrete,
          borderWidth: 1,
          borderColor: color.line,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {close ? <Close /> : <ChevronLeft />}
      </Pressable>

      {title ? (
        <Text style={[type.bodyStrong, { flex: 1, textAlign: 'center' }]}>{title}</Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}

      {step ? (
        <Text style={[type.mono, { fontSize: 11, color: color.mist }]}>{step}</Text>
      ) : (
        (right ?? <View style={{ width: 34 }} />)
      )}
    </View>
  );
}

/**
 * The persistent demo strip.
 *
 * Text comes from the provider registry, not from a string in this file — if a real
 * key were bound, this would change without anyone editing a screen. Chrome, never
 * a dismissible toast.
 */
export function DemoStrip() {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: color.line,
        backgroundColor: color.concrete,
      }}
    >
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color.warning }} />
      <Text style={{ fontSize: 10, color: color.mist, letterSpacing: 0.4 }}>{demoStripLabel()}</Text>
    </View>
  );
}

/**
 * The rate strip with its lock countdown.
 *
 * The countdown is mono because it is a machine-owned number the user is watching,
 * and mono makes it read as authoritative rather than decorative. It turns amber
 * below 60s — the warning arrives before the failure, not as it.
 */
export function RateStrip({
  rate,
  remainingMs,
  status,
  showSource = true,
}: {
  rate: string;
  remainingMs: number;
  status: QuoteStatus;
  showSource?: boolean;
}) {
  const warn = status !== 'live';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space.md,
        backgroundColor: color.concrete,
        borderWidth: 1,
        borderColor: warn ? 'rgba(201,138,75,0.4)' : color.line,
        borderRadius: radius.md,
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      <Text style={[type.label, { fontSize: 12.5, color: color.paper }]}>
        1 USD = <Text style={{ fontFamily: face.semibold }}>{rate} ₺</Text>
        {showSource ? <Text style={{ color: color.mist }}> · mid-market</Text> : null}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <LockIcon color={warn ? color.warning : color.goldBright} />
        <Text style={[type.mono, { fontSize: 11, color: warn ? color.warning : color.goldBright }]}>
          {status === 'expired' ? 'expired' : formatCountdown(remainingMs)}
        </Text>
      </View>
    </View>
  );
}

/**
 * A drawn padlock rather than the 🔒 emoji.
 *
 * Emoji render in the system's own colour and weight, which fights a palette this
 * restrained — and they resize unpredictably next to mono digits.
 */
function LockGlyph({ color: stroke }: { color: string }) {
  return (
    <View style={{ width: 9, height: 11, alignItems: 'center' }}>
      <View
        style={{
          width: 6,
          height: 5,
          borderWidth: 1.2,
          borderBottomWidth: 0,
          borderColor: stroke,
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
        }}
      />
      <View style={{ width: 9, height: 6.5, borderRadius: 1.5, backgroundColor: stroke }} />
    </View>
  );
}

/** Success / warning / failure bloom — screens 05, 10, 11. */
export function Bloom({
  tone,
  children,
}: {
  tone: 'success' | 'warning' | 'error';
  children: React.ReactNode;
}) {
  const palette = {
    success: { bg: 'rgba(143,168,118,0.12)', border: 'rgba(143,168,118,0.34)', fg: color.success },
    warning: { bg: 'rgba(201,138,75,0.12)', border: 'rgba(201,138,75,0.34)', fg: color.warning },
    error: { bg: 'rgba(181,105,90,0.12)', border: 'rgba(181,105,90,0.34)', fg: color.error },
  }[tone];

  return (
    <View
      style={{
        width: 78,
        height: 78,
        borderRadius: 39,
        backgroundColor: palette.bg,
        borderWidth: 1,
        borderColor: palette.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
}

export function Wordmark({ size = 15 }: { size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <Mark size={size + 2} />
      <Text style={[type.title, { fontSize: size }]}>corridor</Text>
    </View>
  );
}
