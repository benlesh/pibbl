import {
  useConst,
  Flex,
  Rectangle,
  Text,
  useCanvasContext,
  useReaction,
  type PibblNode,
  signal,
  useLayoutBox,
  type BoxStyle,
  type FlexItemStyle,
} from "@pibbl/core";

function createWasmYogaMigrationExampleContent(canvas: HTMLCanvasElement) {
  let node: PibblNode;
  // Recorded Yoga 3.2.1 geometry; generated/checked by tooling/layout-yoga-rehearsal.mjs.
  // BEGIN YOGA REFERENCE
  const fixtureCases = [
  {
    "name": "grow",
    "width": 300,
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 144,
        "height": 80
      },
      {
        "x": 156,
        "y": 0,
        "width": 144,
        "height": 80
      }
    ]
  },
  {
    "name": "cap",
    "width": 300,
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 80,
        "height": 80
      },
      {
        "x": 92,
        "y": 0,
        "width": 208,
        "height": 80
      }
    ]
  },
  {
    "name": "shrink",
    "width": 220,
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 120,
        "height": 80
      },
      {
        "x": 132,
        "y": 0,
        "width": 88,
        "height": 80
      }
    ]
  },
  {
    "name": "rectangle-shrink",
    "width": 100,
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 50,
        "height": 80
      },
      {
        "x": 50,
        "y": 0,
        "width": 50,
        "height": 80
      }
    ]
  },
  {
    "name": "rectangle-percent-content-box",
    "width": 200,
    "boxes": [
      {
        "x": 0,
        "y": 0,
        "width": 110,
        "height": 100
      },
      {
        "x": 110,
        "y": 0,
        "width": 90,
        "height": 100
      }
    ]
  }
] as const;
  // END YOGA REFERENCE
  const index = signal(0);
  const ink = signal("#19375b");
  const selected = signal("none");
  const actual = new Map<string, number>();
  function Panel({
    name,
    style: _specifiedStyle,
  }: {
    name: string;
    style: BoxStyle & FlexItemStyle;
  }) {
    const box = useLayoutBox();
    actual.set(name, box.width);
    return (
      <>
        <Rectangle
          style={{
            width: box.width,
            height: box.height,
            fill: name === "A" ? "#d6e3db" : "#e1dbca",
            cursor: "pointer",
          }}
          onClick={() => selected.set(name)}
        />
        <Text
          pointerEvents="none"
          style={{ left: 12, top: 14, font: "bold 14px monospace", fill: ink }}
        >
          {name}
        </Text>
        <Text
          pointerEvents="none"
          style={{ left: 12, top: 38, font: "12px monospace", fill: ink }}
        >{`${box.width} px`}</Text>
      </>
    );
  }
  function Workspace() {
    const fixture = fixtureCases[index.get()];
    const shrinking = fixture.name === "shrink";
    const rectangles = fixture.name.startsWith("rectangle-");
    const padded = fixture.name === "rectangle-percent-content-box";
    return (
      <>
        <Text
          style={{
            left: 28,
            top: 194,
            font: "bold 16px sans-serif",
            fill: "#19375b",
          }}
        >
          Before · Yoga 3.2.1 reference
        </Text>
        <Text
          style={{
            left: 392,
            top: 194,
            font: "bold 16px sans-serif",
            fill: "#19375b",
          }}
        >
          After · public Pibbl
        </Text>
        {fixture.boxes.map((box, i) => (
          <>
            <Rectangle
              style={{
                left: 28 + box.x,
                top: 240 + box.y,
                width: box.width,
                height: box.height,
                fill: i === 0 ? "#d6e3db" : "#e1dbca",
              }}
            />
            <Text
              pointerEvents="none"
              style={{
                left: 40 + box.x,
                top: 254 + box.y,
                font: "bold 14px monospace",
                fill: "#19375b",
              }}
            >
              {i === 0 ? "A" : "B"}
            </Text>
            <Text
              pointerEvents="none"
              style={{
                left: 40 + box.x,
                top: 278 + box.y,
                font: "12px monospace",
                fill: "#19375b",
              }}
            >{`${box.width} px`}</Text>
          </>
        ))}
        <Flex
          style={{
            left: 392,
            top: 240,
            width: fixture.width,
            height: 100,
            flexDirection: "row",
            alignItems: "flex-start",
            gap: rectangles ? 0 : 12,
          }}
        >
          {rectangles ? <>
            <Rectangle onClick={() => selected.set("A")} style={{
              width: 80, height: 80, flexBasis: padded ? "70%" : "auto", flexShrink: 1,
              minWidth: padded ? 90 : undefined, padding: padded ? 10 : 0,
              fill: "#d6e3db", cursor: "pointer",
            }} />
            <Rectangle onClick={() => selected.set("B")} style={{
              width: 80, height: 80, flexBasis: padded ? "70%" : "auto", flexShrink: 1,
              padding: padded ? 10 : 0, fill: "#e1dbca", cursor: "pointer",
            }} />
          </> : <>
          <Panel
            name="A"
            style={{
              flexBasis: shrinking ? 180 : 60,
              flexGrow: shrinking ? 0 : 1,
              flexShrink: 1,
              minWidth: shrinking ? 120 : 0,
              maxWidth: fixture.name === "cap" ? 80 : undefined,
              height: 80,
            }}
          />
          <Panel
            name="B"
            style={{
              flexBasis: shrinking ? 180 : 60,
              flexGrow: shrinking ? 0 : 1,
              flexShrink: 1,
              minWidth: 0,
              height: 80,
            }}
          />
          </>}
        </Flex>
        <Text
          style={{
            left: 28,
            top: 354,
            font: "14px monospace",
            fill: "#19375b",
          }}
        >{`${fixture.name} · parent ${fixture.width} px · gap ${rectangles ? 0 : 12} px`}</Text>
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
        Yoga → Pibbl · bounded rehearsal
      </Text>
      <Text
        style={{ left: 28, top: 62, font: "14px sans-serif", fill: "#475569" }}
      >
        Five pinned cases. Left is recorded geometry, not a live Yoga runtime.
      </Text>
      <Text
        style={{ left: 28, top: 100, font: "13px sans-serif", fill: "#475569" }}
      >
        Explicit row and shrink 1; empty boxes and one content-box padding conversion.
      </Text>
      <Rectangle
        style={{
          left: 28,
          top: 140,
          width: 220,
          height: 36,
          fill: "#19375b",
          cursor: "pointer",
        }}
        onClick={() =>
          index.update((value) => (value + 1) % fixtureCases.length)
        }
      />
      <Text
        pointerEvents="none"
        style={{ left: 40, top: 150, font: "14px sans-serif", fill: "#ffffff" }}
      >
        Next case + resize
      </Text>
      <Rectangle
        style={{
          left: 264,
          top: 140,
          width: 180,
          height: 36,
          fill: "#6e3e79",
          cursor: "pointer",
        }}
        onClick={() =>
          ink.update((value) => (value === "#19375b" ? "#a63758" : "#19375b"))
        }
      />
      <Text
        pointerEvents="none"
        style={{
          left: 276,
          top: 150,
          font: "14px sans-serif",
          fill: "#ffffff",
        }}
      >
        Paint only
      </Text>
      <Workspace />
      <Text
        style={{
          left: 28,
          top: 402,
          width: 700,
          wrap: true,
          font: "13px sans-serif",
          fill: "#475569",
        }}
      >
        Experimental nowrap subset only. One explicit padding conversion does not establish general CSS/Yoga parity or font migration.
      </Text>
    </>
  );
  const read = (
    globalThis as typeof globalThis & {
      __PIBBL_LAYOUT_DIAGNOSTICS__?: () => Record<string, number>;
    }
  ).__PIBBL_LAYOUT_DIAGNOSTICS__;
  const panel = document.createElement("pre");
  panel.style.cssText =
    "font:12px monospace;white-space:pre-wrap;color:#19375b;padding:12px;background:#e7e5df";
  canvas.insertAdjacentElement("afterend", panel);
  const refresh = () => {
    panel.textContent = `${
      read
        ? "EXPERIMENTAL WASM · " +
          Object.entries(read())
            .map(([key, value]) => `${key}: ${value}`)
            .join(" · ")
        : "Normal JS build"
    }\nYoga 3.2.1 · 042f5013152e · ${fixtureCases[index.get()].name} · actual A: ${fixtureCases[index.get()].name.startsWith("rectangle-") ? "direct Canvas boxes" : `${actual.get("A")} px · B: ${actual.get("B")} px`} · selected: ${selected.get()}`;
  };
  refresh();
  const timer = window.setInterval(refresh, 200);
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

export function WasmYogaMigrationExample() {
  const canvas = useCanvasContext().canvas as HTMLCanvasElement;
  const resource = useConst(() =>
    createWasmYogaMigrationExampleContent(canvas),
  );
  useReaction(() => resource.dispose, []);
  return resource.node;
}
