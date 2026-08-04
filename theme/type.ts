import { Platform, type TextStyle } from 'react-native';

import { color } from './tokens';

/**
 * Type scale.
 *
 * Phase 2 resolved the one ambiguity the identity spec left open: the spec says
 * "display — headlines, amounts, wordmark", but its own applied preview set the
 * amount in Inter with tabular figures. The resolution, and the rule enforced here:
 *
 *   Bricolage for *display moments*  — amount entry, receipt hero, screen titles
 *   Inter + tabular-nums             — wherever numbers stack and must align
 *   Mono                             — machine-produced values only
 *
 * A fee breakdown has to align on the decimal, so it is never display type.
 */

/**
 * Fonts are declared here but not bundled — the app renders with system faces
 * until `expo-font` loads the real ones. Kept as a named constant so the swap is
 * one edit rather than a search across every stylesheet.
 */
const DISPLAY = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });
const UI = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

/** Applied to every numeric value that shares a column with another number. */
export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

export const type = {
  /** amount entry, receipt hero */
  displayXL: {
    fontFamily: DISPLAY,
    fontSize: 46,
    fontWeight: '600',
    letterSpacing: -1.4,
    lineHeight: 48,
    color: color.paper,
  },
  displayL: {
    fontFamily: DISPLAY,
    fontSize: 34,
    fontWeight: '600',
    letterSpacing: -0.9,
    lineHeight: 36,
    color: color.paper,
  },
  /** screen headlines */
  display: {
    fontFamily: DISPLAY,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.5,
    lineHeight: 30,
    color: color.paper,
  },
  title: {
    fontFamily: DISPLAY,
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 25,
    color: color.paper,
  },
  body: {
    fontFamily: UI,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 22,
    color: color.mist,
  },
  bodyStrong: {
    fontFamily: UI,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: color.paper,
  },
  label: {
    fontFamily: UI,
    fontSize: 12.5,
    fontWeight: '400',
    lineHeight: 17,
    color: color.mist,
  },
  /** section eyebrows — uppercase, tracked out */
  micro: {
    fontFamily: UI,
    fontSize: 10.5,
    fontWeight: '500',
    letterSpacing: 1.05,
    textTransform: 'uppercase',
    color: color.mist,
  },
  /** hashes, addresses, IBANs, reference numbers, lock countdowns */
  mono: {
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: '400',
    color: color.goldBright,
  },
} as const satisfies Record<string, TextStyle>;
