import type { TextStyle } from 'react-native';

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
 *
 * NOTE ON WEIGHTS — React Native does not synthesise weight for custom fonts.
 * `fontWeight: '600'` against a bundled family is silently ignored; the weight has
 * to come from the family name itself. Every style below therefore names an exact
 * face, and `face` is exported so inline emphasis elsewhere can do the same.
 */

/** Bundled faces, loaded in `app/_layout.tsx`. */
export const face = {
  /** headlines, amounts, wordmark */
  display: 'BricolageGrotesque_600SemiBold',
  /** the positioning line — set italic, which Bricolage has no true cut for */
  displayRegular: 'BricolageGrotesque_400Regular',

  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',

  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

/** Applied to every numeric value that shares a column with another number. */
export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

export const type = {
  /** amount entry, receipt hero */
  displayXL: {
    fontFamily: face.display,
    fontSize: 46,
    letterSpacing: -1.4,
    lineHeight: 52,
    color: color.paper,
  },
  displayL: {
    fontFamily: face.display,
    fontSize: 34,
    letterSpacing: -0.9,
    lineHeight: 40,
    color: color.paper,
  },
  /** screen headlines */
  display: {
    fontFamily: face.display,
    fontSize: 26,
    letterSpacing: -0.5,
    lineHeight: 31,
    color: color.paper,
  },
  title: {
    fontFamily: face.display,
    fontSize: 20,
    letterSpacing: -0.3,
    lineHeight: 26,
    color: color.paper,
  },
  body: {
    fontFamily: face.regular,
    fontSize: 14,
    lineHeight: 22,
    color: color.mist,
  },
  bodyStrong: {
    fontFamily: face.medium,
    fontSize: 14,
    lineHeight: 20,
    color: color.paper,
  },
  label: {
    fontFamily: face.regular,
    fontSize: 12.5,
    lineHeight: 17,
    color: color.mist,
  },
  /** section eyebrows — uppercase, tracked out */
  micro: {
    fontFamily: face.medium,
    fontSize: 10.5,
    letterSpacing: 1.05,
    textTransform: 'uppercase',
    color: color.mist,
  },
  /** hashes, addresses, IBANs, reference numbers, lock countdowns */
  mono: {
    fontFamily: face.mono,
    fontSize: 12,
    color: color.goldBright,
  },
} as const satisfies Record<string, TextStyle>;

/** Inline emphasis inside a run of body text — pairs with `type.body`/`type.label`. */
export const strong: TextStyle = { fontFamily: face.medium, color: color.paper };
export const strongest: TextStyle = { fontFamily: face.semibold, color: color.paper };
