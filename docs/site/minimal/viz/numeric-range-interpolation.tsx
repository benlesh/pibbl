import {
  FocusManagement,
  Text,
  easing,
  pibbl,
  signal,
  tween,
  useAnimatedValue,
} from "@pibbl/core";
import {
  interpolateNumericRange,
  type NumericDomain,
} from "@pibbl/core/viz";

const intent = signal<NumericDomain>([18, 42]);

function Readout() {
  const shown = useAnimatedValue(intent, {
    initial: [0, 12],
    animation: tween<NumericDomain>({
      duration: 180,
      easing: easing.easeOut,
      interpolate: interpolateNumericRange,
    }),
    equals: (a, b) => a[0] === b[0] && a[1] === b[1],
  });
  const [start, end] = shown.get();
  return <Text style={{ left: 16, top: 18, font: "13px sans-serif" }}>
    {`Animated range: ${start.toFixed(1)} – ${end.toFixed(1)}`}
  </Text>;
}

export default function mount(canvas: HTMLCanvasElement) {
  return pibbl(canvas, <FocusManagement><Readout /></FocusManagement>);
}
