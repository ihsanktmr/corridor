import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, Text, View, type ViewStyle } from 'react-native';

import { format, formatBare, type Money } from '../domain/money';
import { color, motion, radius, space } from '../theme/tokens';
import { face, tabular, type } from '../theme/type';
import { Mark } from './Mark';

// ─────────────────────────────────────────────────────────────────────────────
// Surfaces
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Depth is surface luminance plus a hairline border. Never a shadow — the identity
 * spec is explicit about this and dark UI with drop shadows reads as cheap.
 */
export function Card({
  children,
  tight = false,
  style,
}: {
  children: React.ReactNode;
  tight?: boolean;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: color.concrete,
          borderWidth: 1,
          borderColor: color.line,
          borderRadius: tight ? radius.md : radius.lg,
          padding: tight ? space.base : space.lg,
        },
        style ?? null,
      ]}
    >
      {children}
    </View>
  );
}

export function Row({
  children,
  style,
  top = false,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  top?: boolean;
}) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: top ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          gap: space.md,
        },
        style ?? null,
      ]}
    >
      {children}
    </View>
  );
}

/** The mark, doubling as the divider between two currencies — phase 1's own pattern. */
export function MarkDivider() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.base }}>
      <View style={{ flex: 1, height: 1, backgroundColor: color.line }} />
      <Mark size={17} />
      <View style={{ flex: 1, height: 1, backgroundColor: color.line }} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Status
// ─────────────────────────────────────────────────────────────────────────────

export type PillTone = 'done' | 'live' | 'wait' | 'fail';

const PILL_COLOR: Record<PillTone, string> = {
  done: color.success,
  live: color.goldBright,
  wait: color.mist,
  fail: color.error,
};

const PILL_BG: Record<PillTone, string> = {
  done: 'rgba(143,168,118,0.11)',
  live: 'rgba(224,188,124,0.11)',
  wait: 'rgba(163,156,142,0.10)',
  fail: 'rgba(181,105,90,0.11)',
};

/**
 * Semantic colours only, never gold.
 *
 * Gold means brand and action. A status that borrowed it would compete with the
 * primary CTA, and the gold budget is one element per viewport.
 */
export function Pill({ tone, label }: { tone: PillTone; label: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        backgroundColor: PILL_BG[tone],
        borderRadius: radius.pill,
        paddingHorizontal: 9,
        paddingVertical: 4,
      }}
    >
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: PILL_COLOR[tone] }} />
      <Text style={{ fontSize: 10.5, fontFamily: face.semibold, color: PILL_COLOR[tone] }}>{label}</Text>
    </View>
  );
}

/** Mono for anything a machine produced — hashes, addresses, references. */
export function Chip({
  value,
  muted = false,
  onPress,
}: {
  value: string;
  muted?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        alignSelf: 'flex-start',
        backgroundColor: color.concreteRaised,
        borderWidth: 1,
        borderColor: color.line,
        borderRadius: radius.pill,
        paddingHorizontal: 13,
        paddingVertical: 7,
      }}
    >
      <Text style={[type.mono, muted ? { color: color.mist } : null]}>{value}</Text>
    </Pressable>
  );
}

/**
 * The simulated-leg notice.
 *
 * Warning-toned, never error-toned: nothing is broken, something is simulated. The
 * text comes from the provider registry, so a screen cannot claim a leg is real
 * while a fixture is bound.
 */
export function Disclose({ text }: { text: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: space.sm,
        backgroundColor: 'rgba(201,138,75,0.07)',
        borderWidth: 1,
        borderColor: 'rgba(201,138,75,0.26)',
        borderRadius: radius.sm,
        padding: 11,
      }}
    >
      <View
        style={{
          width: 13,
          height: 13,
          borderRadius: 7,
          borderWidth: 1.4,
          borderColor: color.warning,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}
      >
        <Text style={{ fontSize: 9, fontFamily: face.semibold, color: color.warning, lineHeight: 11 }}>!</Text>
      </View>
      <Text style={{ flex: 1, fontSize: 11, lineHeight: 16, color: color.warning }}>{text}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Money display
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bricolage for display moments, Inter + tabular for anything that stacks.
 * `hero` is the amount-entry and receipt figure; `sub` is the paired counterpart.
 */
export function Amount({
  value,
  size = 'hero',
  showCurrency = true,
  caret = false,
}: {
  value: Money;
  size?: 'hero' | 'sub' | 'row';
  showCurrency?: boolean;
  caret?: boolean;
}) {
  if (size === 'row') {
    return <Text style={[type.bodyStrong, tabular, { fontFamily: face.semibold }]}>{format(value)}</Text>;
  }

  const style = size === 'hero' ? type.displayXL : type.displayL;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
      <Text style={style}>
        {value.currency === 'USDC' ? formatBare(value, { decimals: 2 }) : format(value)}
      </Text>
      {caret ? <Caret /> : null}
      {showCurrency ? (
        <Text style={[type.label, { fontSize: size === 'hero' ? 15 : 14, fontFamily: face.medium }]}>
          {value.currency}
        </Text>
      ) : null}
    </View>
  );
}

function Caret() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 520, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 520, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={{ width: 2, height: 40, backgroundColor: color.gold, opacity }} />;
}

/** A single line in a fee breakdown. Value right, tabular, aligned on the decimal. */
export function FeeLineRow({
  label,
  value,
  total = false,
}: {
  label: string;
  value: string;
  total?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        paddingVertical: 7,
        ...(total
          ? { borderTopWidth: 1, borderTopColor: color.line, marginTop: 6, paddingTop: 11 }
          : {}),
      }}
    >
      <Text style={[type.label, total ? { color: color.paper, fontSize: 14, fontFamily: face.medium } : null]}>
        {label}
      </Text>
      <Text
        style={[
          type.label,
          tabular,
          { color: color.paper },
          total ? { fontSize: 14, fontFamily: face.semibold } : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Corridor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Two-letter mono tokens rather than flag emoji — flags render inconsistently
 * across platforms and carry political weight a payment rail should not.
 */
export function CountryToken({ code, active = true }: { code: string; active?: boolean }) {
  return (
    <View
      style={{
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: color.concreteRaised,
        borderWidth: 1,
        borderColor: active ? color.gold : color.line,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={[type.mono, { fontSize: 9.5, color: active ? color.gold : color.mist }]}>{code}</Text>
    </View>
  );
}

/** The gold dot travelling the route — the identity's motion signature. */
export function CorridorStrip({ right }: { right?: React.ReactNode }) {
  const travel = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(travel, {
          toValue: 1,
          duration: 1700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(travel, {
          toValue: 0,
          duration: 1700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [travel]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        backgroundColor: color.concrete,
        borderWidth: 1,
        borderColor: color.line,
        borderRadius: radius.md,
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      <CountryToken code="US" />
      <View style={{ flex: 1, height: 1, backgroundColor: color.line, justifyContent: 'center' }}>
        <Animated.View
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: color.goldBright,
            marginTop: -3,
            transform: [
              {
                translateX: travel.interpolate({ inputRange: [0, 1], outputRange: [0, 90] }),
              },
            ],
          }}
        />
      </View>
      <CountryToken code="TR" />
      {right}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Lists
// ─────────────────────────────────────────────────────────────────────────────

export function ListRow({
  lead,
  title,
  subtitle,
  value,
  meta,
  last = false,
}: {
  lead?: string;
  title: string;
  subtitle?: string;
  value?: string;
  meta?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: 14,
        ...(last ? {} : { borderBottomWidth: 1, borderBottomColor: color.line }),
      }}
    >
      {lead ? (
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: color.concreteRaised,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 11.5, fontFamily: face.semibold, color: color.gold }}>{lead}</Text>
        </View>
      ) : null}

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[type.bodyStrong, { marginBottom: 2 }]}>{title}</Text>
        {subtitle ? <Text style={[type.label, { fontSize: 11.5 }]}>{subtitle}</Text> : null}
      </View>

      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        {value ? <Text style={[type.bodyStrong, tabular, { fontFamily: face.semibold }]}>{value}</Text> : null}
        {meta}
      </View>
    </View>
  );
}

/** Selection is a gold border *and* a raised surface — two signals, not one. */
export function Option({
  selected,
  title,
  subtitle,
  trailing,
  onPress,
}: {
  selected: boolean;
  title: React.ReactNode;
  subtitle?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space.md,
        padding: 15,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: selected ? color.gold : color.line,
        backgroundColor: selected ? color.concreteRaised : color.concrete,
      }}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          borderWidth: 1.5,
          borderColor: selected ? color.gold : color.line,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}
      >
        {selected ? (
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color.gold }} />
        ) : null}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        {typeof title === 'string' ? (
          <Text style={[type.bodyStrong, { marginBottom: 3 }]}>{title}</Text>
        ) : (
          title
        )}
        {subtitle ? <Text style={[type.label, { fontSize: 11.5 }]}>{subtitle}</Text> : null}
      </View>

      {trailing}
    </Pressable>
  );
}

export { motion };
