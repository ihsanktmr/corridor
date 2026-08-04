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
  // Stroke weights scale with the mark so it stays optically even at 17px and 60px.
  const wall = size >= 40 ? 4 : 7;
  const sight = size >= 40 ? 2.5 : 4.5;

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
