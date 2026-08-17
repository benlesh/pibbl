import { defineComp, rect, text } from '@crc/core';

export const DRAWING_TEXT_SOURCE_ID = 'drawing-text-example';

export type DrawingTextAction =
  | 'click-centered'
  | 'mount'
  | 'reset'
  | 'update-copy';

export interface DrawingTextState {
  centeredClicks: number;
  lastAction: DrawingTextAction;
  revision: number;
  updated: boolean;
}

interface DrawingTextSceneProps {
  onCenteredText?: () => void;
  state: Readonly<DrawingTextState>;
}

const DrawingTextScene = defineComp<DrawingTextSceneProps>(({
  onCenteredText,
  state,
}) => [
  rect({
    style: {
      x: 0,
      y: 0,
      width: 480,
      height: 240,
      fill: '#f8fafc',
    },
  }),
  text({
    style: {
      text: state.updated ? 'Updated canvas text' : 'Canvas text',
      x: 24,
      y: 18,
      font: '700 24px Arial',
      fill: state.updated ? '#7c3aed' : '#0f172a',
    },
    key: 'heading',
  }),
  text({
    style: {
      text: 'centered',
      x: 374,
      y: 24,
      font: '18px Arial',
      textAlign: 'center',
      textBaseline: 'middle',
      fill: '#0f766e',
      cursor: 'pointer',
    },
    key: 'centered',
    onClick: onCenteredText,
  }),
  rect({
    style: {
      x: 24,
      y: 68,
      width: 172,
      height: 40,
      fill: '#e2e8f0',
    },
  }),
  text({
    style: {
      text: state.updated ? 'A newly updated sentence' : 'A sentence that is too long',
      x: 32,
      y: 76,
      width: 154,
      fit: 'ellipsis',
      font: '17px Arial',
      fill: '#1d4ed8',
    },
    key: 'ellipsis',
  }),
  rect({
    style: {
      x: 244,
      y: 68,
      width: 212,
      height: 40,
      fill: '#e2e8f0',
    },
  }),
  text({
    style: {
      text: 'This line is fitted to its card',
      x: 252,
      y: 76,
      width: 196,
      fit: 'squish',
      font: '17px Arial',
      fill: '#c2410c',
    },
    key: 'squish',
  }),
  rect({
    style: {
      x: 24,
      y: 126,
      width: 206,
      height: 86,
      fill: '#dbeafe',
    },
  }),
  text({
    style: {
      text: state.updated ?
          'Updated words wrap across this bounded card' :
        'Several words wrap across this bounded card',
      x: 34,
      y: 136,
      width: 184,
      height: 64,
      lineHeight: 21,
      fit: 'ellipsis',
      wrap: true,
      font: '16px Arial',
      fill: '#1e3a8a',
    },
    key: 'wrapped',
  }),
  rect({
    style: {
      x: 254,
      y: 126,
      width: 202,
      height: 48,
      fill: '#fef3c7',
    },
  }),
  text({
    style: {
      text: 'Clipped text stays inside this golden card',
      x: 264,
      y: 136,
      width: 182,
      height: 28,
      fit: 'clip',
      font: '17px Arial',
      fill: '#92400e',
    },
    key: 'clipped',
  }),
  rect({
    style: {
      x: 254,
      y: 190,
      width: 202,
      height: 24,
      fill: '#ef4444',
    },
  }),
  text({
    style: {
      text: 'invisible at alpha zero',
      x: 264,
      y: 193,
      font: '16px Arial',
      fill: '#ffffff',
      opacity: 0,
    },
    key: 'zero-alpha',
  }),
]);

export function createDrawingTextScene(
  state: Readonly<DrawingTextState>,
  onCenteredText?: () => void,
): ReturnType<typeof DrawingTextScene> {
  return DrawingTextScene({ onCenteredText, state });
}
