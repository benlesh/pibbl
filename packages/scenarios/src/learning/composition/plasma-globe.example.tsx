/** @jsxImportSource @pibbl/core */
import {
  pibbl,
  Circle,
  Path,
  PathGeometry,
  flattenPath,
  Clip,
  Rectangle,
  Text,
  Group,
  FocusManagement,
  useSignal,
  useConst,
  useReaction,
  type PibblPointerEvent,
  type PibblController,
} from "@pibbl/core";
import {
  useTexture,
  tendrils,
  lightning,
  type ElectricPoint,
  type ElectricSource,
} from "@pibbl/core/textures";

function Label({
  x,
  y,
  children,
  size = 12,
  color = "#aaa2c9",
}: {
  x: number;
  y: number;
  children: string;
  size?: number;
  color?: string;
}) {
  return (
    <Text
      pointerEvents="none"
      style={{
        left: x,
        top: y,
        fill: color,
        font: `${size}px Arial`,
        textBaseline: "alphabetic",
      }}
    >
      {children}
    </Text>
  );
}
function Button({
  x,
  y,
  label,
  onClick,
  active = false,
  width = 112,
}: {
  x: number;
  y: number;
  label: string;
  onClick: () => void;
  active?: boolean;
  width?: number;
}) {
  return (
    <Group style={{ translateX: x, translateY: y }}>
      <Rectangle
        keyboardFocusable
        onClick={onClick}
        style={{
          width,
          height: 34,
          cornerRadius: 9,
          fill: active ? "#6443aa" : "#221d35",
          stroke: active ? "#b19bea" : "#393047",
          strokeWidth: 1,
          cursor: "pointer",
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: width / 2,
          top: 22,
          textAlign: "center",
          textBaseline: "alphabetic",
          font: "12px Arial",
          fill: "#f0e9ff",
        }}
      >
        {label}
      </Text>
    </Group>
  );
}

// One outline drives both clipping and pointer targeting.
function vessel(shape: "circle" | "square" | "star") {
  const path = new PathGeometry();
  const vertices: ElectricPoint[] = [];
  if (shape === "circle") path.arc(274, 350, 204, 0, Math.PI * 2);
  else {
    if (shape === "square")
      vertices.push(
        { x: 70, y: 146 },
        { x: 478, y: 146 },
        { x: 478, y: 554 },
        { x: 70, y: 554 },
      );
    else
      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 5,
          radius = i % 2 ? 106 : 216;
        vertices.push({
          x: 274 + Math.cos(angle) * radius,
          y: 350 + Math.sin(angle) * radius,
        });
      }
    vertices.forEach((p, i) =>
      i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y),
    );
    path.closePath();
  }
  const flattened = flattenPath(path, { tolerance: 0.5, maxSegments: 256 });
  const polygon: ElectricPoint[] = [];
  for (const segment of flattened)
    if (segment.type === "move" || segment.type === "line")
      polygon.push({ x: segment.x, y: segment.y });
  const contains = (x: number, y: number) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i],
        b = polygon[j];
      if (
        a.y > y !== b.y > y &&
        x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
      )
        inside = !inside;
    }
    return inside;
  };
  const segments = polygon.map((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    return { a, b, length: Math.hypot(b.x - a.x, b.y - a.y) };
  });
  const perimeter = segments.reduce((sum, edge) => sum + edge.length, 0);
  const sources: ElectricSource[] = [];
  // Even arc-length spacing: a densely subdivided curve gets no extra votes.
  for (let i = 0; i < 100; i++) {
    let distance = (i * perimeter) / 100;
    for (const edge of segments) {
      if (distance > edge.length) {
        distance -= edge.length;
        continue;
      }
      const t = edge.length ? distance / edge.length : 0;
      const x = 274 + (edge.a.x + (edge.b.x - edge.a.x) * t - 274) * 0.965;
      const y = 350 + (edge.a.y + (edge.b.y - edge.a.y) * t - 350) * 0.965;
      sources.push({
        id: `${shape}:outline:${i}`,
        point: { x: (x - 34) / 480, y: (y - 110) / 480 },
        weight: 0.08 + ((y - 134) / 440) * 0.1,
      });
      break;
    }
  }
  // Interior sites are just more low-weight sources, with no separate mode.
  for (let y = 158; y < 554; y += 48)
    for (let x = 82; x < 478; x += 48) {
      if (contains(x, y) && Math.hypot(x - 274, y - 350) > 45)
        sources.push({
          id: `${shape}:inside:${x}:${y}`,
          point: { x: (x - 34) / 480, y: (y - 110) / 480 },
          weight: 0.055,
        });
    }
  return {
    path,
    contains,
    sources,
    boundary: polygon.map((p) => ({
      x: (p.x - 34) / 480,
      y: (p.y - 110) / 480,
    })),
  };
}

function PlasmaGlobe({ canvas }: { canvas: HTMLCanvasElement }) {
  useReaction(() => {
    const previous = canvas.style.touchAction;
    canvas.style.touchAction = "none";
    return () => {
      if (canvas.style.touchAction === "none")
        canvas.style.touchAction = previous;
    };
  }, [canvas]);
  const state = useSignal({
    paused: false,
    seed: 42,
    branching: 0.6,
    frequency: 15,
    contactWeight: 12,
    glow: 1,
    manual: false,
    showSources: false,
    shape: "circle" as "circle" | "square" | "star",
  });
  const s = state.get();
  const outlines = useConst(() => ({
    circle: vessel("circle"),
    square: vessel("square"),
    star: vessel("star"),
  }));
  const outline = outlines[s.shape];
  // Exactly two resources. Every preview below borrows the same source pixels.
  const threads = useTexture(
    tendrils({
      seed: s.seed,
      sources: outline.sources,
      boundary: outline.boundary,
      rise: 1,
      crackle: 0.7,
      branching: s.branching,
      glow: s.glow,
      frequency: s.frequency,
    }),
    {
      resolution: { width: 320, height: 320 },
    },
  );
  const sparks = useTexture(
    lightning({
      seed: s.seed,
      positive: { x: 0.15, y: 0.5 },
      edge: "right",
      frequency: s.frequency,
      glow: s.glow,
      branching: s.branching,
    }),
    { resolution: { width: 320, height: 320 } },
  );
  const pointers = useConst(() => new Set<number>());
  const contacts = useConst(() => new Map<number, ElectricPoint>());
  const attract = (id: number, p: ElectricPoint) => {
    if (!contacts.has(id) && contacts.size >= 8) return;
    contacts.set(id, p);
    threads.send({
      type: "upsert-source",
      source: { id: `contact:${id}`, point: p, weight: s.contactWeight },
    });
  };
  const release = (id: number) => {
    contacts.delete(id);
    threads.send({ type: "remove-source", id: `contact:${id}` });
  };
  const move = (e: PibblPointerEvent) => {
    if (e.pointerType === "touch" && !pointers.has(e.pointerId)) return;
    // Root-logical coordinates -> this fill's complete texture coordinates.
    const x = (e.x - 34) / 480,
      y = (e.y - 110) / 480;
    if (!outline.contains(e.x, e.y)) {
      release(e.pointerId);
      return;
    }
    // Identical source message for pointer input and application-controlled sites.
    attract(e.pointerId, { x, y });
  };
  const end = (e: PibblPointerEvent) => {
    pointers.delete(e.pointerId);
    release(e.pointerId);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const reset = (seed = s.seed) => {
    threads.send({ type: "reset", seed });
    sparks.send({ type: "reset", seed });
    contacts.clear();
    state.update((v) => ({ ...v, seed, manual: false }));
  };
  return (
    <FocusManagement>
      <Group>
        <Rectangle
          pointerEvents="none"
          style={{ width: 880, height: 720, fill: "#090713" }}
        />
        <Label x={30} y={30} size={10} color="#bba0f0">
          ELECTRIC PLAYGROUND / 01
        </Label>
        <Label x={28} y={70} size={36} color="#f4edff">
          Plasma Globe
        </Label>
        <Label x={30} y={96} size={13}>
          A little bottled thunder. Move closer. Make contact.
        </Label>

        <Button
          x={574}
          y={76}
          width={256}
          label={`Vessel: ${s.shape} · switch shape`}
          onClick={() => {
            for (const id of contacts.keys()) release(id);
            pointers.clear();
            release(-1);
            state.update((v) => ({
              ...v,
              manual: false,
              shape:
                v.shape === "circle"
                  ? "square"
                  : v.shape === "square"
                    ? "star"
                    : "circle",
            }));
          }}
        />
        <Path
          pointerEvents="none"
          style={{
            d: outline.path,
            fill: "#0b0820",
            stroke: "#40315f",
            strokeWidth: 2,
          }}
        />
        <Clip style={{ d: outline.path }}>
          <Rectangle
            pointerEvents="none"
            style={{
              left: 0,
              top: 0,
              width: 520,
              height: 600,
              fill: threads.paint({
                mode: "repeat",
                tileWidth: 480,
                tileHeight: 480,
                offsetX: 34,
                offsetY: 110,
              }),
            }}
          />
          <Circle
            pointerEvents="none"
            style={{
              cx: 274,
              cy: 350,
              radius: 11,
              fill: "#fff0ff",
              stroke: "#d7a1ff",
              strokeWidth: 3,
            }}
          />
          {s.showSources &&
            outline.sources.map((source) => (
              <Circle
                key={source.id}
                pointerEvents="none"
                style={{
                  cx: 34 + source.point.x * 480,
                  cy: 110 + source.point.y * 480,
                  radius: 2,
                  fill: "#70ded0",
                }}
              />
            ))}
        </Clip>
        <Path
          style={{
            d: outline.path,
            fill: "#00000000",
            cursor: "crosshair",
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            if (pointers.size >= 8) return;
            pointers.add(e.pointerId);
            e.currentTarget.setPointerCapture(e.pointerId);
            move(e);
          }}
          onPointerMove={move}
          onPointerEnter={move}
          onPointerLeave={(e) => release(e.pointerId)}
          onPointerUp={end}
          onPointerCancel={end}
          onLostPointerCapture={end}
        />
        <Rectangle
          pointerEvents="none"
          style={{
            left: 234,
            top: 557,
            width: 80,
            height: 12,
            cornerRadius: 4,
            fill: "#342748",
          }}
        />
        <Rectangle
          pointerEvents="none"
          style={{
            left: 203,
            top: 569,
            width: 142,
            height: 17,
            cornerRadius: 5,
            fill: "#21192e",
            stroke: "#433254",
            strokeWidth: 1,
          }}
        />
        <Label x={116} y={613} size={11}>
          HOVER TO ATTRACT · TOUCH TO HOLD · RELEASE TO DRIFT
        </Label>

        <Rectangle
          pointerEvents="none"
          style={{
            left: 552,
            top: 124,
            width: 300,
            height: 380,
            cornerRadius: 18,
            fill: "#12101e",
            stroke: "#282039",
            strokeWidth: 1,
          }}
        />
        <Label x={574} y={151} size={10} color="#d4b7ff">
          TWO TEXTURES. ONE LITTLE STORM.
        </Label>
        <Label x={574} y={177}>
          Weighted sites + an independent arc.
        </Label>
        <Rectangle
          pointerEvents="none"
          style={{
            left: 574,
            top: 198,
            width: 116,
            height: 116,
            cornerRadius: 12,
            fill: threads,
          }}
        />
        <Rectangle
          pointerEvents="none"
          style={{
            left: 710,
            top: 198,
            width: 116,
            height: 116,
            cornerRadius: 12,
            fill: sparks,
          }}
        />
        <Label x={590} y={335} size={11}>
          WEIGHTED PLASMA
        </Label>
        <Label x={713} y={335} size={11}>
          STANDARD ARC
        </Label>
        <Rectangle
          pointerEvents="none"
          style={{
            left: 574,
            top: 354,
            width: 256,
            height: 95,
            cornerRadius: 12,
            fill: "#1a1230",
          }}
        />
        <Rectangle
          pointerEvents="none"
          style={{
            left: 574,
            top: 354,
            width: 256,
            height: 95,
            cornerRadius: 12,
            fill: threads.paint({
              mode: "repeat",
              tileWidth: 128,
              tileHeight: 128,
              offsetY: -16,
            }),
          }}
        />
        <Rectangle
          pointerEvents="none"
          style={{
            left: 574,
            top: 354,
            width: 256,
            height: 95,
            cornerRadius: 12,
            fill: sparks.paint({
              mode: "repeat",
              tileWidth: 128,
              tileHeight: 128,
              offsetY: -16,
            }),
          }}
        />
        <Label x={591} y={483} size={11}>
          SAME RESOURCES · ORDINARY PANEL FILLS
        </Label>
        <Button
          x={574}
          y={523}
          width={256}
          label={
            s.manual
              ? "Release manual contact"
              : "Send a contact from application code"
          }
          active={s.manual}
          onClick={() => {
            if (s.manual) release(-1);
            else attract(-1, { x: 0.5, y: 0.23 });
            state.update((v) => ({ ...v, manual: !v.manual }));
          }}
        />
        <Button
          x={574}
          y={566}
          width={256}
          label={
            s.showSources ? "Hide weighted sources" : "Show weighted sources"
          }
          active={s.showSources}
          onClick={() =>
            state.update((v) => ({ ...v, showSources: !v.showSources }))
          }
        />
        <Label x={574} y={632} size={11}>
          {`${outline.sources.length} low-weight sites · 320 × 320 pixels`}
        </Label>
        <Label
          x={574}
          y={614}
          size={11}
        >{`SEED ${s.seed} / ${s.paused ? "PAUSED" : "LIVE"}`}</Label>

        <Button
          x={28}
          y={645}
          width={84}
          label={s.paused ? "Resume" : "Pause"}
          active={s.paused}
          onClick={() => {
            threads.send({ type: "pause", paused: !s.paused });
            sparks.send({ type: "pause", paused: !s.paused });
            state.update((v) => ({ ...v, paused: !v.paused }));
          }}
        />
        <Button
          x={120}
          y={645}
          width={72}
          label="Reset"
          onClick={() => reset()}
        />
        <Button
          x={200}
          y={645}
          width={88}
          label="New seed"
          onClick={() => reset((s.seed + 1) >>> 0)}
        />
        <Button
          x={304}
          y={645}
          width={126}
          label={`Branches ${Math.round(s.branching * 100)}%`}
          onClick={() => {
            const branching =
              s.branching >= 1 ? 0 : Math.min(1, s.branching + 0.2);
            threads.send({ type: "configure", branching });
            sparks.send({ type: "configure", branching });
            state.update((v) => ({ ...v, branching }));
          }}
        />
        <Button
          x={438}
          y={645}
          width={126}
          label={`Crackle ${s.frequency} Hz`}
          onClick={() => {
            const frequency =
              s.frequency === 15 ? 25 : s.frequency === 25 ? 5 : 15;
            threads.send({ type: "configure", frequency });
            sparks.send({ type: "configure", frequency });
            state.update((v) => ({ ...v, frequency }));
          }}
        />
        <Button
          x={572}
          y={645}
          width={140}
          label={`Contact weight ${s.contactWeight}`}
          onClick={() => {
            const contactWeight =
              s.contactWeight === 12 ? 40 : s.contactWeight === 40 ? 2 : 12;
            for (const [id, p] of contacts)
              threads.send({
                type: "upsert-source",
                source: {
                  id: `contact:${id}`,
                  point: p,
                  weight: contactWeight,
                },
              });
            state.update((v) => ({ ...v, contactWeight }));
          }}
        />
        <Button
          x={720}
          y={645}
          width={132}
          label={`Glow ${s.glow.toFixed(1)}`}
          onClick={() => {
            const glow = s.glow >= 2 ? 0 : s.glow + 0.5;
            threads.send({ type: "configure", glow });
            sparks.send({ type: "configure", glow });
            state.update((v) => ({ ...v, glow }));
          }}
        />
        <Label x={30} y={703} size={10}>
          Reset repeats the seed. Motion also depends on frame timing and input
          history; this is not an arbitrary-time seek simulation.
        </Label>
      </Group>
    </FocusManagement>
  );
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <PlasmaGlobe canvas={canvas} />);
}
