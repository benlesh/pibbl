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
  private readonly cellVX: Float32Array;
  private readonly cellVY: Float32Array;
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
    this.pressure = new Float32Array(cells);
    this.divergence = new Float32Array(cells);
    this.cellVX = new Float32Array(cells);
    this.cellVY = new Float32Array(cells);
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
      this.cellVX.byteLength +
      this.cellVY.byteLength
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

  /** One accepted fixed step; source acceleration has a compact smooth footprint. */
  advance(
    seconds: number,
    sourceX = 0,
    sourceY = 0,
    radius = 1,
    ax = 0,
    ay = 0,
  ): void {
    if (
      !Number.isFinite(seconds) ||
      seconds <= 0 ||
      seconds > 0.1 ||
      !Number.isFinite(sourceX) ||
      !Number.isFinite(sourceY) ||
      !Number.isFinite(radius) ||
      radius <= 0 ||
      !Number.isFinite(ax) ||
      !Number.isFinite(ay)
    ) {
      throw new RangeError("Flow step and source must be finite and bounded.");
    }
    const { columns: nx, rows: ny, dx, dy } = this;
    const inverseRadiusSquared = 1 / (radius * radius);
    const damping = Math.exp(-0.15 * seconds);
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
        const falloff = Math.max(
          0,
          1 -
            ((px - sourceX) ** 2 + (py - sourceY) ** 2) * inverseRadiusSquared,
        );
        this.nextU[i] =
          (this.isSolid(bx, by) ? vx : this.velocityX(bx, by)) * damping +
          ax * seconds * falloff * falloff;
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
        const falloff = Math.max(
          0,
          1 -
            ((px - sourceX) ** 2 + (py - sourceY) ** 2) * inverseRadiusSquared,
        );
        this.nextV[i] =
          (this.isSolid(bx, by) ? vy : this.velocityY(bx, by)) * damping +
          ay * seconds * falloff * falloff;
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

  private project(): void {
    const { columns: nx, rows: ny, dx, dy, pressure: p, solid } = this;
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
      for (let parity = 0; parity < 2; parity++) {
        for (let y = 0; y < ny; y++) {
          for (let x = (y + parity) & 1; x < nx; x += 2) {
            const i = y * nx + x;
            if (solid[i]) continue;
            let weight = 0,
              sum = 0;
            if (x === 0 || !solid[i - 1]) {
              weight += wx;
              if (x > 0) sum += wx * p[i - 1]!;
            }
            if (x === nx - 1 || !solid[i + 1]) {
              weight += wx;
              if (x < nx - 1) sum += wx * p[i + 1]!;
            }
            if (y === 0 || !solid[i - nx]) {
              weight += wy;
              if (y > 0) sum += wy * p[i - nx]!;
            }
            if (y === ny - 1 || !solid[i + nx]) {
              weight += wy;
              if (y < ny - 1) sum += wy * p[i + nx]!;
            }
            if (weight > 0)
              p[i] += 1.7 * ((sum - this.divergence[i]!) / weight - p[i]!);
          }
        }
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
