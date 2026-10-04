import { definePrimitive } from "@crc/core";
import type { RenderingContext2D, SystemStyle } from "@crc/core";
import { catalog, type Game, type Machine } from "./model";
import { framePlacement, type SpriteFrame } from "./sprite-geometry";
export const frames: SpriteFrame[] = Array.from({ length: 6 }, (_, i) => ({
  x: (i % 3) * 512,
  y: Math.floor(i / 3) * 512,
  width: 512,
  height: 512,
  offsetX: 0,
  offsetY: 0,
  sourceWidth: 512,
  sourceHeight: 512,
  anchorX: 0.5,
  anchorY: 0.85,
}));
export interface Camera {
  zoom: number;
  x: number;
  y: number;
}
const cyan = "#58efeb",
  orange = "#ff9849";
function text(
  c: RenderingContext2D,
  s: string,
  x: number,
  y: number,
  size = 12,
  color = "#dcebf8",
  align: CanvasTextAlign = "center",
) {
  c.font = `${size >= 14 ? "600" : "400"} ${size}px "Space Grotesk Variable", sans-serif`;
  c.textAlign = align;
  c.fillStyle = color;
  c.fillText(s, x, y);
}
function camera(c: RenderingContext2D, v: Camera) {
  c.translate(v.x, v.y);
  c.scale(v.zoom, v.zoom);
}
export const Sprite = definePrimitive<
  {
    image: HTMLImageElement;
    frame: SpriteFrame;
    camera: Camera;
    opacity: number;
  },
  SystemStyle & { x: number; y: number; width: number; height: number }
>(function Sprite(p, s, c) {
  camera(c, p.camera);
  const d = framePlacement(p.frame, s.x, s.y, s.width, s.height);
  c.globalAlpha = p.opacity;
  c.drawImage(
    p.image,
    p.frame.x,
    p.frame.y,
    p.frame.width,
    p.frame.height,
    d.x,
    d.y,
    d.width,
    d.height,
  );
});
export const Background = definePrimitive<{
  game: Game;
  camera: Camera;
  selected: string;
  connection: string;
  reduced: boolean;
}>(function Background(p, _s, c) {
  c.fillStyle = "#071524";
  c.fillRect(0, 0, 1200, 720);
  camera(c, p.camera);
  const wash = c.createRadialGradient(610, 300, 20, 610, 300, 740);
  wash.addColorStop(0, "#122b3b");
  wash.addColorStop(1, "#04101c");
  c.fillStyle = wash;
  c.fillRect(-2000, -2000, 5000, 5000);
  c.strokeStyle = "#173044";
  c.lineWidth = 0.65;
  c.beginPath();
  for (let i = -1800; i < 2400; i += 46) {
    c.moveTo(i, -900);
    c.lineTo(i + 2400, 1500);
    c.moveTo(i, 1500);
    c.lineTo(i + 2400, -900);
  }
  c.stroke();
  const g = p.game;
  for (const [from, to] of g.edges) {
    const a = g.nodes.find((n) => n.id === from),
      b = g.nodes.find((n) => n.id === to);
    if (!a || !b) continue;
    const dead = a.dead || b.dead,
      ready = a.ready && b.ready;
    const x = a.x + 50,
      y = a.y - 15,
      ex = b.x - 55,
      ey = b.y - 15;
    const color = dead
      ? "#526170"
      : !ready
        ? "#547891"
        : b.load > 1
          ? orange
          : cyan;
    c.beginPath();
    c.moveTo(x, y);
    c.bezierCurveTo(x + 110, y, ex - 110, ey, ex, ey);
    c.strokeStyle = color;
    c.globalAlpha = 0.5;
    c.lineWidth = 2;
    c.setLineDash(dead || !ready ? [6, 8] : []);
    c.stroke();
    c.setLineDash([]);
    c.globalAlpha = 1;
    if (dead || !ready) continue;
    const count = Math.min(28, 8 + Math.floor(b.load * 12));
    for (let i = 0; i < count; i++) {
      const t =
          (i / count +
            (p.reduced ? 0 : (g.time * 0.16) / Math.max(1, b.load))) %
          1,
        u = 1 - t;
      const px =
          u * u * u * x +
          3 * u * u * t * (x + 110) +
          3 * u * t * t * (ex - 110) +
          t * t * t * ex,
        py =
          u * u * u * y +
          3 * u * u * t * y +
          3 * u * t * t * ey +
          t * t * t * ey;
      c.beginPath();
      c.arc(px, py, i % 4 === 0 ? 3 : 1.8, 0, Math.PI * 2);
      c.fillStyle = color;
      c.shadowColor = color;
      c.shadowBlur = 8;
      c.fill();
      c.shadowBlur = 0;
    }
  }
  // Legitimate customers approach the entry gateway; attack packets stay distinct.
  const entry = g.nodes.find((n) => n.id === "gateway")!;
  for (let i = 0; i < 32; i++) {
    const t = (i / 32 + (p.reduced ? 0 : g.time * 0.2)) % 1;
    const x = -60 + t * (entry.x + 25),
      y = entry.y - 15 + Math.sin(i * 3.7) * (1 - t) * 80;
    c.beginPath();
    c.arc(x, y, 2.5, 0, 7);
    c.fillStyle = g.attack && i % 3 === 0 ? "#ff6278" : cyan;
    c.fill();
  }
  text(c, "INCOMING", 40, entry.y + 85, 11, cyan);
  text(c, "CUSTOMERS", 40, entry.y + 102, 11, cyan);
  for (const n of g.nodes) {
    c.beginPath();
    c.ellipse(n.x, n.y - 4, 79, 30, 0, 0, 7);
    c.fillStyle = n.dead ? "#07101a" : "#0b2435";
    c.fill();
    c.strokeStyle =
      n.id === p.selected
        ? "#ffb64e"
        : n.id === p.connection
          ? cyan
          : "#23485a";
    c.lineWidth = n.id === p.selected ? 2 : 1;
    c.stroke();
    c.save();
    c.translate(n.x, n.y - 5);
    c.scale(1, 0.38);
    c.fillStyle = "#00000055";
    c.beginPath();
    c.arc(0, 0, 60, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
});
export const Effects = definePrimitive<{
  node: Machine;
  game: Game;
  camera: Camera;
  selected: boolean;
  reduced: boolean;
}>(function Effects(p, _s, c) {
  camera(c, p.camera);
  const n = p.node,
    t = p.game.time,
    x = n.x,
    // Effects and labels follow the artwork; ports remain on the ground plane.
    y = n.y + (n.kind === "database" ? 210 : 190) * 0.15;
  const status = n.dead
    ? "OFFLINE"
    : !n.ready
      ? "BUILDING"
      : n.load > 1
        ? "OVERLOADED"
        : n.load > 0.85
          ? "STRAINED"
          : n.load === 0
            ? "NO TRAFFIC"
            : "HEALTHY";
  if (n.dead) {
    for (let i = 0; i < 9; i++) {
      const life = (t * 0.8 + i * 0.137) % 1;
      if (life > 0.42) continue;
      const a = i * 2.39;
      const r = life * 100;
      c.strokeStyle = i % 2 ? "#ffbc61" : "#ffe7a0";
      c.globalAlpha = 1 - life * 2;
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(
        x + Math.cos(a) * r,
        y - 85 + Math.sin(a) * r + life * life * 100,
      );
      c.lineTo(
        x + Math.cos(a) * (r + 6),
        y - 85 + Math.sin(a) * (r + 6) + life * life * 100,
      );
      c.stroke();
    }
    c.globalAlpha = 1;
  } else if (n.ready && n.load > 1) {
    // Deterministic flames attached to roof; appearance never affects simulation.
    for (let i = 0; i < (p.reduced ? 5 : 21); i++) {
      const phase = (t * (0.7 + i * 0.011) + i * 0.173) % 1,
        base = x - 28 + (i % 6) * 11,
        r = (1 - phase) * (10 + (i % 4) * 2),
        fy = y - 108 - phase * (52 + (i % 5) * 8),
        fx = base + Math.sin(phase * 8 + i) * 8;
      c.globalAlpha = (1 - phase) * 0.8;
      const flame = c.createRadialGradient(fx, fy, 0, fx, fy, r * 2);
      flame.addColorStop(0, "#fff2a0");
      flame.addColorStop(0.25, "#ffc344");
      flame.addColorStop(0.55, "#ff641b");
      flame.addColorStop(1, "#ff4c0000");
      c.fillStyle = flame;
      c.beginPath();
      c.ellipse(fx, fy, r, r * 2, 0, 0, 7);
      c.fill();
    }
    for (let i = 0; i < 5; i++) {
      const life = (t * 0.22 + i * 0.2) % 1;
      c.globalAlpha = (1 - life) * 0.16;
      c.fillStyle = "#97a0a8";
      c.beginPath();
      c.arc(
        x + Math.sin(i + life * 3) * 20,
        y - 160 - life * 100,
        12 + life * 20,
        0,
        7,
      );
      c.fill();
    }
    c.globalAlpha = 1;
  }
  if (!n.ready) {
    const progress = n.built / catalog[n.kind].build;
    c.strokeStyle = "#63caff";
    c.lineWidth = 1;
    c.setLineDash([4, 5]);
    c.strokeRect(x - 70, y - 140, 140, 140);
    c.setLineDash([]);
    c.fillStyle = "#092438";
    c.fillRect(x - 70, y - 45, 140, 22);
    c.fillStyle = "#66d8ff";
    c.fillRect(x - 67, y - 42, 134 * progress, 4);
    text(c, `BOOTING ${Math.floor(progress * 100)}%`, x, y - 26, 11, "#b5ebff");
  }
  if (n.ready && !n.dead) {
    const pulse = p.reduced ? 1 : 0.55 + 0.45 * Math.sin(t * 6 + x);
    c.globalAlpha = pulse;
    c.fillStyle = n.load > 1 ? orange : cyan;
    c.fillRect(x - 18, y - 57, 5, 3);
    c.fillRect(x - 8, y - 54, 5, 3);
    c.globalAlpha = 1;
  }
  text(c, n.name, x, y + 26, 14);
  text(
    c,
    status,
    x,
    y + 44,
    10,
    n.dead ? "#ff687a" : !n.ready ? "#87cbff" : n.load > 1 ? orange : "#81a2b5",
  );
  c.fillStyle = "#17364a";
  c.fillRect(x - 40, y + 55, 80, 4);
  c.fillStyle = n.dead ? "#ff6278" : n.load > 1 ? orange : cyan;
  c.fillRect(x - 40, y + 55, 80 * Math.min(n.load, 1), 4);
  // Connection ports are distinct from the building selection target.
  for (const side of [-1, 1]) {
    c.beginPath();
    c.arc(x + side * 75, n.y - 8, 5, 0, 7);
    c.fillStyle = "#071624";
    c.fill();
    c.strokeStyle = p.selected ? "#d6fcff" : "#428899";
    c.lineWidth = 2;
    c.stroke();
  }
});
