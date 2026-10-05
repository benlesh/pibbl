import type { drawingTextScenarioEntry } from './catalog.js';
import { Rectangle, Text } from '@pibbl/core';
export const DRAWING_TEXT_SOURCE_ID = 'drawing-text-example';
/**
 * Actions supported by the drawing text scenario's public controller.
 *
 * @see {@link DrawingTextState}
 */
export type DrawingTextAction =
  'click-centered' | 'mount' | 'reset' | 'update-copy';
/**
 * Observable state exposed by the drawing text scenario for controls and assertions.
 *
 * @see {@link DrawingTextAction}
 * @see {@link drawingTextScenarioEntry}
 */
export interface DrawingTextState {
  /** Centered clicks recorded or configured by this scenario. See {@link DrawingTextState}. */
  centeredClicks: number;
  /** Last action recorded or configured by this scenario. See {@link DrawingTextAction}. */
  lastAction: DrawingTextAction;
  /** Revision recorded or configured by this scenario. See {@link DrawingTextState}. */
  revision: number;
  /** Updated recorded or configured by this scenario. See {@link DrawingTextState}. */
  updated: boolean;
}
interface DrawingTextSceneProps {
  onCenteredText?: () => void;
  state: Readonly<DrawingTextState>;
}
const DrawingTextScene = ({ onCenteredText, state }: DrawingTextSceneProps) => [
  <Rectangle
    style={{
      left: 0,
      top: 0,
      width: 480,
      height: 240,
      fill: '#f8fafc',
    }}
  />,
  <Text
    style={{
      left: 24,
      top: 18,
      font: '700 24px Arial',
      fill: state.updated ? '#7c3aed' : '#0f172a',
    }}
    key="heading"
  >
    {state.updated ? 'Updated canvas text' : 'Canvas text'}
  </Text>,
  <Text
    style={{
      left: 374,
      top: 24,
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
      left: 24,
      top: 68,
      width: 172,
      height: 40,
      fill: '#e2e8f0',
    }}
  />,
  <Text
    style={{
      left: 32,
      top: 76,
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
      left: 244,
      top: 68,
      width: 212,
      height: 40,
      fill: '#e2e8f0',
    }}
  />,
  <Text
    style={{
      left: 252,
      top: 76,
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
      left: 24,
      top: 126,
      width: 206,
      height: 86,
      fill: '#dbeafe',
    }}
  />,
  <Text
    style={{
      left: 34,
      top: 136,
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
      left: 254,
      top: 126,
      width: 202,
      height: 48,
      fill: '#fef3c7',
    }}
  />,
  <Text
    style={{
      left: 264,
      top: 136,
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
      left: 254,
      top: 190,
      width: 202,
      height: 24,
      fill: '#ef4444',
    }}
  />,
  <Text
    style={{
      left: 264,
      top: 193,
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
