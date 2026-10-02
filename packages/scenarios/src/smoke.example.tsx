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
        left: 0,
        top: 0,
        width: 480,
        height: 240,
        fill: '#f8fafc',
      }}
    />,
    <Rectangle
      style={{
        left: 28,
        top: 48,
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
        left: 48,
        top: 78,
        font: '700 16px Arial',
        fill: '#ffffff',
      }}
    >
      {'CRC smoke scenario'}
    </Text>,
    <Text
      style={{
        left: 48,
        top: 116,
        font: '14px Arial',
        fill: '#ffffff',
      }}
    >{`revision ${state.revision} · clicks ${state.clicks}`}</Text>,
    <Text
      style={{
        left: 248,
        top: 62,
        font: '700 16px Arial',
        fill: '#0f172a',
      }}
    >
      {'Public API smoke'}
    </Text>,
    <Text
      style={{
        left: 248,
        top: 94,
        font: '14px Arial',
        fill: '#334155',
      }}
    >{`last action: ${state.lastAction}`}</Text>,
    <Text
      style={{
        left: 248,
        top: 122,
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
