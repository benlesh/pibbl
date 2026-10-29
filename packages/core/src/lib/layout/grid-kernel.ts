/** Private v2 Grid WASM protocol. ABI wiring supplies these exports. */
export interface GridV2Kernel {
  grid_v2_create(): number;
  grid_v2_generation(handle: number): number;
  grid_v2_dispose(handle: number, generation: number): number;
  grid_v2_resize_tracks(handle: number, generation: number, count: number, axis: number): number;
  grid_v2_resolve_tracks(handle: number, generation: number, bound: number, gap: number, axis: number): number;
  grid_v2_resize_contributions(handle: number, generation: number, count: number, axis: number): number;
  grid_v2_apply_contributions(handle: number, generation: number, gap: number, axis: number): number;
  grid_v2_resize_cells(handle: number, generation: number, count: number): number;
  grid_v2_place_cells(handle: number, generation: number, columnsPointer: number, columns: number, rowsPointer: number, rows: number, columnGap: number, rowGap: number): number;
  grid_v2_assign_cells(handle: number, generation: number, columns: number, rows: number, flow: number): number;
  grid_v2_assigned_columns(handle: number, generation: number): number;
  grid_v2_assigned_rows(handle: number, generation: number): number;
  grid_v2_collapse_auto_fit(handle: number, generation: number, axis: number, explicit: number): number;
  grid_v2_auto_fit_keep(handle: number, generation: number, index: number, axis: number): number;
  memory: WebAssembly.Memory;
}

export const GRID_V2_TRACK_STRIDE = 7;
export const GRID_V2_CELL_STRIDE = 8;

export interface GridV2Cell {
  readonly columnStart: number;
  readonly columnSpan: number;
  readonly rowStart: number;
  readonly rowSpan: number;
}

export interface GridV2AutoFitCollapse {
  readonly keep: readonly boolean[];
  readonly cells: readonly GridV2Cell[];
}

export class GridV2Region {
  readonly handle: number;
  readonly generation: number;
  private disposed = false;
  private readonly pointers = [0, 0];
  private readonly counts = [0, 0];
  private cellPointer = 0;
  private cellCount = 0;

  constructor(private readonly kernel: GridV2Kernel, private readonly release?: () => void) {
    this.handle = kernel.grid_v2_create();
    this.generation = this.handle ? kernel.grid_v2_generation(this.handle) : 0;
    if (!this.generation) throw new Error('Grid v2 arena allocation failed');
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      if (this.kernel.grid_v2_dispose(this.handle, this.generation) !== 0) throw new Error('Grid v2 arena disposal failed');
    } finally { this.release?.(); }
  }

  /** A trapped instance cannot safely re-enter Rust, but still releases host ownership. */
  abandon(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.release?.();
  }

  tracks(records: readonly number[], bound: number, gap: number, axis: 0 | 1): readonly number[] {
    if (this.disposed || records.length % GRID_V2_TRACK_STRIDE) {
      throw new RangeError('Invalid Grid v2 track input');
    }
    const count = records.length / GRID_V2_TRACK_STRIDE;
    const pointer = this.kernel.grid_v2_resize_tracks(this.handle, this.generation, count, axis);
    if (!pointer) throw new RangeError('Grid v2 track storage allocation failed');
    let values = new Float64Array(this.kernel.memory.buffer, pointer, records.length);
    values.set(records);
    if (this.kernel.grid_v2_resolve_tracks(this.handle, this.generation, bound, gap, axis) !== 0) {
      throw new RangeError('Grid v2 track resolution failed');
    }
    values = new Float64Array(this.kernel.memory.buffer, pointer, records.length);
    this.pointers[axis] = pointer;
    this.counts[axis] = count;
    const resolved = new Array<number>(count);
    for (let index = 0; index < count; index++) {
      resolved[index] = values[index * GRID_V2_TRACK_STRIDE + 6]!;
    }
    return resolved;
  }

  /** Returns the current resolved values after native contribution passes. */
  resolvedTracks(axis: 0 | 1): readonly number[] {
    if (this.disposed || !this.pointers[axis]) {
      throw new RangeError('Grid v2 resolved tracks require initialized track storage');
    }
    const count = this.counts[axis];
    const values = new Float64Array(
      this.kernel.memory.buffer,
      this.pointers[axis],
      count * GRID_V2_TRACK_STRIDE,
    );
    const resolved = new Array<number>(count);
    for (let index = 0; index < count; index++) {
      resolved[index] = values[index * GRID_V2_TRACK_STRIDE + 6]!;
    }
    return resolved;
  }

  contributions(records: readonly number[], gap: number, axis: 0 | 1): void {
    if (this.disposed || records.length % 4) {
      throw new RangeError('Invalid Grid intrinsic contribution input');
    }
    const pointer = this.kernel.grid_v2_resize_contributions(this.handle, this.generation, records.length / 4, axis);
    if (!pointer && records.length) throw new RangeError('Grid contribution storage allocation failed');
    new Float64Array(this.kernel.memory.buffer, pointer, records.length).set(records);
    if (this.kernel.grid_v2_apply_contributions(this.handle, this.generation, gap, axis) !== 0) {
      throw new RangeError('Grid contribution resolution failed');
    }
  }

  assign(cells: readonly GridV2Cell[], columns: number, rows: number, flow: 0 | 1 | 2 | 3): Readonly<{ cells: GridV2Cell[]; columns: number; rows: number }> {
    const pointer = this.writeCells(cells);
    if (this.kernel.grid_v2_assign_cells(this.handle, this.generation, columns, rows, flow) !== 0) {
      throw new RangeError('Grid v2 cell assignment failed');
    }
    return {
      cells: this.readCells(pointer, cells.length),
      columns: this.kernel.grid_v2_assigned_columns(this.handle, this.generation),
      rows: this.kernel.grid_v2_assigned_rows(this.handle, this.generation),
    };
  }

  collapseAutoFit(axis: 0 | 1, explicit: number): GridV2AutoFitCollapse {
    if (this.disposed) throw new RangeError('Grid v2 region is disposed');
    const count = axis === 0
      ? this.kernel.grid_v2_assigned_columns(this.handle, this.generation)
      : this.kernel.grid_v2_assigned_rows(this.handle, this.generation);
    if (this.kernel.grid_v2_collapse_auto_fit(this.handle, this.generation, axis, explicit) !== 0) {
      throw new RangeError('Grid auto-fit collapse failed');
    }
    const keep = new Array<boolean>(count);
    for (let index = 0; index < count; index++) {
      keep[index] = this.kernel.grid_v2_auto_fit_keep(this.handle, this.generation, index, axis) !== 0;
    }
    return { keep, cells: this.readCells(this.cellPointer, this.cellCount) };
  }

  cells(cells: readonly GridV2Cell[], flow: 0 | 1 | 2 | 3, columnGap: number, rowGap: number): readonly { x: number; y: number; width: number; height: number }[] {
    if (this.disposed || !this.pointers[0] || !this.pointers[1]) {
      throw new RangeError('Grid v2 cells require resolved tracks');
    }
    const pointer = this.writeCells(cells);
    if (this.kernel.grid_v2_assign_cells(this.handle, this.generation, this.counts[0], this.counts[1], flow) !== 0) {
      throw new RangeError('Grid v2 cell assignment failed');
    }
    if (this.kernel.grid_v2_place_cells(this.handle, this.generation, this.pointers[0], this.counts[0], this.pointers[1], this.counts[1], columnGap, rowGap) !== 0) {
      throw new RangeError('Grid v2 cell placement failed');
    }
    const values = new Float64Array(this.kernel.memory.buffer, pointer, cells.length * GRID_V2_CELL_STRIDE);
    const placements = new Array<{ x: number; y: number; width: number; height: number }>(cells.length);
    for (let index = 0; index < cells.length; index++) {
      const offset = index * GRID_V2_CELL_STRIDE;
      placements[index] = {
        x: values[offset + 4]!,
        y: values[offset + 5]!,
        width: values[offset + 6]!,
        height: values[offset + 7]!,
      };
    }
    return placements;
  }

  private writeCells(cells: readonly GridV2Cell[]): number {
    if (this.disposed) throw new RangeError('Grid v2 region is disposed');
    const pointer = this.kernel.grid_v2_resize_cells(this.handle, this.generation, cells.length);
    if (!pointer && cells.length) throw new RangeError('Grid v2 cell storage allocation failed');
    const values = new Float64Array(this.kernel.memory.buffer, pointer, cells.length * GRID_V2_CELL_STRIDE);
    for (let index = 0; index < cells.length; index++) {
      const cell = cells[index]!;
      const offset = index * GRID_V2_CELL_STRIDE;
      values[offset] = cell.columnStart;
      values[offset + 1] = cell.columnSpan;
      values[offset + 2] = cell.rowStart;
      values[offset + 3] = cell.rowSpan;
    }
    this.cellPointer = pointer;
    this.cellCount = cells.length;
    return pointer;
  }

  private readCells(pointer: number, count: number): GridV2Cell[] {
    const values = new Float64Array(this.kernel.memory.buffer, pointer, count * GRID_V2_CELL_STRIDE);
    const cells = new Array<GridV2Cell>(count);
    for (let index = 0; index < count; index++) {
      const offset = index * GRID_V2_CELL_STRIDE;
      cells[index] = {
        columnStart: values[offset]!,
        columnSpan: values[offset + 1]!,
        rowStart: values[offset + 2]!,
        rowSpan: values[offset + 3]!,
      };
    }
    return cells;
  }
}
