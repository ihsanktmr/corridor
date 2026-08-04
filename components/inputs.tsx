import { useRef } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';

import { color, radius, space } from '../theme/tokens';
import { tabular, type } from '../theme/type';

// ─────────────────────────────────────────────────────────────────────────────
// Text field
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Focus is a gold border plus a lift to concrete-raised. No glow, no shadow.
 * Validation resolves inline, under the field, as the user types.
 */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  prefix,
  mono = false,
  hint,
  tone = 'neutral',
  autoCapitalize = 'none',
  keyboardType,
}: {
  // `| undefined` is explicit because `exactOptionalPropertyTypes` is on: callers
  // pass a computed `string | undefined` for `hint` rather than conditionally
  // spreading the prop, and that should typecheck.
  label?: string | undefined;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string | undefined;
  prefix?: string | undefined;
  mono?: boolean | undefined;
  hint?: string | undefined;
  tone?: 'neutral' | 'ok' | 'bad' | undefined;
  autoCapitalize?: 'none' | 'words' | 'characters' | undefined;
  keyboardType?: 'default' | 'email-address' | undefined;
}) {
  const focused = useRef(false);

  const hintColor = tone === 'ok' ? color.success : tone === 'bad' ? color.error : color.mist;

  return (
    <View style={{ marginBottom: space.base }}>
      {label ? <Text style={[type.label, { fontSize: 11.5, marginBottom: 7 }]}>{label}</Text> : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          backgroundColor: color.concrete,
          borderWidth: 1,
          borderColor: tone === 'bad' ? color.error : color.line,
          borderRadius: radius.md,
          paddingHorizontal: 15,
          minHeight: 48,
        }}
      >
        {prefix ? <Text style={[type.label, mono ? type.mono : null, { color: color.mist }]}>{prefix}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={color.mist}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          keyboardType={keyboardType ?? 'default'}
          onFocus={() => {
            focused.current = true;
          }}
          onBlur={() => {
            focused.current = false;
          }}
          selectionColor={color.gold}
          style={[
            { flex: 1, paddingVertical: 13, fontSize: 14.5, color: color.paper },
            mono ? { fontFamily: type.mono.fontFamily, fontSize: 13, letterSpacing: 0.3 } : null,
          ]}
        />
      </View>

      {hint ? (
        <Text style={{ fontSize: 11, marginTop: 7, color: hintColor, lineHeight: 15 }}>{hint}</Text>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Keypad
// ─────────────────────────────────────────────────────────────────────────────

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'] as const;

/**
 * A custom keypad, not the OS keyboard.
 *
 * The receive amount recomputes on every keystroke; a system keyboard would resize
 * the viewport and make the two amounts jump. It also lets us reject a second
 * decimal point at input rather than validating after the fact.
 *
 * Keys run 52 tall — above the 44pt floor, because this is used under time pressure
 * with a rate lock counting down.
 */
export function Keypad({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const press = (key: string) => {
    if (key === '⌫') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === '.') {
      if (value.includes('.')) return;
      onChange(value === '' ? '0.' : `${value}.`);
      return;
    }
    // Two decimal places is all USD carries — reject the third keystroke.
    const [, fraction] = value.split('.');
    if (fraction !== undefined && fraction.length >= 2) return;
    if (value === '0') {
      onChange(key);
      return;
    }
    onChange(value + key);
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {KEYS.map((key) => (
        <Pressable
          key={key}
          onPress={() => press(key)}
          style={({ pressed }) => ({
            width: '33.33%',
            height: 52,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.sm,
            backgroundColor: pressed ? color.concrete : 'transparent',
          })}
        >
          <Text
            style={[
              tabular,
              {
                fontSize: key === '⌫' ? 19 : 23,
                fontWeight: '500',
                color: key === '.' || key === '⌫' ? color.mist : color.paper,
              },
            ]}
          >
            {key}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirm slider
// ─────────────────────────────────────────────────────────────────────────────

const TRACK_INSET = 4;
const KNOB_WIDTH = 64;

/**
 * Slide to send, not tap to send.
 *
 * Deliberate friction proportional to irreversibility. Exactly one of these exists
 * in the app, on screen 08 — if a second ever appears, the first has stopped meaning
 * anything.
 */
export function ConfirmSlider({
  label,
  onConfirm,
  disabled = false,
  style,
}: {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const x = useRef(new Animated.Value(0)).current;
  const width = useRef(0);
  const armed = useRef(false);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderMove: (_, gesture) => {
        const max = Math.max(0, width.current - KNOB_WIDTH - TRACK_INSET * 2);
        const next = Math.min(Math.max(0, gesture.dx), max);
        x.setValue(next);
        armed.current = next >= max * 0.8;
      },
      onPanResponderRelease: () => {
        const max = Math.max(0, width.current - KNOB_WIDTH - TRACK_INSET * 2);
        if (armed.current) {
          Animated.timing(x, { toValue: max, duration: 120, useNativeDriver: false }).start(() => {
            onConfirm();
          });
        } else {
          // Below 80%, snap back. A half-hearted swipe is not a confirmation.
          Animated.spring(x, { toValue: 0, useNativeDriver: false, bounciness: 4 }).start();
        }
      },
    }),
  ).current;

  return (
    <View
      onLayout={(e) => {
        width.current = e.nativeEvent.layout.width;
      }}
      style={[
        {
          height: 56,
          borderRadius: radius.md,
          backgroundColor: color.concreteRaised,
          borderWidth: 1,
          borderColor: color.line,
          justifyContent: 'center',
          overflow: 'hidden',
          opacity: disabled ? 0.5 : 1,
        },
        style ?? null,
      ]}
    >
      <Text style={[type.label, { textAlign: 'center', fontSize: 13.5, fontWeight: '500' }]}>{label}</Text>

      <Animated.View
        {...responder.panHandlers}
        style={{
          position: 'absolute',
          left: TRACK_INSET,
          top: TRACK_INSET,
          bottom: TRACK_INSET,
          width: KNOB_WIDTH,
          borderRadius: 11,
          backgroundColor: color.gold,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ translateX: x }],
        }}
      >
        <Text style={{ fontSize: 17, fontWeight: '700', color: color.void }}>›</Text>
      </Animated.View>
    </View>
  );
}
