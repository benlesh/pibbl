export type RecordedPathCommand =
  | readonly ['constructor', string]
  | readonly ['moveTo', number, number]
  | readonly ['lineTo', number, number]
  | readonly ['closePath']
  | readonly ['rect', number, number, number, number]
  | readonly [
      'roundRect',
      number,
      number,
      number,
      number,
      number | readonly number[],
    ]
  | readonly ['arc', number, number, number, number, number, boolean | undefined]
  | readonly ['ellipse', number, number, number, number, number, number, number, boolean | undefined]
  | readonly ['arcTo', number, number, number, number, number];

class RecordingPath2D {
  readonly recordedCommands: RecordedPathCommand[] = [];

  constructor(path?: string | Path2D) {
    if (typeof path === 'string') this.recordedCommands.push(['constructor', path]);
  }

  moveTo(x: number, y: number): void {
    this.recordedCommands.push(['moveTo', x, y]);
  }

  lineTo(x: number, y: number): void {
    this.recordedCommands.push(['lineTo', x, y]);
  }

  closePath(): void {
    this.recordedCommands.push(['closePath']);
  }

  rect(x: number, y: number, width: number, height: number): void {
    this.recordedCommands.push(['rect', x, y, width, height]);
  }

  roundRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radii: number | readonly number[],
  ): void {
    this.recordedCommands.push(['roundRect', x, y, width, height, radii]);
  }

  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    counterclockwise?: boolean,
  ): void {
    this.recordedCommands.push([
      'arc', x, y, radius, startAngle, endAngle, counterclockwise,
    ]);
  }

  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    counterclockwise?: boolean,
  ): void {
    this.recordedCommands.push([
      'ellipse', x, y, radiusX, radiusY, rotation, startAngle, endAngle,
      counterclockwise,
    ]);
  }

  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void {
    this.recordedCommands.push(['arcTo', x1, y1, x2, y2, radius]);
  }
}

export function installRecordingPath2D(): {
  restore(): void;
  commands(path: Path2D): readonly RecordedPathCommand[];
} {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Path2D');
  Object.defineProperty(globalThis, 'Path2D', {
    configurable: true,
    writable: true,
    value: RecordingPath2D,
  });
  let restored = false;

  return {
    restore() {
      if (restored) return;
      restored = true;
      if (original) Object.defineProperty(globalThis, 'Path2D', original);
      else delete (globalThis as { Path2D?: typeof Path2D }).Path2D;
    },
    commands(path) {
      return (path as unknown as RecordingPath2D).recordedCommands;
    },
  };
}
