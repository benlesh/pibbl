import { Rectangle, Text } from '@crc/core';
export const DRAWING_TEXT_SOURCE_ID = 'drawing-text-example';
export type DrawingTextAction =
  'click-centered' | 'mount' | 'reset' | 'update-copy';
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
const DrawingTextScene = ({ onCenteredText, state }: DrawingTextSceneProps) => [
  <Rectangle
    style={{
      x: 0,
      y: 0,
      width: 480,
      height: 240,
      fill: '#f8fafc',
    }}
  />,
  <Text
    style={{
      x: 24,
      y: 18,
      font: '700 24px Arial',
      fill: state.updated ? '#7c3aed' : '#0f172a',
    }}
    key="heading"
  >
    {state.updated ? 'Updated canvas text' : 'Canvas text'}
  </Text>,
  <Text
    style={{
      x: 374,
      y: 24,
      font: '18px Arial',
      textAlign: 'center',
      textBaseline: 'middle',
      fill: '#0f766e',
      cursor: 'pointer',
    }}
    key="centered"
    onClick={onCenteredText}
  >
    {'centered'}
  </Text>,
  <Rectangle
    style={{
      x: 24,
      y: 68,
      width: 172,
      height: 40,
      fill: '#e2e8f0',
    }}
  />,
  <Text
    style={{
      x: 32,
      y: 76,
      width: 154,
      fit: 'ellipsis',
      font: '17px Arial',
      fill: '#1d4ed8',
    }}
    key="ellipsis"
  >
    {state.updated ? 'A newly updated sentence' : 'A sentence that is too long'}
  </Text>,
  <Rectangle
    style={{
      x: 244,
      y: 68,
      width: 212,
      height: 40,
      fill: '#e2e8f0',
    }}
  />,
  <Text
    style={{
      x: 252,
      y: 76,
      width: 196,
      fit: 'squish',
      font: '17px Arial',
      fill: '#c2410c',
    }}
    key="squish"
  >
    {'This line is fitted to its card'}
  </Text>,
  <Rectangle
    style={{
      x: 24,
      y: 126,
      width: 206,
      height: 86,
      fill: '#dbeafe',
    }}
  />,
  <Text
    style={{
      x: 34,
      y: 136,
      width: 184,
      height: 64,
      lineHeight: 21,
      fit: 'ellipsis',
      wrap: true,
      font: '16px Arial',
      fill: '#1e3a8a',
    }}
    key="wrapped"
  >
    {state.updated
      ? 'Updated words wrap across this bounded card'
      : 'Several words wrap across this bounded card'}
  </Text>,
  <Rectangle
    style={{
      x: 254,
      y: 126,
      width: 202,
      height: 48,
      fill: '#fef3c7',
    }}
  />,
  <Text
    style={{
      x: 264,
      y: 136,
      width: 182,
      height: 28,
      fit: 'clip',
      font: '17px Arial',
      fill: '#92400e',
    }}
    key="clipped"
  >
    {'Clipped text stays inside this golden card'}
  </Text>,
  <Rectangle
    style={{
      x: 254,
      y: 190,
      width: 202,
      height: 24,
      fill: '#ef4444',
    }}
  />,
  <Text
    style={{
      x: 264,
      y: 193,
      font: '16px Arial',
      fill: '#ffffff',
      opacity: 0,
    }}
    key="zero-alpha"
  >
    {'invisible at alpha zero'}
  </Text>,
];
export function createDrawingTextScene(
  state: Readonly<DrawingTextState>,
  onCenteredText?: () => void,
) {
  return <DrawingTextScene onCenteredText={onCenteredText} state={state} />;
}
