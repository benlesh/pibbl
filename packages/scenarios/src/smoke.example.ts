import { defineComp, rect, text } from '@crc/core';

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

const SmokeScene = defineComp<SmokeSceneProps>(({ state, onClick }) => {
  const fillStyle = state.lastAction === 'click' ?
    '#ea580c' :
    state.revision > 0 ?
      '#7c3aed' :
      '#2563eb';

  return [
    rect({
      x: 0,
      y: 0,
      width: 480,
      height: 240,
      fillStyle: '#f8fafc',
    }),
    rect({
      x: 28,
      y: 48,
      width: 188,
      height: 120,
      fillStyle,
      strokeStyle: '#0f172a',
      lineWidth: 2,
      onClick,
    }),
    text({
      x: 48,
      y: 78,
      text: 'CRC smoke scenario',
      font: '700 16px Arial',
      fillStyle: '#ffffff',
    }),
    text({
      x: 48,
      y: 116,
      text: `revision ${state.revision} · clicks ${state.clicks}`,
      font: '14px Arial',
      fillStyle: '#ffffff',
    }),
    text({
      x: 248,
      y: 62,
      text: 'Public API smoke',
      font: '700 16px Arial',
      fillStyle: '#0f172a',
    }),
    text({
      x: 248,
      y: 94,
      text: `last action: ${state.lastAction}`,
      font: '14px Arial',
      fillStyle: '#334155',
    }),
    text({
      x: 248,
      y: 122,
      text: 'update · click · reset',
      font: '14px Arial',
      fillStyle: '#475569',
    }),
  ];
});

export function createSmokeScene(props: SmokeSceneProps): ReturnType<typeof SmokeScene> {
  return SmokeScene(props);
}
