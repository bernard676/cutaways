import Svg, { Circle } from 'react-native-svg';

import { Brand } from '@/constants/theme';

export function Logomark({ size = 26 }: { size?: number }) {
  const r = size / 2;
  const dotR = size * 0.19;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle
        cx={r}
        cy={r}
        r={r - 1.5}
        stroke={Brand[500]}
        strokeWidth={1.5}
        strokeDasharray="3 3"
        fill="none"
      />
      <Circle cx={r} cy={r} r={dotR} fill={Brand[500]} />
    </Svg>
  );
}
