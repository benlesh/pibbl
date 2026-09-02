import { Rectangle, Text } from '@crc/core';
export const SMOKE_SOURCE_ID = 'baseline-smoke-example';
export type SmokeScenarioAction = 'mount' | 'update' | 'click' | 'reset';
export interface SmokeScenarioState {
  revision: number;
  clicks: number;
  lastAction: SmokeScenarioAction;
}
interface SmokeSceneProps {
  state: Readonly<SmokeScenarioState>;
  onClick: () => void;
}
const SmokeScene = ({ state, onClick }: SmokeSceneProps) => {
  const fillStyle =
    state.lastAction === 'click'
      ? '#ea580c'
      : state.revision > 0
        ? '#7c3aed'
        : '#2563eb';
  return [
    <Rectangle
      style={{
        x: 0,
        y: 0,
        width: 480,
        height: 240,
        fill: '#f8fafc',
      }}
    />,
    <Rectangle
      style={{
        x: 28,
        y: 48,
        width: 188,
        height: 120,
        fill: fillStyle,
        stroke: '#0f172a',
        strokeWidth: 2,
      }}
      onClick={onClick}
    />,
    <Text
      style={{
        x: 48,
        y: 78,
        font: '700 16px Arial',
        fill: '#ffffff',
      }}
    >
      {'CRC smoke scenario'}
    </Text>,
    <Text
      style={{
        x: 48,
        y: 116,
        font: '14px Arial',
        fill: '#ffffff',
      }}
    >{`revision ${state.revision} · clicks ${state.clicks}`}</Text>,
    <Text
      style={{
        x: 248,
        y: 62,
        font: '700 16px Arial',
        fill: '#0f172a',
      }}
    >
      {'Public API smoke'}
    </Text>,
    <Text
      style={{
        x: 248,
        y: 94,
        font: '14px Arial',
        fill: '#334155',
      }}
    >{`last action: ${state.lastAction}`}</Text>,
    <Text
      style={{
        x: 248,
        y: 122,
        font: '14px Arial',
        fill: '#475569',
      }}
    >
      {'update · click · reset'}
    </Text>,
  ];
};
export function createSmokeScene(props: SmokeSceneProps) {
  return <SmokeScene {...props} />;
}
