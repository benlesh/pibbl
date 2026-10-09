import type {
  PibblComponent,
  PibblPixelRatio,
  PibblPrimitiveComponent,
  SystemStyle,
} from "@pibbl/core";
export interface LogoPose {
  x: number;
  y: number;
  rotation: number;
  sx: number;
  sy: number;
}
export interface LogoBubble {
  x: number;
  y: number;
  r: number;
  opacity: number;
  fill: string;
  cutout: number;
}
export interface LogoFrame {
  phase: "loading" | "forming" | "bloom" | "complete";
  poses: LogoPose[];
  bubbles: LogoBubble[];
}
export interface LogoLoaderOptions {
  reducedMotion?: boolean;
  onComplete?: () => void;
  /** Observational callback after paint; defer signal writes to a microtask. */
  onFrame?: (frame: LogoFrame) => void;
}
export interface LogoLoaderControls {
  readonly phase: LogoFrame["phase"];
  readonly frame: LogoFrame;
  /** Milliseconds within the current loop or finish program. */
  readonly time: number;
  complete(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  seek(milliseconds: number): void;
}
export function applyPose(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  pose: LogoPose,
): void;
export const PibblLogoFrame: PibblPrimitiveComponent<
  { frame: LogoFrame },
  { frame: LogoFrame; style?: SystemStyle }
>;
export function createLogoLoader(options?: LogoLoaderOptions): {
  Component: PibblComponent<{}>;
  controls: LogoLoaderControls;
};
export function mountLogoLoader(
  canvas: HTMLCanvasElement,
  options?: LogoLoaderOptions & { pixelRatio?: PibblPixelRatio },
): LogoLoaderControls & { dispose(): void };
