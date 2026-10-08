import {
  FocusManagement,
  Group,
  Rectangle,
  Text,
  pibbl,
  useSignal,
  type PibblController,
  type PibblLogicalMouseEvent,
} from "@pibbl/core";
import { LinearScale, PointSeries, defineSeries } from "@pibbl/core/viz";
import {
  nearestRecordedPoint,
  paintedPointAt,
  usePointInspection,
  withInspection,
} from "@pibbl/core/viz/inspection";

const marks = defineSeries({
  data: [
    { name: "Order A", x: 4, y: 5 },
    { name: "Order B", x: 5, y: 5 },
  ],
  x: "x",
  y: "y",
});
function Label({
  top,
  children,
  color = "#173a35",
  size = 12,
}: {
  top: number;
  children: string;
  color?: string;
  size?: number;
}) {
  return (
    <Text
      pointerEvents="none"
      style={{ left: 16, top, font: `${size}px sans-serif`, fill: color }}
    >
      {children}
    </Text>
  );
}
function PaintedInspection() {
  const inspection = usePointInspection(marks);
  const nearestLabel = useSignal("Nearest center: pending");
  const paintedLabel = useSignal("Painted top mark: pending");
  const inputLabel = useSignal("Input: click or Enter");
  const inspectAt = (
    context: Parameters<Parameters<typeof withInspection>[0]>[1],
    rootPoint: { x: number; y: number },
    source: "click" | "keyboard",
  ) => {
    const rendered = context.rendered(inspection);
    if (!rendered) return;
    const nearest = context.request(nearestRecordedPoint, rendered, {
      rootPoint,
    });
    const painted = context.request(paintedPointAt, rendered, { rootPoint });
    nearestLabel.set(`Nearest center: ${nearest?.datum.name ?? "none"}`);
    paintedLabel.set(`Painted top mark: ${painted?.datum.name ?? "none"}`);
    inputLabel.set(`Input: ${source}`);
  };
  const inspect = withInspection((event: PibblLogicalMouseEvent, context) =>
    inspectAt(context, { x: event.x, y: event.y }, "click"),
  );
  return (
    <>
      <Label top={20} size={15} color="#cf6b4c">
        PAINTED MARKS ≠ NEAREST DATA
      </Label>
      <Label top={42} size={10} color="#5c726a">
        SIMULATION · ORDER A / ORDER B OVERLAP
      </Label>
      <Group onClick={inspect}>
        <Rectangle
          keyboardFocusable
          onKeyDown={withInspection((event, context) => {
            if (event.key === "Enter")
              inspectAt(context, { x: 110, y: 100 }, "keyboard");
          })}
          style={{
            left: 20,
            top: 60,
            width: 300,
            height: 115,
            fill: "#f9f5ef",
            stroke: "#d9b69c",
          }}
        />
        <PointSeries
          data={marks.data}
          x={marks.x}
          y={marks.y}
          xScale="x"
          yScale="y"
          inspection={inspection}
          pointerEvents="none"
          style={(_, index) => ({
            radius: 32,
            fill: index ? "#cf6b4c" : "#087f8c",
            stroke: "#ffffff",
            strokeWidth: 2,
          })}
        />
        <Text
          pointerEvents="none"
          style={{
            left: 86,
            top: 103,
            font: "bold 12px sans-serif",
            fill: "#ffffff",
          }}
        >
          A
        </Text>
        <Text
          pointerEvents="none"
          style={{
            left: 126,
            top: 103,
            font: "bold 12px sans-serif",
            fill: "#ffffff",
          }}
        >
          B
        </Text>
      </Group>
      <Label top={190} size={11} color="#5c726a">
        Click the overlap or press Enter. A teal · B coral.
      </Label>
      <Label top={214}>{nearestLabel.get()}</Label>
      <Label top={236} color="#5c726a">
        {paintedLabel.get()}
      </Label>
      <Label top={258} size={10} color="#5c726a">
        {inputLabel.get()}
      </Label>
    </>
  );
}
/** Mount the overlap lesson; dispose its controller when the canvas is removed. */
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(
    canvas,
    <FocusManagement>
      <LinearScale id="x" domain={[0, 10]} range={[30, 230]}>
        <LinearScale id="y" domain={[0, 10]} range={[160, 60]}>
          <PaintedInspection />
        </LinearScale>
      </LinearScale>
    </FocusManagement>,
  );
}
