import Svg, { Circle, Line } from 'react-native-svg';

import { color } from '../theme/tokens';

/**
 * The Corridor mark — a one-point-perspective passage: near wall, far wall, and a
 * single sightline joining them.
 *
 * Geometry is lifted verbatim from the phase 1 identity spec's 100×100 viewBox.
 * An earlier version drew this with rotated Views and got it wrong: a View rotates
 * about its own centre, so the sightline's endpoints landed nowhere near the two
 * walls. The mark is the brand — it gets real vectors.
 */
export function Mark({ size = 20, dot = false }: { size?: number; dot?: boolean }) {
  /**
   * Stroke weight is specified in *rendered pixels*, then converted into the
   * 100-unit viewBox — so the mark carries the same optical weight at 17px in a
   * divider as it does at 60px on the welcome screen.
   *
   * The identity spec draws it at 72px with a 4-unit wall, i.e. ~2.9 rendered
   * pixels; that is the target held constant here. An earlier version picked
   * stroke by size bracket and got thinner as the mark grew, which is backwards.
   */
  const px = (target: number, min: number, max: number) =>
    Math.min(max, Math.max(min, (target * 100) / size));

  const wall = px(2.6, 4, 12);
  const sight = px(1.7, 2.5, 8);

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* near wall */}
      <Line x1={30} y1={20} x2={30} y2={80} stroke={color.gold} strokeWidth={wall} strokeLinecap="round" />
      {/* far wall */}
      <Line x1={66} y1={32} x2={66} y2={68} stroke={color.gold} strokeWidth={wall} strokeLinecap="round" />
      {/* the sightline */}
      <Line
        x1={30}
        y1={80}
        x2={66}
        y2={32}
        stroke={color.goldBright}
        strokeWidth={sight}
        strokeLinecap="round"
      />
      {dot ? <Circle cx={66} cy={32} r={3.5} fill={color.goldBright} /> : null}
    </Svg>
  );
}
