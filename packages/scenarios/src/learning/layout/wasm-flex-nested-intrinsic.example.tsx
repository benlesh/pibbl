import {
  useConst,
  defineLayoutComponent,
  definePrimitive,
  Flex,
  Rectangle,
  Text,
  useReaction,
  type PibblNode,
  type PibblNodeInput,
  signal,
  useLayoutBox,
  useCanvasContext,
  type BoxStyle,
  type FlexItemStyle,
  type SystemStyle,
} from "@pibbl/core";

function createWasmFlexNestedIntrinsicExampleContent(
  canvas: HTMLCanvasElement,
) {
  let node: PibblNode;
  const width = signal(420);
  const structuralCard = signal(false);
  const percentageCap = signal(false);
  const measuredBadge = signal(false);
  const badgeMinimum = signal(60);
  const nestedMeasurement = signal(false);
  const nestedWidth = signal(80);
  let descriptions = 0, paragraphDescriptions = 0;
  const longText =
    "Nested columns settle their widths before Text determines their heights. The following sibling uses the complete Card height.";
  const keys = signal(["main", "note"]);
  const paragraph = signal(longText),
    ink = signal("#19375b");
  let rootTransform = new DOMMatrix();
  let cardBottom = 0,
    probeRenders = 0,
    footerHits = 0,
    badgeHits = 0,
    badgeCalls = 0,
    badgeStamps = 0;
  let badgeTarget = "none";
  let footerBox = { x: 0, y: 0, width: 0, height: 0 };
  let badgeBox = { x: 0, y: 0, width: 0, height: 0, stamp: 0 };
  let badgeFollowerBox = { x: 0, y: 0, width: 0, height: 0, stamp: 0 };
  function Boundary({ style: _style }: { style: BoxStyle & FlexItemStyle }) {
    const transform = rootTransform
      .inverse()
      .multiply(useCanvasContext().getTransform());
    cardBottom = +transform.f.toFixed(3) + 12; // Card's final bottom padding.
    probeRenders++;
    return null;
  }
  // An ordinary descriptor helper, called by Workspace in normal rendering.
  // The engine measures only its returned built-ins; it never invokes this helper.
  function paragraphColumn() {
    return (
      <Flex
        style={{
          flexDirection: "column",
          maxWidth: percentageCap.get() ? "50%" : 300,
          padding: 8,
          gap: 6,
          minHeight: 0,
          flexShrink: 0,
        }}
      >
        {keys.get().map((key) =>
          key === "main" ? (
            <Text
              key={key}
              style={{
                wrap: true,
                font: "14px sans-serif",
                lineHeight: 20,
                fill: ink,
                minHeight: 0,
                flexShrink: 0,
              }}
            >
              {paragraph}
            </Text>
          ) : (
            <Text
              key={key}
              style={{
                wrap: true,
                font: "12px sans-serif",
                lineHeight: 16,
                fill: "#475569",
                minHeight: 0,
                flexShrink: 0,
              }}
            >
              Built-in descriptors only.
            </Text>
          ),
        )}
      </Flex>
    );
  }
  function card({ title, body = paragraphColumn() }: { title: string; body?: PibblNodeInput }) {
    return (
      <Flex
        style={{
          flexDirection: "column",
          maxWidth: 360,
          padding: 12,
          gap: 8,
          minHeight: 0,
          flexShrink: 0,
        }}
      >
        <Text
          style={{
            wrap: true,
            font: "bold 16px sans-serif",
            lineHeight: 22,
            fill: ink,
            minHeight: 0,
            flexShrink: 0,
          }}
        >
          {title}
        </Text>
        {body}
        <Boundary
          style={{ width: 0, height: 0, minHeight: 0, flexShrink: 0 }}
        />
      </Flex>
    );
  }
  const ParagraphCard = defineLayoutComponent(() => {
    paragraphDescriptions++;
    return paragraphColumn();
  });
  const Card = defineLayoutComponent(({ title }: { title: string }) => {
    descriptions++;
    return card({ title, body: <ParagraphCard /> });
  });
  function Footer({ style: _style }: { style: BoxStyle & FlexItemStyle }) {
    const box = useLayoutBox(),
      transform = rootTransform
        .inverse()
        .multiply(useCanvasContext().getTransform());
    footerBox = {
      x: +transform.e.toFixed(3),
      y: +transform.f.toFixed(3),
      width: box.width,
      height: box.height,
    };
    return (
      <>
        <Rectangle
          style={{
            width: box.width,
            height: box.height,
            fill: "#426b61",
            cursor: "pointer",
          }}
          onClick={() => {
            footerHits++;
          }}
        />
        <Text
          pointerEvents="none"
          style={{
            left: 12,
            top: 10,
            font: "13px sans-serif",
            fill: "#ffffff",
          }}
        >
          Following sibling · click
        </Text>
      </>
    );
  }
  interface BadgeStyle extends SystemStyle {
    readonly width?: number;
    readonly height?: number | "auto";
    readonly minWidth?: number;
    readonly minHeight?: number;
    readonly flexBasis?: number;
    readonly flexGrow?: number;
    readonly flexShrink?: number;
    readonly fill?: string;
  }
  type ResolvedBadgeStyle = BadgeStyle & { readonly width: number; readonly height: number };
  const BadgeLeaf = definePrimitive<
    { readonly minimum: typeof badgeMinimum },
    BadgeStyle,
    BadgeStyle,
    ResolvedBadgeStyle
  >((_props, style) => {
    const box = useLayoutBox();
    const transform = rootTransform.inverse().multiply(useCanvasContext().getTransform());
    const stamp = useConst(() => ++badgeStamps);
    badgeBox = { x: +transform.e.toFixed(3), y: +transform.f.toFixed(3), width: box.width, height: box.height, stamp };
    return <Rectangle
      style={{ width: box.width, height: box.height, fill: style.fill, cursor: "pointer" }}
      onClick={() => { badgeHits++; badgeTarget = "badge"; }}
    />;
  }, {
    preserveSignalProps: ["minimum"],
    resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
    measureIntrinsic: ({ props }) => {
      badgeCalls++;
      return { status: "measured" as const, minContent: { width: props.minimum.get(), height: 20 }, maxContent: { width: 100, height: 20 } };
    },
    measure: ({ props, constraints }) => {
      badgeCalls++;
      return { status: "measured" as const, size: { width: constraints.maxWidth, height: constraints.maxWidth <= 40 ? props.minimum.get() : 20 } };
    },
  });
  const Badge = defineLayoutComponent((props: { readonly minimum: typeof badgeMinimum; readonly style: BadgeStyle }) =>
    <BadgeLeaf key="leaf" minimum={props.minimum} style={props.style} />,
  );
  const BadgeFollower = definePrimitive<{}, BadgeStyle, BadgeStyle, ResolvedBadgeStyle>((_props, style) => {
    const box = useLayoutBox();
    const transform = rootTransform.inverse().multiply(useCanvasContext().getTransform());
    const stamp = useConst(() => ++badgeStamps);
    badgeFollowerBox = { x: +transform.e.toFixed(3), y: +transform.f.toFixed(3), width: box.width, height: box.height, stamp };
    return <Rectangle style={{ width: box.width, height: box.height, fill: style.fill, cursor: "pointer" }} onClick={() => { badgeHits++; badgeTarget = "follower"; }} />;
  }, { resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }) });
  const badgeContent = <Flex style={{ left: 28, top: 148, width: 80, height: 20, alignItems: "flex-start" }}>
    <Badge key="badge" minimum={badgeMinimum} style={{ height: 20, flexShrink: 1, fill: "#426b61" }} />
    <BadgeFollower key="follower" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0, fill: ink }} />
  </Flex>;
  const MeasuredRow = defineLayoutComponent(() => <Flex style={{
    width: nestedWidth.get(), flexDirection: "row", flexWrap: "nowrap", alignItems: "flex-start", minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0,
  }}>
    <BadgeLeaf key="measured" minimum={badgeMinimum} style={{ flexBasis: 100, minWidth: 0, minHeight: 0, height: "auto", flexShrink: 1, fill: "#426b61" }} />
    <Rectangle key="fixed" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0, fill: "#a63758" }} />
  </Flex>);
  const nestedContent = <Flex style={{ left: 28, top: 148, width: nestedWidth, height: 200, flexDirection: "column", alignItems: "flex-start" }}>
    <MeasuredRow key="row" />
    <BadgeFollower key="footer" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0, fill: ink }} />
  </Flex>;
  function Workspace() {
    rootTransform = useCanvasContext().getTransform();
    if (nestedMeasurement.get()) return <>
      {nestedContent}
      <Text pointerEvents="none" style={{ left: 28, top: 320, font: "14px sans-serif", fill: "#475569" }}>
        Toggle width: the inner row measures its green card before placing the following target.
      </Text>
    </>;
    if (measuredBadge.get()) return <>
      {badgeContent}
      <Text pointerEvents="none" style={{ left: 28, top: 188, font: "14px sans-serif", fill: "#475569" }}>
        The green badge's content minimum moves the following target. Raise its minimum below.
      </Text>
    </>;
    return (
      <Flex
        style={{
          left: 28,
          top: 148,
          width,
          height: 280,
          flexDirection: "column",
          gap: 12,
        }}
      >
        {structuralCard.get() ? <Card title="Reusable descriptor Card" /> : card({ title: "Reusable descriptor Card" })}
        <Footer
          style={{ width: 180, height: 36, minHeight: 0, flexShrink: 0 }}
        />
      </Flex>
    );
  }
  function Button({
    x,
    y = 96,
    width: buttonWidth = 180,
    label,
    onClick,
  }: {
    x: number;
    y?: number;
    width?: number;
    label: string;
    onClick(): void;
  }) {
    return (
      <>
        <Rectangle
          style={{
            left: x,
            top: y,
            width: buttonWidth,
            height: 36,
            fill: "#19375b",
            cursor: "pointer",
          }}
          onClick={onClick}
        />
        <Text
          pointerEvents="none"
          style={{
            left: x + 12,
            top: y + 10,
            font: buttonWidth < 180 ? "12px sans-serif" : "14px sans-serif",
            fill: "#ffffff",
          }}
        >
          {label}
        </Text>
      </>
    );
  }
  node = (
    <>
      <Rectangle style={{ width: 760, height: 460, fill: "#f3f0e8" }} />
      <Text
        style={{
          left: 28,
          top: 24,
          font: "bold 24px sans-serif",
          fill: "#19375b",
        }}
      >
        WASM · Nested intrinsic columns
      </Text>
      <Text
        style={{ left: 28, top: 62, font: "14px sans-serif", fill: "#475569" }}
      >
        Known columns and pure components size from their content.
      </Text>
      <Button x={548} y={62} label="50% paragraph cap" onClick={() => percentageCap.update(value => !value)} />
      <Button x={548} y={24} label="Toggle pure Card" onClick={() => structuralCard.update(value => !value)} />
      <Button
        x={28}
        label="Toggle width"
        onClick={() => nestedMeasurement.get() ? nestedWidth.update(value => value === 80 ? 60 : 80) : width.update((value) => (value === 420 ? 220 : 420))}
      />
      <Button
        x={224}
        label="Change Text"
        onClick={() =>
          paragraph.update((value) =>
            value === longText ? "Short nested content." : longText,
          )
        }
      />
      <Button x={612} width={120} label="Measured badge" onClick={() => { nestedMeasurement.set(false); measuredBadge.update(value => !value); }} />
      <Button x={612} y={148} width={120} label="Nested row" onClick={() => nestedMeasurement.update(value => !value)} />
      <Button
        x={420}
        label="Paint only"
        onClick={() =>
          ink.update((value) => (value === "#19375b" ? "#a63758" : "#19375b"))
        }
      />
      <Workspace />
      <Button
        x={28}
        y={412}
        label="Reverse paragraphs"
        onClick={() => keys.update((value) => [...value].reverse())}
      />
      <Button x={420} y={412} label="Raise badge min" onClick={() => badgeMinimum.update(value => value === 60 ? 70 : 60)} />
      <Button
        x={224}
        y={412}
        label="Remove / restore main"
        onClick={() =>
          keys.update((value) =>
            value.includes("main")
              ? value.filter((key) => key !== "main")
              : [...value, "main"],
          )
        }
      />
    </>
  );
  const read = (
    globalThis as typeof globalThis & {
      __PIBBL_LAYOUT_DIAGNOSTICS__?: () => Record<string, number>;
    }
  ).__PIBBL_LAYOUT_DIAGNOSTICS__;
  const panel = document.createElement("pre");
  panel.style.cssText =
    "font:12px monospace;white-space:pre-wrap;color:#19375b;padding:12px;max-height:112px;overflow:auto;width:100%;min-width:0;overflow-wrap:anywhere;background:#e7e5df";
  canvas.insertAdjacentElement("afterend", panel);
  const refresh = () => {
    panel.textContent = JSON.stringify({
      lane: read ? "experimental WASM" : "normal JavaScript",
      width: width.get(),
      structuralCard: structuralCard.get(),
      percentageCap: percentageCap.get(),
      measuredBadge: measuredBadge.get(),
      nestedMeasurement: nestedMeasurement.get(),
      nestedWidth: nestedWidth.get(),
      badgeMinimum: badgeMinimum.get(),
      badgeBox,
      badgeFollowerBox,
      badgeHits,
      badgeTarget,
      badgeCalls,
      descriptions,
      paragraphDescriptions,
      keys: keys.get(),
      cardBottom,
      footerBox,
      footerHits,
      probeRenders,
      layout: read?.() ?? {},
      limits:
        "Known nowrap columns at settled widths only. Nested aggregate paint reuses bounded generic-font measurements. No ordinary component discovery, percentage feedback, font-load invalidation or general intrinsic layout.",
    });
  };
  refresh();
  const timer = window.setInterval(refresh, 100);
  return {
    node,
    ...{
      dispose() {
        window.clearInterval(timer);
        panel.remove();
      },
    },
  };
}

export function WasmFlexNestedIntrinsicExample() {
  if (!(globalThis as typeof globalThis & { __PIBBL_LAYOUT_DIAGNOSTICS__?: unknown }).__PIBBL_LAYOUT_DIAGNOSTICS__) {
    return <Text style={{ left: 28, top: 48, font: '18px sans-serif', fill: '#19375b' }}>Start Studio with --mode layout-wasm to run this experimental intrinsic layout.</Text>;
  }

  const canvas = useCanvasContext().canvas as HTMLCanvasElement;
  const resource = useConst(() =>
    createWasmFlexNestedIntrinsicExampleContent(canvas),
  );
  useReaction(() => resource.dispose, []);
  return resource.node;
}
