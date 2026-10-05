import type { smokeScenarioEntry } from './catalog.js';
import type { smokeScenario } from './smoke.js';
import { Rectangle, Text } from '@crc/core';
export const SMOKE_SOURCE_ID = 'baseline-smoke-example';
/**
 * Actions supported by the smoke scenario scenario's public controller.
 *
 * @see {@link SmokeScenarioState}
 */
export type SmokeScenarioAction = 'mount' | 'update' | 'click' | 'reset';
/**
 * Observable state exposed by the smoke scenario scenario for controls and assertions.
 *
 * @see {@link SmokeScenarioAction}
 * @see {@link smokeScenarioEntry}
 * @see {@link smokeScenario}
 */
export interface SmokeScenarioState {
  /** Revision recorded or configured by this scenario. See {@link SmokeScenarioState}. */
  revision: number;
  /** Clicks recorded or configured by this scenario. See {@link SmokeScenarioState}. */
  clicks: number;
  /** Last action recorded or configured by this scenario. See {@link SmokeScenarioAction}. */
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
