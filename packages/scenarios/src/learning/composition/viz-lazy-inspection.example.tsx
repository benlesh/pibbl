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
  nearestRecordedX,
  usePointInspection,
  withInspection,
} from "@pibbl/core/viz/inspection";

const orders = defineSeries({
  data: [
    { time: 0, price: 10 },
    { time: 10, price: 30 },
  ],
  x: "time",
  y: "price",
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
function LazyInspection() {
  const inspection = usePointInspection(orders);
  const selected = useSignal("Selected order: pending");
  const memo = useSignal("Memo: 0 requests");
  const inspectAt = (
    context: Parameters<Parameters<typeof withInspection>[0]>[1],
    rootPoint: { x: number; y: number },
  ) => {
    const rendered = context.rendered(inspection);
    if (!rendered) return;
    let executions = 0;
    const countedNearest: typeof nearestRecordedX = (series, options) => {
      executions++;
      return nearestRecordedX(series, options);
    };
    const options = { domainX: rendered.domainXAtRoot(rootPoint) };
    const hit = context.request(countedNearest, rendered, options);
    const repeated = context.request(countedNearest, rendered, { ...options });
    selected.set(
      hit
        ? `Selected order: time ${hit.datum.time} · price ${hit.datum.price}`
        : "Selected order: none",
    );
    memo.set(
      `Memo: 2 equal requests · ${executions} execution${executions === 1 ? "" : "s"}`,
    );
    void repeated;
  };
  const inspect = withInspection((event: PibblLogicalMouseEvent, context) => {
    inspectAt(context, { x: event.x, y: event.y });
  });
  return (
    <>
      <Label top={20} size={15} color="#087f8c">
        LAZY INSPECTION
      </Label>
      <Label top={42} size={10} color="#5c726a">
        SIMULATION · ORDERS AT TIME 0 / 10
      </Label>
      <Group onClick={inspect}>
        <Rectangle
          keyboardFocusable
          onKeyDown={withInspection((event, context) => {
            if (event.key === "Enter") inspectAt(context, { x: 260, y: 80 });
          })}
          style={{
            left: 20,
            top: 60,
            width: 300,
            height: 115,
            fill: "#edf5f2",
            stroke: "#8fb5a9",
          }}
        />
        <PointSeries
          data={orders.data}
          x={orders.x}
          y={orders.y}
          xScale="time"
          yScale="price"
          inspection={inspection}
          pointerEvents="none"
          style={{
            radius: 8,
            fill: "#087f8c",
            stroke: "#ffffff",
            strokeWidth: 2,
          }}
        />
        <Text
          pointerEvents="none"
          style={{
            left: 44,
            top: 154,
            font: "11px sans-serif",
            fill: "#173a35",
          }}
        >
          A · t0 · $10
        </Text>
        <Text
          pointerEvents="none"
          style={{
            left: 202,
            top: 62,
            font: "11px sans-serif",
            fill: "#173a35",
          }}
        >
          B · t10 · $30
        </Text>
      </Group>
      <Label top={190} size={11} color="#5c726a">
        Click a point. Two equal requests execute once.
      </Label>
      <Label top={214}>{selected.get()}</Label>
      <Label top={236} color="#5c726a">
        {memo.get()}
      </Label>
    </>
  );
}
/** Mount the lazy event-query lesson; dispose the controller on removal. */
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(
    canvas,
    <FocusManagement>
      <LinearScale id="time" domain={[0, 10]} range={[80, 260]}>
        <LinearScale id="price" domain={[0, 40]} range={[160, 80]}>
          <LazyInspection />
        </LinearScale>
      </LinearScale>
    </FocusManagement>,
  );
}
