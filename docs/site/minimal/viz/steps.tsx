import { Group, Text, pibbl } from "@pibbl/core";
import {
  LineSeries,
  LinearScale,
  stepBefore,
  stepAfter,
  stepMidpoint,
  type SeriesCurve,
} from "@pibbl/core/viz";
// Deliberately illustrative geometry: not measured data.
const definitions: readonly SeriesCurve[] = [
  stepBefore(),
  stepMidpoint(),
  stepAfter(),
];
const names = ["Before", "Midpoint", "After"];
const canvas = document.createElement("canvas");
canvas.width = 360;
canvas.height = 240;
document.body.append(canvas);
const app = pibbl(
  canvas,
  <>
    {definitions.map((curve, i) => (
      <Group key={names[i]} style={{ translateX: 70, translateY: 15 + i * 70 }}>
        <Text style={{ left: -65, top: 12, font: "11px sans-serif" }}>
          {names[i]}
        </Text>
        <LinearScale id="x" domain={[0, 1]} range={[0, 260]}>
          <LinearScale id="y" domain={[0, 1]} range={[50, 0]}>
            <LineSeries
              data={[
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ]}
              x="x"
              y="y"
              xScale="x"
              yScale="y"
              curve={curve}
            />
          </LinearScale>
        </LinearScale>
      </Group>
    ))}
    <Text style={{ left: 10, top: 224, font: "10px sans-serif" }}>
      Illustrative endpoints · interpolation is not a measurement
    </Text>
  </>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
