import {
  batch,
  pibbl,
  degrees,
  DragHandle,
  Flex,
  FocusManagement,
  ManipulationFrame,
  Rectangle,
  ResizeHandles,
  RotationHandle,
  Text,
  useLayoutBox,
  useManipulation,
  useSignal,
  type PibblController,
  type PibblManipulationController,
} from "@pibbl/core";

function CardContent({
  manipulation,
}: {
  manipulation: PibblManipulationController;
}) {
  const { width, height } = useLayoutBox();
  return (
    <>
      <Rectangle
        pointerEvents="none"
        style={{
          width,
          height,
          fill: "#ffffff",
          stroke: "#3262b8",
          strokeWidth: 1,
          cornerRadius: 12,
        }}
      />
      <DragHandle
        controller={manipulation}
        style={{ readout: { active: { visible: true, fill: "#1d4ed8" } } }}
      >
        <Rectangle
          keyboardFocusable
          style={{
            width,
            height: 44,
            cursor: "grab",
            fill: "#dbeafe",
            cornerRadius: 12,
          }}
        />
        <Text
          pointerEvents="none"
          style={{
            left: 16,
            top: 14,
            font: "600 15px sans-serif",
            textBaseline: "top",
            fill: "#17324d",
          }}
        >
          Drag this title bar
        </Text>
      </DragHandle>
      <Flex
        style={{
          left: 16,
          top: 58,
          width: width - 32,
          height: height - 74,
          flexDirection: "column",
          gap: 8,
        }}
      >
        <Text
          pointerEvents="none"
          style={{
            width: "100%",
            height: 42,
            minHeight: 42,
            wrap: true,
            textBaseline: "top",
            font: "14px sans-serif",
            fill: "#334155",
          }}
        >
          This content receives the resized allocation through ordinary Flex
          layout.
        </Text>
        <Rectangle
          pointerEvents="none"
          style={{
            width: "100%",
            height: 12,
            minHeight: 12,
            flexGrow: 1,
            fill: "#e2e8f0",
            cornerRadius: 6,
          }}
        />
        <Text
          pointerEvents="none"
          style={{
            width: "100%",
            height: 22,
            minHeight: 22,
            textBaseline: "top",
            font: "12px monospace",
            fill: "#475569",
          }}
        >
          {Math.round(width)} × {Math.round(height)} local units
        </Text>
      </Flex>
    </>
  );
}
function Scene() {
  const box = useSignal({ left: 96, top: 120, width: 320, height: 224 });
  const commits = useSignal(0);
  const rotation = useSignal(0);
  const alwaysSnap = useSignal(false);
  const when = alwaysSnap.get() ? "always" : "shift";
  const manipulation = useManipulation({
    box,
    rotation,
    move: { snap: { step: 16, when } },
    resize: {
      minWidth: 224,
      minHeight: 176,
      snap: { step: 8, when },
      aspectRatio: { value: "initial", when: "alt" },
    },
    rotate: { snap: { step: degrees(15), when } },
    onCommit: ({ changed }) => {
      if (changed) commits.update((n) => n + 1);
    },
  });
  const geometry = box.get();
  const active = manipulation.active.get();
  return (
    <>
      <Rectangle
        pointerEvents="none"
        style={{ width: 800, height: 560, fill: "#f1f5f9" }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: 24,
          top: 24,
          font: "600 22px sans-serif",
          textBaseline: "top",
          fill: "#0f172a",
        }}
      >
        Move, resize, and rotate a component
      </Text>
      <Text
        pointerEvents="none"
        style={{
          left: 24,
          top: 58,
          font: "14px sans-serif",
          textBaseline: "top",
          fill: "#475569",
        }}
      >
        Drag title · resize corners · rotate top handle · Shift snaps · Alt
        locks ratio · Escape cancels.
      </Text>
      <ManipulationFrame {...manipulation.frameProps}>
        <CardContent manipulation={manipulation} />
        <ResizeHandles
          controller={manipulation}
          positions="corners"
          style={{
            readout: {
              font: "12px sans-serif",
              visible: false,
              active: { visible: true, fill: "#1d4ed8" },
            },
          }}
        />
        <RotationHandle
          controller={manipulation}
          readoutUnit="degrees"
          style={{
            connector: true,
            arc: { color: "#2563eb", sweep: degrees(60), strokeWidth: 2 },
            readout: {
              font: "12px sans-serif",
              visible: false,
              active: { visible: true, fill: "#1d4ed8" },
            },
          }}
        />
      </ManipulationFrame>
      <Rectangle
        onClick={() => alwaysSnap.update((value) => !value)}
        style={{
          left: 568,
          top: 412,
          width: 208,
          height: 34,
          fill: "#dbeafe",
          cornerRadius: 6,
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: 582,
          top: 422,
          font: "14px sans-serif",
          textBaseline: "top",
          fill: "#17324d",
        }}
      >
        Snap: {alwaysSnap.get() ? "always" : "hold Shift"}
      </Text>
      <Rectangle
        onClick={() => {
          manipulation.cancel();
          batch(() => {
            box.set({ left: 96, top: 120, width: 320, height: 224 });
            rotation.set(0);
            commits.set(0);
          });
        }}
        style={{
          left: 568,
          top: 452,
          width: 208,
          height: 34,
          fill: "#dbeafe",
          cornerRadius: 6,
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: 582,
          top: 462,
          font: "14px sans-serif",
          textBaseline: "top",
          fill: "#17324d",
        }}
      >
        Reset geometry
      </Text>
      <Text
        pointerEvents="none"
        style={{
          left: 24,
          top: 480,
          font: "13px monospace",
          textBaseline: "top",
          fill: "#17324d",
        }}
      >
        left {Math.round(geometry.left)} · top {Math.round(geometry.top)} ·
        width {Math.round(geometry.width)} · height{" "}
        {Math.round(geometry.height)}
      </Text>
      <Text
        pointerEvents="none"
        style={{
          left: 24,
          top: 510,
          font: "13px monospace",
          textBaseline: "top",
          fill: "#475569",
        }}
      >
        rotation {Math.round((rotation.get() * 180) / Math.PI)}° ·{" "}
        {active ? active.operation : "idle"} · completed changes {commits}
      </Text>
    </>
  );
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(
    canvas,
    <FocusManagement>
      <Scene />
    </FocusManagement>,
  );
}
