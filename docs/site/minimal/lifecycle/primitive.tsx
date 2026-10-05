import {
  crc,
  definePrimitive,
  useCanvasContext,
  Text,
  type SystemStyle,
  type RenderingContext2D,
  type PrimitiveRender,
  type PrimitiveCapabilities,
  type PrimitiveInput,
  type PrimitiveInputOf,
  type PrimitiveProgramProps,
  type CRCPrimitiveComponent,
  type SpecifiedStyle,
  type NormalizedStyle,
  type ResolvedStyle,
  type StyleResolutionContext,
  type MeasureInput,
  type MeasureResult,
  type CanvasMeasurementService,
} from "@crc/core";

type Props = { label: string };
interface Style extends SystemStyle {
  size?: number;
  color?: string;
}
const render: PrimitiveRender<Props, Style> = (
  props: Readonly<PrimitiveProgramProps<Props>>,
  style: ResolvedStyle<Style>,
  context: RenderingContext2D,
) => {
  context.fillStyle = style.color ?? "#087e8b";
  context.fillRect(20, 20, style.size ?? 140, 70);
  return (
    <Text style={{ left: 30, top: 60, font: "18px sans-serif", fill: "#fff" }}>
      {props.label}
    </Text>
  );
};
const capabilities: PrimitiveCapabilities<Props, Style> = {
  normalizeStyle(style: SpecifiedStyle<Style>): NormalizedStyle<Style> {
    return { ...style, size: Math.max(40, style.size ?? 140) };
  },
  resolveStyle(
    style: NormalizedStyle<Style>,
    context: Readonly<StyleResolutionContext>,
  ): ResolvedStyle<Style> {
    return {
      ...style,
      size: Math.min(style.size ?? 140, context.allocation.width),
    };
  },
  measure({ props, service }: MeasureInput<Props, Style>): MeasureResult {
    const measurement: CanvasMeasurementService = service;
    return {
      status: "measured",
      size: {
        width:
          measurement.measureText(props.label, "18px sans-serif").width + 40,
        height: 110,
      },
    };
  },
};
const Badge: CRCPrimitiveComponent<
  PrimitiveProgramProps<Props>,
  PrimitiveInput<Props, Style>
> = definePrimitive(render, capabilities);
const props: PrimitiveInputOf<typeof Badge> = {
  label: "Custom primitive",
  style: { size: 240 },
};
function Scene() {
  const context = useCanvasContext();
  const width = context.measureText("CRC").width;
  return (
    <>
      <Badge {...props} />
      <Text
        style={{ left: 20, top: 140, font: "14px sans-serif", fill: "#222" }}
      >
        Measured CRC width: {width.toFixed(1)}
      </Text>
    </>
  );
}
const canvas = document.createElement("canvas");
canvas.width = 360;
canvas.height = 180;
document.body.append(canvas);
const controller = crc(canvas, <Scene />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
