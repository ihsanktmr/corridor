import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { color as tokens } from '../theme/tokens';

/**
 * Icons.
 *
 * Drawn, not typed. Every one of these was a text glyph — `‹`, `×`, `◍`, `↑`, `›` —
 * which meant the icon set inherited the system font's weight, optical size and
 * vertical alignment, none of which match a bundled display face. On a screen this
 * restrained that reads as unfinished faster than almost anything else.
 *
 * All share a 24 viewBox, a 2px nominal stroke and round caps, so they sit on the
 * same optical weight as the hairline borders around them.
 */

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

function Icon({
  size = 18,
  children,
}: {
  size?: number;
  children: React.ReactNode;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {children}
    </Svg>
  );
}

export function ChevronLeft({ size = 15, color = tokens.paper, strokeWidth = 2.2 }: IconProps) {
  return (
    <Icon size={size}>
      <Path d="M15 4.5 7.5 12l7.5 7.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  );
}

export function ChevronRight({ size = 15, color = tokens.paper, strokeWidth = 2.2 }: IconProps) {
  return (
    <Icon size={size}>
      <Path d="M9 4.5 16.5 12 9 19.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  );
}

export function Close({ size = 15, color = tokens.paper, strokeWidth = 2.2 }: IconProps) {
  return (
    <Icon size={size}>
      <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Icon>
  );
}

export function Check({ size = 16, color = tokens.paper, strokeWidth = 2.6 }: IconProps) {
  return (
    <Icon size={size}>
      <Path d="M4 12.5l5.2 5.2L20 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  );
}

export function Share({ size = 16, color = tokens.mist, strokeWidth = 1.9 }: IconProps) {
  return (
    <Icon size={size}>
      <Path d="M12 15V4m0 0L8.2 7.8M12 4l3.8 3.8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 13.5v4.7A1.8 1.8 0 0 0 6.8 20h10.4a1.8 1.8 0 0 0 1.8-1.8v-4.7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Icon>
  );
}

export function Account({ size = 16, color = tokens.mist, strokeWidth = 1.8 }: IconProps) {
  return (
    <Icon size={size}>
      <Circle cx="12" cy="8.4" r="3.6" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M5.2 20c0-3.6 3-5.7 6.8-5.7s6.8 2.1 6.8 5.7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Icon>
  );
}

export function ExternalLink({ size = 12, color = tokens.goldBright, strokeWidth = 2 }: IconProps) {
  return (
    <Icon size={size}>
      <Path d="M14 4.5h5.5V10M19.5 4.5 11 13" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M18.5 14.5v4a1.9 1.9 0 0 1-1.9 1.9h-11a1.9 1.9 0 0 1-1.9-1.9v-11A1.9 1.9 0 0 1 5.6 5.6h4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Icon>
  );
}

export function Copy({ size = 12, color = tokens.mist, strokeWidth = 1.9 }: IconProps) {
  return (
    <Icon size={size}>
      <Rect x="8.6" y="8.6" width="11" height="11" rx="2.6" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M15.4 5.4h-8a2 2 0 0 0-2 2v8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Icon>
  );
}

export function Alert({ size = 26, color = tokens.warning, strokeWidth = 2 }: IconProps) {
  return (
    <Icon size={size}>
      <Path d="M12 7.2v6.4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx="12" cy="17" r="1.15" fill={color} />
    </Icon>
  );
}

export function Refresh({ size = 26, color = tokens.warning, strokeWidth = 2 }: IconProps) {
  return (
    <Icon size={size}>
      <Path d="M20 12a8 8 0 1 1-2.6-5.9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M20 3.6V9h-5.4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  );
}

/** The KYC gate's shield — a check inside a guard, not a padlock. Verification, not a wall. */
export function Verified({ size = 30, color = tokens.warning, strokeWidth = 1.9 }: IconProps) {
  return (
    <Icon size={size}>
      <Path d="M12 2.8 20 6v6.1c0 4.7-3.3 8-8 9.1-4.7-1.1-8-4.4-8-9.1V6l8-3.2Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path d="m8.6 11.9 2.4 2.4 4.4-4.7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  );
}

export function Lock({ size = 11, color = tokens.goldBright, strokeWidth = 2 }: IconProps) {
  return (
    <Icon size={size}>
      <Rect x="4.2" y="10.4" width="15.6" height="10.4" rx="2.6" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M8 10.4V7.6a4 4 0 0 1 8 0v2.8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Icon>
  );
}
