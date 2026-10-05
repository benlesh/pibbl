import { Image, Rectangle } from '@pibbl/core';
export const DRAWING_IMAGES_SOURCE_ID = 'drawing-images-example';
/**
 * Named image assets used by the drawing-images scenario.
 *
 * @see {@link DrawingImageMode}
 */
export const DRAWING_IMAGE_SOURCES = {
  /**
   * Intentionally invalid image source for failure and cleanup checks. See
   * {@link DRAWING_IMAGE_SOURCES}.
   */
  broken: 'data:image/png;base64,not-a-valid-image',
  /**
   * Primary image asset for deterministic drawing and ownership checks. See
   * {@link DRAWING_IMAGE_SOURCES}.
   */
  primary: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="90" height="60">
      <rect width="90" height="60" fill="#0ea5e9"/>
      <circle cx="45" cy="30" r="17" fill="#e0f2fe"/>
    </svg>
  `)}`,
  /** Alternate image asset for source replacement checks. See {@link DRAWING_IMAGE_SOURCES}. */
  secondary: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="90" height="60">
      <rect width="90" height="60" fill="#ec4899"/>
      <path d="M20 44 L45 13 L70 44 Z" fill="#fce7f3"/>
    </svg>
  `)}`,
} as const;
/**
 * Supported drawing image mode values: `"broken"`, `"hidden"`, `"primary"`, `"secondary"`.
 *
 * @see {@link DRAWING_IMAGE_SOURCES}
 * @see {@link DrawingImagesState}
 */
export type DrawingImageMode = 'broken' | 'hidden' | 'primary' | 'secondary';
/**
 * Supported drawing image sizing values: `"explicit"`, `"natural"`.
 *
 * @see {@link DrawingImagesState}
 */
export type DrawingImageSizing = 'explicit' | 'natural';
/**
 * Actions supported by the drawing images scenario's public controller.
 *
 * @see {@link DrawingImagesState}
 */
export type DrawingImagesAction =
  | 'change-image'
  | 'mount'
  | 'remove-image'
  | 'reset'
  | 'show-broken-image'
  | 'show-image'
  | 'use-explicit-size'
  | 'use-natural-size';
/**
 * Observable state exposed by the drawing images scenario for controls and assertions.
 *
 * @see {@link DrawingImagesAction}
 * @see {@link DrawingImageMode}
 * @see {@link DrawingImageSizing}
 */
export interface DrawingImagesState {
  /** Last action recorded or configured by this scenario. See {@link DrawingImagesAction}. */
  lastAction: DrawingImagesAction;
  /** Mode recorded or configured by this scenario. See {@link DrawingImageMode}. */
  mode: DrawingImageMode;
  /** Revision recorded or configured by this scenario. See {@link DrawingImagesState}. */
  revision: number;
  /** Sizing recorded or configured by this scenario. See {@link DrawingImageSizing}. */
  sizing: DrawingImageSizing;
}
interface DrawingImagesSceneProps {
  state: Readonly<DrawingImagesState>;
}
function featuredImage(state: Readonly<DrawingImagesState>) {
  if (state.mode === 'hidden') {
    return undefined;
  }
  const dimensions =
    state.sizing === 'explicit'
      ? {
          height: 100,
          width: 150,
        }
      : {};
  return (
    <Image
      key="featured-image"
      style={{
        src: DRAWING_IMAGE_SOURCES[state.mode],
        left: 24,
        top: 32,
        ...dimensions,
        alignToPixelGrid: 'round',
      }}
    />
  );
}
const DrawingImagesScene = ({ state }: DrawingImagesSceneProps) => [
  <Rectangle
    style={{
      left: 0,
      top: 0,
      width: 480,
      height: 240,
      fill: '#f8fafc',
    }}
  />,
  <Rectangle
    style={{
      left: 16,
      top: 24,
      width: 166,
      height: 116,
      fill: '#e2e8f0',
    }}
  />,
  featuredImage(state),
  <Rectangle
    style={{
      left: 214,
      top: 24,
      width: 106,
      height: 76,
      fill: '#e2e8f0',
    }}
  />,
  <Image
    key="natural-image"
    style={{
      src: DRAWING_IMAGE_SOURCES.secondary,
      left: 222,
      top: 32,
    }}
  />,
  <Rectangle
    style={{
      left: 350,
      top: 24,
      width: 106,
      height: 76,
      fill: '#ef4444',
    }}
  />,
  <Image
    key="zero-alpha-image"
    style={{
      src: DRAWING_IMAGE_SOURCES.primary,
      left: 358,
      top: 32,
      width: 90,
      height: 60,
      opacity: 0,
    }}
  />,
  <Rectangle
    style={{
      left: 16,
      top: 164,
      width: 440,
      height: 44,
      fill: '#dbeafe',
    }}
  />,
  <Image
    key="half-alpha-image"
    style={{
      src: DRAWING_IMAGE_SOURCES.primary,
      // Placement is separate from drawing-local pixel alignment. Keep the
      // origin integral and exercise rounding through the fractional size.
      left: 24,
      top: 172,
      width: 424.2,
      height: 28.2,
      opacity: 0.5,
      alignToPixelGrid: 'round',
      stroke: '#1e3a8a',
      strokeWidth: 1,
    }}
  />,
];
export function createDrawingImagesScene(state: Readonly<DrawingImagesState>) {
  return <DrawingImagesScene state={state} />;
}
