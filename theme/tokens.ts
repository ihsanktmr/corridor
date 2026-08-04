/**
 * Design tokens — ported verbatim from phase 1 (`corridor-identity.html`).
 *
 * Values are not to be edited here. If a token needs to change, it changes in the
 * identity spec first and is ported down. That direction is the whole point of
 * having a locked identity phase.
 */

export const color = {
  /** page background */
  void: '#14120F',
  /** cards, raised surfaces */
  concrete: '#1E1B16',
  /** modals, sheets, chips */
  concreteRaised: '#28241D',
  /** hairline borders, dividers */
  line: '#332E24',

  /** primary text — warm off-white, never pure white */
  paper: '#F6F3EC',
  /** secondary / muted text */
  mist: '#A39C8E',

  /** the one brand color — mark, primary CTA, route lines */
  gold: '#C9A35C',
  /** hover / active / verifiable-artifact states */
  goldBright: '#E0BC7C',

  /** confirmed, verified, funds arrived */
  success: '#8FA876',
  /** rate movement, review needed, simulated legs */
  warning: '#C98A4B',
  /** failed, blocked, rejected */
  error: '#B5695A',
} as const;

/** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 24,
  pill: 999,
} as const;

export const font = {
  display: 'BricolageGrotesque',
  ui: 'Inter',
  mono: 'IBMPlexMono',
} as const;

/**
 * No drop shadows on dark. Depth comes from surface luminance plus a hairline
 * border — see the elevation block in the identity spec. This helper exists so
 * that "elevate a surface" is a single call and can never become a shadow.
 */
export const elevation = {
  flat: { backgroundColor: color.void },
  raised: { backgroundColor: color.concrete, borderWidth: 1, borderColor: color.line },
  overlay: { backgroundColor: color.concreteRaised, borderWidth: 1, borderColor: color.line },
} as const;

export const motion = {
  /** everywhere except the signature */
  quick: 140,
  standard: 200,
  screen: 250,
  /** the gold dot travelling a completed route segment — the one long one */
  signature: 640,
  pulse: 1800,
} as const;

/** Minimum touch target, per Apple HIG. Enforced by the Button primitive. */
export const HIT_SLOP_MIN = 44;
