import { ActivityIndicator, Pressable, Text, View, type ViewStyle } from 'react-native';

import { color, radius, space } from '../theme/tokens';
import { type } from '../theme/type';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

/**
 * One primary per screen, always gold.
 *
 * `ghost` is reserved for exits — "Not now", "Cancel". It is never used for an
 * action that costs money, which is a rule the phase 2 component library states and
 * this variant list enforces by not offering a fifth option.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: Props) {
  const inert = disabled || loading;

  const surface: Record<Variant, ViewStyle> = {
    primary: { backgroundColor: inert ? color.concreteRaised : color.gold },
    secondary: { borderWidth: 1, borderColor: color.line },
    ghost: {},
    danger: { borderWidth: 1, borderColor: 'rgba(181,105,90,0.4)' },
  };

  const label_: Record<Variant, string> = {
    primary: inert ? color.mist : color.void,
    secondary: color.paper,
    ghost: color.mist,
    danger: color.error,
  };

  return (
    <Pressable
      onPress={inert ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy: loading }}
      style={({ pressed }) => [
        {
          // 48 tall clears the 44pt HIG floor with room for the label.
          minHeight: 48,
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: space.sm,
          paddingHorizontal: space.base,
          opacity: pressed ? 0.82 : 1,
        },
        variant === 'ghost' ? { minHeight: 42 } : null,
        surface[variant],
        style ?? null,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' ? color.void : color.gold} />
      ) : (
        <Text
          style={[
            type.bodyStrong,
            { fontSize: 15, fontWeight: variant === 'ghost' ? '500' : '600', color: label_[variant] },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** The dock at the bottom of a screen — sits above the home indicator. */
export function Dock({ children, bordered = false }: { children: React.ReactNode; bordered?: boolean }) {
  return (
    <View
      style={{
        paddingHorizontal: space.lg,
        paddingTop: bordered ? space.base : space.md,
        paddingBottom: space.xs,
        gap: space.xs,
        ...(bordered ? { borderTopWidth: 1, borderTopColor: color.line } : {}),
      }}
    >
      {children}
    </View>
  );
}
