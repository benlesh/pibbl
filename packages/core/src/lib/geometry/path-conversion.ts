import { arcPoint, ellipseParameters, singularArcPoints, type ArcSegment } from './path-arc.js';
import { PathGeometry, visitPathGeometry } from './path-geometry.js';

/**
 * Creates a fresh caller-owned native snapshot; never returns a shared cache.
 *
 * @param geometry - CRC geometry to convert. See {@link PathGeometry}.
 * @returns A native Canvas path representing the geometry.
 *
 * @see {@link PathGeometry}
 */
export function toPath2D(geometry: PathGeometry): Path2D {
  const path = new Path2D();
  visitPathGeometry(geometry, (type, data, i) => {
    switch (type) {
      case 0: path.moveTo(data[i], data[i + 1]); break;
      case 1: path.lineTo(data[i], data[i + 1]); break;
      case 2: path.quadraticCurveTo(data[i], data[i + 1], data[i + 2], data[i + 3]); break;
      case 3: path.bezierCurveTo(data[i], data[i + 1], data[i + 2], data[i + 3], data[i + 4], data[i + 5]); break;
      case 4: path.closePath(); break;
      case 5: {
        const arc = readArc(data, i);
        const ellipse = ellipseParameters(arc);
        if (ellipse) {
          path.ellipse(arc.cx, arc.cy, ellipse.radiusX, ellipse.radiusY, ellipse.rotation,
            ellipse.start, ellipse.start + ellipse.sweep, ellipse.sweep < 0);
        } else {
          const start = arcPoint(arc, arc.startAngle);
          path.lineTo(start[0], start[1]);
          for (const [x, y] of singularArcPoints(arc)) path.lineTo(x, y);
        }
        break;
      }
    }
  });
  return path;
}

/**
 * Serializes independent absolute SVG path data without implicit rounding.
 *
 * @param geometry - CRC geometry to serialize. See {@link PathGeometry}.
 * @returns SVG path data representing the geometry.
 *
 * @see {@link PathGeometry}
 */
export function toSvgPathData(geometry: PathGeometry): string {
  const parts: string[] = [];
  const commands = ['M', 'L', 'Q', 'C', 'Z'];
  const widths = [2, 2, 4, 6, 0];
  let currentX = 0, currentY = 0, startX = 0, startY = 0;
  visitPathGeometry(geometry, (type, data, i) => {
    if (type === 5) {
      const arc = readArc(data, i);
      const arcStart = arcPoint(arc, arc.startAngle);
      if (currentX !== arcStart[0] || currentY !== arcStart[1]) {
        parts.push('L', String(arcStart[0]), String(arcStart[1]));
      }
      [currentX, currentY] = arcPoint(arc, arc.startAngle + arc.sweep);
      const ellipse = ellipseParameters(arc);
      if (!ellipse) {
        for (const [x, y] of singularArcPoints(arc)) parts.push('L', String(x), String(y));
      } else if (arc.sweep !== 0) {
        // Splitting into at most half-turns handles full circles and avoids SVG's
        // ambiguous coincident endpoints. No flattening is involved.
        const count = Math.ceil(Math.abs(arc.sweep) / Math.PI);
        for (let step = 1; step <= count; step++) {
          const [x, y] = arcPoint(arc, arc.startAngle + arc.sweep * step / count);
          parts.push('A', String(ellipse.radiusX), String(ellipse.radiusY),
            String(ellipse.rotation * 180 / Math.PI), '0', ellipse.sweep < 0 ? '0' : '1', String(x), String(y));
        }
      }
      return;
    }
    parts.push(commands[type]);
    for (let j = 0; j < widths[type]; j++) parts.push(String(data[i + j]));
    if (type === 4) { currentX = startX; currentY = startY; }
    else {
      currentX = data[i + widths[type] - 2]; currentY = data[i + widths[type] - 1];
      if (type === 0) { startX = currentX; startY = currentY; }
    }
  });
  return parts.join(' ');
}

function readArc(data: Float64Array, i: number): ArcSegment {
  return { type: 'arc', cx: data[i], cy: data[i + 1], ux: data[i + 2], uy: data[i + 3],
    vx: data[i + 4], vy: data[i + 5], startAngle: data[i + 6], sweep: data[i + 7] };
}
