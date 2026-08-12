import { defineComp, rect, text } from '@crc/core';

export const DRAWING_TEXT_SOURCE_ID = 'drawing-text-example';

export type DrawingTextAction = 'mount' | 'reset' | 'update-copy';

export interface DrawingTextState {
  lastAction: DrawingTextAction;
  revision: number;
  updated: boolean;
}

interface DrawingTextSceneProps {
  state: Readonly<DrawingTextState>;
}

const DrawingTextScene = defineComp<DrawingTextSceneProps>(({ state }) => [
  rect({ x: 0, y: 0, width: 480, height: 240, fillStyle: '#f8fafc' }),
  text({
    key: 'heading',
    text: state.updated ? 'Updated canvas text' : 'Canvas text',
    x: 24,
    y: 18,
    font: '700 24px Arial',
    fillStyle: state.updated ? '#7c3aed' : '#0f172a',
  }),
  text({
    key: 'centered',
    text: 'centered',
    x: 374,
    y: 24,
    font: '18px Arial',
    textAlign: 'center',
    fillStyle: '#0f766e',
  }),
  rect({ x: 24, y: 68, width: 172, height: 40, fillStyle: '#e2e8f0' }),
  text({
    key: 'ellipsis',
    text: state.updated ? 'A newly updated sentence' : 'A sentence that is too long',
    x: 32,
    y: 76,
    maxWidth: 154,
    overflow: 'ellipsis',
    font: '17px Arial',
    fillStyle: '#1d4ed8',
  }),
  rect({ x: 244, y: 68, width: 212, height: 40, fillStyle: '#e2e8f0' }),
  text({
    key: 'squish',
    text: 'This line is fitted to its card',
    x: 252,
    y: 76,
    maxWidth: 196,
    overflow: 'squish',
    font: '17px Arial',
    fillStyle: '#c2410c',
  }),
  rect({ x: 24, y: 126, width: 206, height: 86, fillStyle: '#dbeafe' }),
  text({
    key: 'wrapped',
    text: state.updated ?
        'Updated words wrap across this bounded card' :
      'Several words wrap across this bounded card',
    x: 34,
    y: 136,
    maxWidth: 184,
    maxHeight: 64,
    lineHeight: 21,
    overflow: 'ellipsis',
    wordWrap: true,
    font: '16px Arial',
    fillStyle: '#1e3a8a',
  }),
  rect({ x: 254, y: 126, width: 202, height: 48, fillStyle: '#fef3c7' }),
  text({
    key: 'clipped',
    text: 'Clipped text stays inside this golden card',
    x: 264,
    y: 136,
    maxWidth: 182,
    maxHeight: 28,
    overflow: 'clip',
    font: '17px Arial',
    fillStyle: '#92400e',
  }),
  rect({ x: 254, y: 190, width: 202, height: 24, fillStyle: '#ef4444' }),
  text({
    key: 'zero-alpha',
    text: 'invisible at alpha zero',
    x: 264,
    y: 193,
    font: '16px Arial',
    fillStyle: '#ffffff',
    alpha: 0,
  }),
]);

export function createDrawingTextScene(
  state: Readonly<DrawingTextState>,
): ReturnType<typeof DrawingTextScene> {
  return DrawingTextScene({ state });
}
