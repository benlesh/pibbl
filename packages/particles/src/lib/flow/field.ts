export interface FlowSource2D {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly acceleration?: readonly [number, number];
  /** Normalized heat injected per second; carried and dissipated by the field. */
  readonly heat?: number;
}
const NO_SOURCES: readonly FlowSource2D[] = Object.freeze([]);

/**
 * Renderer-independent MAC grid. Velocities are logical units/second; pressure
 * stores the velocity potential (dt / density folded in). Open domain edges
 * use zero pressure. Solids prescribe face-normal velocity (free slip).
 * All numerical storage is allocated once; advancement and sampling allocate
 * no per-cell or per-particle objects. This kernel owns no clock or WASM memory.
 */
export class FlowFieldKernel2D {
  private u: Float32Array;
  private v: Float32Array;
  private nextU: Float32Array;
  private nextV: Float32Array;
  private readonly solid: Uint8Array;
  private readonly wallU: Float32Array;
  private readonly wallV: Float32Array;
  private readonly fixedU: Uint8Array;
  private readonly fixedV: Uint8Array;
  private readonly pressure: Float32Array;
  private readonly divergence: Float32Array;
  private readonly neighbors: Uint32Array;
  private readonly inverseWeight: Float64Array;
  private readonly solveOrder: Uint32Array;
  private solveCount = 0;
  private readonly cellVX: Float32Array;
  private readonly cellVY: Float32Array;
  private temperature: Float32Array;
  private nextTemperature: Float32Array;
  readonly dx: number;
  readonly dy: number;
  projectionIterations = 0;
  projectionResidual = 0;

  constructor(
    readonly columns: number,
    readonly rows: number,
    readonly width: number,
    readonly height: number,
  ) {
    if (
      !Number.isInteger(columns) ||
      !Number.isInteger(rows) ||
      columns < 4 ||
      rows < 4 ||
      columns * rows > 1_048_576 ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) {
      throw new RangeError(
        "Flow grid requires finite positive bounds and 4+ cells per axis (at most 1048576 cells).",
      );
    }
    this.dx = width / columns;
    this.dy = height / rows;
    const cells = columns * rows;
    this.u = new Float32Array((columns + 1) * rows);
    this.v = new Float32Array(columns * (rows + 1));
    this.nextU = new Float32Array(this.u.length);
    this.nextV = new Float32Array(this.v.length);
    this.wallU = new Float32Array(this.u.length);
    this.wallV = new Float32Array(this.v.length);
    this.fixedU = new Uint8Array(this.u.length);
    this.fixedV = new Uint8Array(this.v.length);
    this.solid = new Uint8Array(cells);
    this.pressure = new Float32Array(cells + 1); // final entry is the zero-pressure sentinel
    this.neighbors = new Uint32Array(cells * 4);
    this.inverseWeight = new Float64Array(cells);
    this.solveOrder = new Uint32Array(cells);
    this.divergence = new Float32Array(cells);
    this.cellVX = new Float32Array(cells);
    this.cellVY = new Float32Array(cells);
    this.temperature = new Float32Array(cells);
    this.nextTemperature = new Float32Array(cells);
    this.rebuildStencil();
  }

  /** Copy committed state into a reusable candidate before a transactional frame. */
  copyFrom(other: FlowFieldKernel2D): void {
    if (
      this.columns !== other.columns ||
      this.rows !== other.rows ||
      this.width !== other.width ||
      this.height !== other.height
    ) {
      throw new RangeError("Cannot copy differently sized flow fields.");
    }
    this.u.set(other.u);
    this.v.set(other.v);
    this.solid.set(other.solid);
    this.wallU.set(other.wallU);
    this.wallV.set(other.wallV);
    this.fixedU.set(other.fixedU);
    this.fixedV.set(other.fixedV);
    this.pressure.set(other.pressure);
    this.neighbors.set(other.neighbors);
    this.inverseWeight.set(other.inverseWeight);
    this.solveOrder.set(other.solveOrder);
    this.solveCount = other.solveCount;
    this.cellVX.set(other.cellVX);
    this.cellVY.set(other.cellVY);
    this.temperature.set(other.temperature);
    this.projectionIterations = other.projectionIterations;
    this.projectionResidual = other.projectionResidual;
  }

  get byteLength(): number {
    return (
      this.u.byteLength +
      this.v.byteLength +
      this.nextU.byteLength +
      this.nextV.byteLength +
      this.wallU.byteLength +
      this.wallV.byteLength +
      this.fixedU.byteLength +
      this.fixedV.byteLength +
      this.solid.byteLength +
      this.pressure.byteLength +
      this.divergence.byteLength +
      this.neighbors.byteLength +
      this.inverseWeight.byteLength +
      this.solveOrder.byteLength +
      this.cellVX.byteLength +
      this.cellVY.byteLength +
      this.temperature.byteLength +
      this.nextTemperature.byteLength
    );
  }

  /** Packed boxes: cx, cy, hx, hy, angle radians, vx, vy, omega, COM x, COM y.
   * Copies into grid storage; the caller retains and may reuse its own buffer.
   * Overlapping solids resolve in batch order, with the last solid owning motion.
   */
  setBoxes(boxes: Float64Array): void {
    if (boxes.length % 10 !== 0)
      throw new RangeError("Malformed flow box batch.");
    for (let i = 0; i < boxes.length; i++) {
      if (!Number.isFinite(boxes[i]))
        throw new RangeError("Flow box values must be finite.");
      if ((i % 10 === 2 || i % 10 === 3) && boxes[i]! <= 0) {
        throw new RangeError("Flow box half extents must be positive.");
      }
    }
    const { columns: nx, rows: ny, dx, dy } = this;
    this.solid.fill(0);
    this.cellVX.fill(0);
    this.cellVY.fill(0);
    for (let b = 0; b < boxes.length; b += 10) {
      const cx = boxes[b]!,
        cy = boxes[b + 1]!;
      const hx = boxes[b + 2]!,
        hy = boxes[b + 3]!;
      const c = Math.cos(boxes[b + 4]!),
        s = Math.sin(boxes[b + 4]!);
      const ex = Math.abs(c) * hx + Math.abs(s) * hy;
      const ey = Math.abs(s) * hx + Math.abs(c) * hy;
      const x0 = Math.max(0, Math.floor((cx - ex) / dx));
      const x1 = Math.min(nx - 1, Math.floor((cx + ex) / dx));
      const y0 = Math.max(0, Math.floor((cy - ey) / dy));
      const y1 = Math.min(ny - 1, Math.floor((cy + ey) / dy));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const px = (x + 0.5) * dx,
            py = (y + 0.5) * dy;
          const rx = px - cx,
            ry = py - cy;
          if (Math.abs(c * rx + s * ry) > hx || Math.abs(-s * rx + c * ry) > hy)
            continue;
          const i = y * nx + x;
          this.solid[i] = 1;
          // At u faces y equals the cell-center y; at v faces x equals
          // cell-center x, so these are exact normal rigid velocities.
          this.cellVX[i] = boxes[b + 5]! - boxes[b + 7]! * (py - boxes[b + 9]!);
          this.cellVY[i] = boxes[b + 6]! + boxes[b + 7]! * (px - boxes[b + 8]!);
        }
      }
    }
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x <= nx; x++) {
        const face = y * (nx + 1) + x;
        const left = y * nx + x - 1,
          right = left + 1;
        const cell =
          x > 0 && this.solid[left]
            ? left
            : x < nx && this.solid[right]
              ? right
              : -1;
        // A newly uncovered face starts at its last boundary velocity.
        this.fixedU[face] = cell >= 0 ? 1 : 0;
        this.wallU[face] = cell >= 0 ? this.cellVX[cell]! : 0;
      }
    }
    for (let y = 0; y <= ny; y++) {
      for (let x = 0; x < nx; x++) {
        const face = y * nx + x;
        const above = face - nx,
          below = face;
        const cell =
          y > 0 && this.solid[above]
            ? above
            : y < ny && this.solid[below]
              ? below
              : -1;
        this.fixedV[face] = cell >= 0 ? 1 : 0;
        this.wallV[face] = cell >= 0 ? this.cellVY[cell]! : 0;
      }
    }
    this.enforceWalls();
    this.rebuildStencil();
    // Geometry changes invalidate the previous pressure initial guess.
    this.pressure.fill(0);
  }

  isSolid(x: number, y: number): boolean {
    const ix = Math.floor(x / this.dx),
      iy = Math.floor(y / this.dy);
    return (
      ix >= 0 &&
      ix < this.columns &&
      iy >= 0 &&
      iy < this.rows &&
      this.solid[iy * this.columns + ix] === 1
    );
  }

  private interpolate(
    data: Float32Array,
    nx: number,
    ny: number,
    x: number,
    y: number,
  ): number {
    x = Math.max(0, Math.min(nx - 1, x));
    y = Math.max(0, Math.min(ny - 1, y));
    const ix = Math.floor(x),
      iy = Math.floor(y);
    const jx = Math.min(nx - 1, ix + 1),
      jy = Math.min(ny - 1, iy + 1);
    const fx = x - ix,
      fy = y - iy;
    const a = data[iy * nx + ix]!,
      b = data[iy * nx + jx]!;
    const c = data[jy * nx + ix]!,
      d = data[jy * nx + jx]!;
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  }

  private velocityX(x: number, y: number): number {
    return this.interpolate(
      this.u,
      this.columns + 1,
      this.rows,
      x / this.dx,
      y / this.dy - 0.5,
    );
  }

  private velocityY(x: number, y: number): number {
    return this.interpolate(
      this.v,
      this.columns,
      this.rows + 1,
      x / this.dx - 0.5,
      y / this.dy,
    );
  }

  sampleBatch(
    positions: Float32Array,
    velocities: Float32Array,
    count: number,
  ): void {
    if (
      !Number.isInteger(count) ||
      count < 0 ||
      count * 2 > positions.length ||
      count * 2 > velocities.length
    ) {
      throw new RangeError("Flow sample batch exceeds buffer bounds.");
    }
    for (let i = 0; i < count * 2; i += 2) {
      const x = positions[i]!,
        y = positions[i + 1]!;
      velocities[i] = this.velocityX(x, y);
      velocities[i + 1] = this.velocityY(x, y);
    }
  }

  /** Swept grid traversal, O(cells crossed), independent of obstacle count.
   * A particle already covered by a moved solid is left for the population's
   * explicit retire/reseed policy. Domain edges are open.
   */
  moveBatch(
    positions: Float32Array,
    velocities: Float32Array,
    count: number,
    seconds: number,
  ): void {
    if (
      !Number.isInteger(count) ||
      count < 0 ||
      count * 2 > positions.length ||
      count * 2 > velocities.length ||
      !Number.isFinite(seconds) ||
      seconds < 0
    ) {
      throw new RangeError("Invalid flow movement batch.");
    }
    for (let i = 0; i < count * 2; i += 2) {
      const x = positions[i]!,
        y = positions[i + 1]!;
      const sx = velocities[i]! * seconds,
        sy = velocities[i + 1]! * seconds;
      const fraction = this.sweepFraction(x, y, sx, sy);
      positions[i] = x + sx * fraction;
      positions[i + 1] = y + sy * fraction;
    }
  }

  private sweepFraction(x: number, y: number, sx: number, sy: number): number {
    if (sx === 0 && sy === 0) return 1;
    // Clip the traversal to the field, including segments starting outside it.
    let enter = 0,
      exit = 1;
    if (sx === 0) {
      if (x < 0 || x >= this.width) return 1;
    } else {
      const a = -x / sx,
        b = (this.width - x) / sx;
      enter = Math.max(enter, Math.min(a, b));
      exit = Math.min(exit, Math.max(a, b));
    }
    if (sy === 0) {
      if (y < 0 || y >= this.height) return 1;
    } else {
      const a = -y / sy,
        b = (this.height - y) / sy;
      enter = Math.max(enter, Math.min(a, b));
      exit = Math.min(exit, Math.max(a, b));
    }
    if (enter > exit) return 1;
    const nx = this.columns,
      ny = this.rows;
    const stepX = sx > 0 ? 1 : -1,
      stepY = sy > 0 ? 1 : -1;
    let cx = Math.min(
      nx - 1,
      Math.max(0, Math.floor((x + sx * enter) / this.dx)),
    );
    let cy = Math.min(
      ny - 1,
      Math.max(0, Math.floor((y + sy * enter) / this.dy)),
    );
    if (this.solid[cy * nx + cx]) return enter;
    let tx = sx === 0 ? Infinity : ((cx + (sx > 0 ? 1 : 0)) * this.dx - x) / sx;
    let ty = sy === 0 ? Infinity : ((cy + (sy > 0 ? 1 : 0)) * this.dy - y) / sy;
    const deltaX = sx === 0 ? Infinity : this.dx / Math.abs(sx);
    const deltaY = sy === 0 ? Infinity : this.dy / Math.abs(sy);
    const clearance =
      (Math.min(this.dx, this.dy) * 0.0001) /
      Math.max(Math.abs(sx), Math.abs(sy));
    while (Math.min(tx, ty) <= exit) {
      const t = Math.min(tx, ty);
      const crossX = tx <= ty,
        crossY = ty <= tx;
      // At a corner, check both side neighbors as well as the diagonal.
      if (crossX) {
        const neighbor = cx + stepX;
        if (neighbor >= 0 && neighbor < nx && this.solid[cy * nx + neighbor])
          return Math.max(0, t - clearance);
      }
      if (crossY) {
        const neighbor = cy + stepY;
        if (neighbor >= 0 && neighbor < ny && this.solid[neighbor * nx + cx])
          return Math.max(0, t - clearance);
      }
      if (crossX) {
        cx += stepX;
        tx += deltaX;
      }
      if (crossY) {
        cy += stepY;
        ty += deltaY;
      }
      if (cx < 0 || cx >= nx || cy < 0 || cy >= ny) return 1;
      if (this.solid[cy * nx + cx]) return Math.max(0, t - clearance);
    }
    return 1;
  }

  /** One accepted fixed step. Sources touch only their bounded footprints. */
  advance(
    seconds: number,
    sources: readonly FlowSource2D[] = NO_SOURCES,
    buoyancy = -300,
  ): void {
    if (
      !Number.isFinite(seconds) ||
      seconds <= 0 ||
      seconds > 0.1 ||
      !Number.isFinite(buoyancy)
    ) {
      throw new RangeError(
        "Flow step and buoyancy must be finite and bounded.",
      );
    }
    // Preflight every source before touching simulation storage.
    for (const source of sources) {
      if (
        !Number.isFinite(source.x) ||
        !Number.isFinite(source.y) ||
        !Number.isFinite(source.radius) ||
        source.radius <= 0 ||
        !Number.isFinite(source.acceleration?.[0] ?? 0) ||
        !Number.isFinite(source.acceleration?.[1] ?? 0) ||
        !Number.isFinite(source.heat ?? 0) ||
        (source.heat ?? 0) < 0
      ) {
        throw new RangeError(
          "Flow source must have finite coordinates, positive radius and nonnegative heat.",
        );
      }
    }
    const { columns: nx, rows: ny, dx, dy } = this;
    const damping = Math.exp(-0.15 * seconds);
    const cooling = Math.exp(-0.3 * seconds);
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const i = y * nx + x;
        if (this.solid[i]) {
          this.nextTemperature[i] = 0;
          continue;
        }
        const px = (x + 0.5) * dx,
          py = (y + 0.5) * dy;
        const bx = px - seconds * this.velocityX(px, py);
        const by = py - seconds * this.velocityY(px, py);
        this.nextTemperature[i] =
          bx < 0 ||
          by < 0 ||
          bx >= this.width ||
          by >= this.height ||
          this.isSolid(bx, by)
            ? 0
            : this.interpolate(
                this.temperature,
                nx,
                ny,
                bx / dx - 0.5,
                by / dy - 0.5,
              ) * cooling;
      }
    }
    for (const source of sources) {
      if (!source.heat) continue;
      const inverseRadiusSquared = 1 / (source.radius * source.radius);
      const x0 = Math.max(0, Math.floor((source.x - source.radius) / dx));
      const x1 = Math.min(nx - 1, Math.floor((source.x + source.radius) / dx));
      const y0 = Math.max(0, Math.floor((source.y - source.radius) / dy));
      const y1 = Math.min(ny - 1, Math.floor((source.y + source.radius) / dy));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = y * nx + x;
          if (this.solid[i]) continue;
          const rx = (x + 0.5) * dx - source.x,
            ry = (y + 0.5) * dy - source.y;
          const falloff = Math.max(
            0,
            1 - (rx * rx + ry * ry) * inverseRadiusSquared,
          );
          this.nextTemperature[i] = Math.min(
            1,
            this.nextTemperature[i]! +
              source.heat * seconds * falloff * falloff,
          );
        }
      }
    }
    const oldTemperature = this.temperature;
    this.temperature = this.nextTemperature;
    this.nextTemperature = oldTemperature;
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x <= nx; x++) {
        const i = y * (nx + 1) + x;
        if (this.fixedU[i]) {
          this.nextU[i] = this.wallU[i]!;
          continue;
        }
        const px = x * dx,
          py = (y + 0.5) * dy;
        const vx = this.u[i]!,
          vy = this.velocityY(px, py);
        const bx = px - seconds * vx,
          by = py - seconds * vy;
        this.nextU[i] =
          (this.isSolid(bx, by) ? vx : this.velocityX(bx, by)) * damping;
      }
    }
    for (let y = 0; y <= ny; y++) {
      for (let x = 0; x < nx; x++) {
        const i = y * nx + x;
        if (this.fixedV[i]) {
          this.nextV[i] = this.wallV[i]!;
          continue;
        }
        const px = (x + 0.5) * dx,
          py = y * dy;
        const vx = this.velocityX(px, py),
          vy = this.v[i]!;
        const bx = px - seconds * vx,
          by = py - seconds * vy;
        // At a face, average only adjacent fluid-cell temperatures.
        const above =
          y > 0 && !this.solid[i - nx] ? this.temperature[i - nx]! : 0;
        const below = y < ny && !this.solid[i] ? this.temperature[i]! : 0;
        this.nextV[i] =
          (this.isSolid(bx, by) ? vy : this.velocityY(bx, by)) * damping +
          seconds * buoyancy * (above + below) * 0.5;
      }
    }
    for (const source of sources) {
      const ax = source.acceleration?.[0] ?? 0,
        ay = source.acceleration?.[1] ?? 0;
      if (ax === 0 && ay === 0) continue;
      const inverseRadiusSquared = 1 / (source.radius * source.radius);
      const x0 = Math.max(0, Math.floor((source.x - source.radius) / dx));
      const x1 = Math.min(nx, Math.ceil((source.x + source.radius) / dx));
      const y0 = Math.max(0, Math.floor((source.y - source.radius) / dy));
      const y1 = Math.min(ny, Math.ceil((source.y + source.radius) / dy));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (ax !== 0 && y < ny) {
            const i = y * (nx + 1) + x;
            if (!this.fixedU[i]) {
              const rx = x * dx - source.x,
                ry = (y + 0.5) * dy - source.y;
              const falloff = Math.max(
                0,
                1 - (rx * rx + ry * ry) * inverseRadiusSquared,
              );
              this.nextU[i] += seconds * ax * falloff * falloff;
            }
          }
          if (ay !== 0 && x < nx) {
            const i = y * nx + x;
            if (!this.fixedV[i]) {
              const rx = (x + 0.5) * dx - source.x,
                ry = y * dy - source.y;
              const falloff = Math.max(
                0,
                1 - (rx * rx + ry * ry) * inverseRadiusSquared,
              );
              this.nextV[i] += seconds * ay * falloff * falloff;
            }
          }
        }
      }
    }
    const oldU = this.u,
      oldV = this.v;
    this.u = this.nextU;
    this.v = this.nextV;
    this.nextU = oldU;
    this.nextV = oldV;
    this.project();
  }

  private enforceWalls(): void {
    for (let i = 0; i < this.u.length; i++)
      if (this.fixedU[i]) this.u[i] = this.wallU[i]!;
    for (let i = 0; i < this.v.length; i++)
      if (this.fixedV[i]) this.v[i] = this.wallV[i]!;
  }

  /** Cache the Poisson stencil in red/black order once per obstacle update. */
  private rebuildStencil(): void {
    const { columns: nx, rows: ny, solid, neighbors, inverseWeight, solveOrder } = this;
    const sentinel = nx * ny, wx = 1 / (this.dx * this.dx), wy = 1 / (this.dy * this.dy);
    let count = 0;
    for (let parity = 0; parity < 2; parity++) {
      for (let y = 0; y < ny; y++) {
        for (let x = (y + parity) & 1; x < nx; x += 2) {
          const i = y * nx + x;
          if (solid[i]) continue;
          let weight = 0;
          const left = x > 0 && !solid[i - 1];
          const right = x < nx - 1 && !solid[i + 1];
          const above = y > 0 && !solid[i - nx];
          const below = y < ny - 1 && !solid[i + nx];
          if (x === 0 || left) weight += wx;
          if (x === nx - 1 || right) weight += wx;
          if (y === 0 || above) weight += wy;
          if (y === ny - 1 || below) weight += wy;
          if (weight === 0) continue;
          neighbors[i * 4] = left ? i - 1 : sentinel;
          neighbors[i * 4 + 1] = right ? i + 1 : sentinel;
          neighbors[i * 4 + 2] = above ? i - nx : sentinel;
          neighbors[i * 4 + 3] = below ? i + nx : sentinel;
          inverseWeight[i] = 1 / weight;
          solveOrder[count++] = i;
        }
      }
    }
    this.solveCount = count;
  }

  private project(): void {
    const { columns: nx, rows: ny, dx, dy, pressure: p } = this;
    const wx = 1 / (dx * dx),
      wy = 1 / (dy * dy);
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const i = y * nx + x;
        this.divergence[i] =
          (this.u[y * (nx + 1) + x + 1]! - this.u[y * (nx + 1) + x]!) / dx +
          (this.v[i + nx]! - this.v[i]!) / dy;
      }
    }
    // Warm-start red/black SOR. Residual checks avoid burning the full budget
    // on quiet fields; a hard budget keeps worst-case frame work bounded.
    // Free boundaries use p=0; solid neighbors impose Neumann conditions.
    this.projectionIterations = 0;
    for (let iteration = 0; iteration < 80; iteration++) {
      for (let entry = 0; entry < this.solveCount; entry++) {
        const i = this.solveOrder[entry]!, offset = i * 4;
        const sum = wx * p[this.neighbors[offset]!]! + wx * p[this.neighbors[offset + 1]!]! +
          wy * p[this.neighbors[offset + 2]!]! + wy * p[this.neighbors[offset + 3]!]!;
        p[i] += 1.7 * ((sum - this.divergence[i]!) * this.inverseWeight[i]! - p[i]!);
      }
      this.projectionIterations = iteration + 1;
      if ((iteration & 7) === 7) {
        this.projectionResidual = this.pressureResidual();
        if (this.projectionResidual <= 0.001) break;
      }
    }
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x <= nx; x++) {
        const i = y * (nx + 1) + x;
        if (this.fixedU[i]) continue;
        this.u[i] -=
          ((x < nx ? p[y * nx + x]! : 0) - (x > 0 ? p[y * nx + x - 1]! : 0)) /
          dx;
      }
    }
    for (let y = 0; y <= ny; y++) {
      for (let x = 0; x < nx; x++) {
        const i = y * nx + x;
        if (this.fixedV[i]) continue;
        this.v[i] -= ((y < ny ? p[i]! : 0) - (y > 0 ? p[i - nx]! : 0)) / dy;
      }
    }
  }

  private pressureResidual(): number {
    const { columns: nx, rows: ny, pressure: p, solid } = this;
    const wx = 1 / (this.dx * this.dx),
      wy = 1 / (this.dy * this.dy);
    let maximum = 0;
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const i = y * nx + x;
        if (solid[i]) continue;
        const center = p[i]!;
        let laplacian = 0;
        if (x === 0) laplacian -= wx * center;
        else if (!solid[i - 1]) laplacian += wx * (p[i - 1]! - center);
        if (x === nx - 1) laplacian -= wx * center;
        else if (!solid[i + 1]) laplacian += wx * (p[i + 1]! - center);
        if (y === 0) laplacian -= wy * center;
        else if (!solid[i - nx]) laplacian += wy * (p[i - nx]! - center);
        if (y === ny - 1) laplacian -= wy * center;
        else if (!solid[i + nx]) laplacian += wy * (p[i + nx]! - center);
        maximum = Math.max(maximum, Math.abs(laplacian - this.divergence[i]!));
      }
    }
    return maximum;
  }

  /** Diagnostic scans; not used by normal advancement. */
  maximumSolidFluxError(): number {
    let error = 0;
    for (let i = 0; i < this.u.length; i++)
      if (this.fixedU[i])
        error = Math.max(error, Math.abs(this.u[i]! - this.wallU[i]!));
    for (let i = 0; i < this.v.length; i++)
      if (this.fixedV[i])
        error = Math.max(error, Math.abs(this.v[i]! - this.wallV[i]!));
    return error;
  }

  maximumDivergence(): number {
    let maximum = 0;
    const nx = this.columns;
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < nx; x++) {
        const i = y * nx + x;
        if (this.solid[i]) continue;
        const d =
          (this.u[y * (nx + 1) + x + 1]! - this.u[y * (nx + 1) + x]!) /
            this.dx +
          (this.v[i + nx]! - this.v[i]!) / this.dy;
        maximum = Math.max(maximum, Math.abs(d));
      }
    }
    return maximum;
  }
}
