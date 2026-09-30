import { Image, Rectangle } from '@crc/core';
export const DRAWING_IMAGES_SOURCE_ID = 'drawing-images-example';
export const DRAWING_IMAGE_SOURCES = {
  broken: 'data:image/png;base64,not-a-valid-image',
  primary: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="90" height="60">
      <rect width="90" height="60" fill="#0ea5e9"/>
      <circle cx="45" cy="30" r="17" fill="#e0f2fe"/>
    </svg>
  `)}`,
  secondary: `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="90" height="60">
      <rect width="90" height="60" fill="#ec4899"/>
      <path d="M20 44 L45 13 L70 44 Z" fill="#fce7f3"/>
    </svg>
  `)}`,
} as const;
export type DrawingImageMode = 'broken' | 'hidden' | 'primary' | 'secondary';
export type DrawingImageSizing = 'explicit' | 'natural';
export type DrawingImagesAction =
  | 'change-image'
  | 'mount'
  | 'remove-image'
  | 'reset'
  | 'show-broken-image'
  | 'show-image'
  | 'use-explicit-size'
  | 'use-natural-size';
export interface DrawingImagesState {
  lastAction: DrawingImagesAction;
  mode: DrawingImageMode;
  revision: number;
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
