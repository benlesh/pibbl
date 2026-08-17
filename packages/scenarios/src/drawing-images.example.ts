import { defineComp, img, rect } from '@crc/core';

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
  const dimensions = state.sizing === 'explicit' ? {
    height: 100,
    width: 150,
  } : {};
  return img({
    key: 'featured-image',
    style: {
      src: DRAWING_IMAGE_SOURCES[state.mode],
      x: 24,
      y: 32,
      ...dimensions,
      alignToPixelGrid: 'round',
    },
  });
}

const DrawingImagesScene = defineComp<DrawingImagesSceneProps>(({ state }) => [
  rect({
    style: {
      x: 0,
      y: 0,
      width: 480,
      height: 240,
      fill: '#f8fafc',
    },
  }),
  rect({
    style: {
      x: 16,
      y: 24,
      width: 166,
      height: 116,
      fill: '#e2e8f0',
    },
  }),
  featuredImage(state),
  rect({
    style: {
      x: 214,
      y: 24,
      width: 106,
      height: 76,
      fill: '#e2e8f0',
    },
  }),
  img({
    key: 'natural-image',
    style: {
      src: DRAWING_IMAGE_SOURCES.secondary,
      x: 222,
      y: 32,
    },
  }),
  rect({
    style: {
      x: 350,
      y: 24,
      width: 106,
      height: 76,
      fill: '#ef4444',
    },
  }),
  img({
    key: 'zero-alpha-image',
    style: {
      src: DRAWING_IMAGE_SOURCES.primary,
      x: 358,
      y: 32,
      width: 90,
      height: 60,
      opacity: 0,
    },
  }),
  rect({
    style: {
      x: 16,
      y: 164,
      width: 440,
      height: 44,
      fill: '#dbeafe',
    },
  }),
  img({
    key: 'half-alpha-image',
    style: {
      src: DRAWING_IMAGE_SOURCES.primary,
      x: 24.2,
      y: 172.2,
      width: 424,
      height: 28,
      opacity: 0.5,
      alignToPixelGrid: 'round',
      stroke: '#1e3a8a',
      strokeWidth: 1,
    },
  }),
]);

export function createDrawingImagesScene(
  state: Readonly<DrawingImagesState>,
): ReturnType<typeof DrawingImagesScene> {
  return DrawingImagesScene({ state });
}
