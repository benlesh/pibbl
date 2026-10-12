import type { mouseContractScenarioEntry } from './catalog.js';
import type { mouseContractScenario } from './mouse-contract-scenario.js';
import type { PibblLogicalMouseEvent } from '@pibbl/core';
import type { MouseContractCase } from './mouse-contract';
import {
  Clip,
  Group,
  Layer,
  Line,
  Path,
  Rectangle,
  Text,
} from '@pibbl/core';
export const MOUSE_CONTRACT_SOURCE_ID = 'mouse-interaction-contract-example';
/**
 * Observable state exposed by the mouse contract scenario scenario for controls and assertions.
 *
 * @see {@link MouseContractCase}
 * @see {@link mouseContractScenarioEntry}
 * @see {@link mouseContractScenario}
 */
export interface MouseContractScenarioState {
  /** Case id recorded or configured by this scenario. See {@link MouseContractScenarioState}. */
  caseId: string;
  /**
   * Last action recorded or configured by this scenario. See {@link MouseContractScenarioState}.
   */
  lastAction: 'mount' | 'select' | 'reset';
  /**
   * Interaction count recorded or configured by this scenario. See
   * {@link MouseContractScenarioState}.
   */
  interactionCount: number;
  /**
   * Last interaction target recorded or configured by this scenario. See
   * {@link MouseContractScenarioState}.
   */
  lastInteractionTarget: string | null;
}
interface MouseContractSceneProps {
  contractCase: MouseContractCase;
  recordTarget?: (target: string) => void;
}
function caseVisual(
  contractCase: MouseContractCase,
  recordTarget: (target: string) => void,
) {
  const rectanglePath = (
    x: number,
    y: number,
    width: number,
    height: number,
  ) => {
    const path = new Path2D();
    path.rect(x, y, width, height);
    return path;
  };
  const interactive = (target: string) => ({
    cursor: 'crosshair',
    onMouseMove: (_event: PibblLogicalMouseEvent) => recordTarget(target),
  });
  const region = (
    target: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fillStyle: string,
  ) => (
    <Rectangle
      key={`region-${target}`}
      style={{
        left: x,
        top: y,
        width,
        height,
        fill: fillStyle,
        stroke: '#334155',
        strokeWidth: 2,
      }}
      {...interactive(target)}
    />
  );
  switch (contractCase.id) {
    case 'overlap-topmost':
      return [
        region('a', 88, 78, 190, 100, '#93c5fd'),
        region('top', 190, 96, 190, 100, '#7c3aed'),
        <Text
          pointerEvents="none"
          style={{
            left: 214,
            top: 126,
            font: '700 14px Arial',
            fill: '#fff',
          }}
        >
          {'later-painted top'}
        </Text>,
      ];
    case 'nested-child':
      return [
        <Group
          style={{
            translateX: 90,
            translateY: 30,
          }}
          key="translated-group"
        >
          <Rectangle
            pointerEvents="none"
            style={{
              left: 42,
              top: 45,
              width: 190,
              height: 120,
              fill: '#dbeafe',
            }}
          />
          {region('child', 70, 70, 100, 72, '#2563eb')}
          <Text
            pointerEvents="none"
            style={{
              left: 84,
              top: 100,
              font: '700 15px Arial',
              fill: '#fff',
            }}
          >
            {'child'}
          </Text>
        </Group>,
      ];
    case 'clip-intersection-miss': {
      const outerClip = new Path2D();
      outerClip.rect(145, 72, 190, 118);
      const innerClip = new Path2D();
      innerClip.rect(178, 94, 92, 76);
      return [
        <Clip
          style={{
            d: outerClip,
          }}
        >
          <Clip
            style={{
              d: innerClip,
            }}
          >
            {region('a', 132, 62, 220, 138, '#2563eb')}
          </Clip>
        </Clip>,
        <Text
          pointerEvents="none"
          style={{
            left: 286,
            top: 132,
            font: '700 13px Arial',
            fill: '#b91c1c',
          }}
        >
          {'× outside inner clip'}
        </Text>,
      ];
    }
    case 'transformed-hit':
      return [
        <Group
          style={{
            scaleX: 1.2,
            scaleY: 1.1,
            translateX: 180,
            translateY: 20,
          }}
          key="scaled-translated-group"
        >
          {region('a', 60, 80, 104, 60, '#2563eb')}
        </Group>,
        <Text
          pointerEvents="none"
          style={{
            left: 96,
            top: 136,
            font: '13px Arial',
            fill: '#64748b',
          }}
        >
          {'local shape'}
        </Text>,
        <Line
          pointerEvents="none"
          style={{
            coords: [
              [158, 132],
              [278, 132],
            ],
            stroke: '#94a3b8',
            strokeWidth: 1,
          }}
        />,
      ];
    case 'later-layer-topmost':
      return [
        region('a', 112, 76, 190, 112, '#93c5fd'),
        <Layer key="later-layer">
          {region('layer', 198, 96, 180, 94, '#f59e0b')}
        </Layer>,
        <Text
          pointerEvents="none"
          style={{
            left: 218,
            top: 126,
            font: '700 14px Arial',
            fill: '#422006',
          }}
        >
          {'later layer'}
        </Text>,
      ];
    case 'css-scaled-coordinates':
      return [
        region('a', 150, 88, 180, 88, '#2563eb'),
        <Line
          pointerEvents="none"
          style={{
            coords: [
              [150, 188],
              [330, 188],
            ],
            stroke: '#64748b',
            strokeWidth: 1,
          }}
        />,
        <Text
          pointerEvents="none"
          style={{
            left: 173,
            top: 122,
            font: '700 14px Arial',
            fill: '#fff',
          }}
        >
          {'intrinsic 180 × 88'}
        </Text>,
        <Text
          pointerEvents="none"
          style={{
            left: 166,
            top: 207,
            font: '13px Arial',
            fill: '#475569',
          }}
        >
          {'CSS pixels → intrinsic coordinates'}
        </Text>,
      ];
    case 'fill-hit':
      return [region('a', 72, 72, 190, 112, '#2563eb')];
    case 'stroke-hit':
      return [
        <Line
          key="stroke-region-a"
          style={{
            coords: [
              [78, 76],
              [264, 76],
              [264, 188],
              [78, 188],
              [78, 76],
            ],
            stroke: '#2563eb',
            strokeWidth: 6,
            lineInteractionWidth: 12,
          }}
          {...interactive('a')}
        />,
        <Text
          pointerEvents="none"
          style={{
            left: 116,
            top: 136,
            font: '700 15px Arial',
            fill: '#1e3a8a',
          }}
        >
          {'stroke only'}
        </Text>,
      ];
    case 'fill-stroke-hit':
      return [
        <Path
          key="fill-stroke-region-a"
          style={{
            d: rectanglePath(72, 72, 190, 112),
            fill: '#93c5fd',
            stroke: '#1d4ed8',
            strokeWidth: 6,
            lineInteractionWidth: 6,
          }}
          {...interactive('a')}
        />,
      ];
    case 'transparent-fill-hit':
      return [
        <Rectangle
          pointerEvents="none"
          style={{
            left: 72,
            top: 72,
            width: 190,
            height: 112,
            fill: '#e2e8f0',
          }}
        />,
        <Line
          pointerEvents="none"
          style={{
            coords: [
              [72, 72],
              [262, 184],
            ],
            stroke: '#cbd5e1',
            strokeWidth: 1,
          }}
        />,
        <Line
          pointerEvents="none"
          style={{
            coords: [
              [262, 72],
              [72, 184],
            ],
            stroke: '#cbd5e1',
            strokeWidth: 1,
          }}
        />,
        <Rectangle
          key="transparent-fill-region-a"
          style={{
            left: 72,
            top: 72,
            width: 190,
            height: 112,
            fill: 'rgba(37, 99, 235, 0)',
          }}
          {...interactive('a')}
        />,
        <Text
          pointerEvents="none"
          style={{
            left: 94,
            top: 136,
            font: '700 14px Arial',
            fill: '#1e3a8a',
          }}
        >
          {'transparent fill hit area'}
        </Text>,
      ];
    case 'line-interaction-width-hit':
    case 'line-interaction-width-miss':
      return [
        <Line
          key="expanded-line-a"
          style={{
            coords: [
              [90, 132],
              [390, 132],
            ],
            stroke: '#2563eb',
            strokeWidth: 2,
            lineInteractionWidth: 24,
          }}
          {...interactive('a')}
        />,
        <Line
          pointerEvents="none"
          style={{
            coords: [
              [90, 120],
              [390, 120],
            ],
            stroke: '#bfdbfe',
            strokeWidth: 1,
          }}
        />,
        <Line
          pointerEvents="none"
          style={{
            coords: [
              [90, 144],
              [390, 144],
            ],
            stroke: '#bfdbfe',
            strokeWidth: 1,
          }}
        />,
        <Text
          pointerEvents="none"
          style={{
            left: 126,
            top: 104,
            font: '13px Arial',
            fill: '#475569',
          }}
        >
          {'24px interaction stroke'}
        </Text>,
      ];
    case 'remove-target-during-press':
    case 'remove-target-during-move-plan':
      return [
        <Rectangle
          pointerEvents="none"
          style={{
            left: 72,
            top: 72,
            width: 190,
            height: 112,
            stroke: '#94a3b8',
            strokeWidth: 2,
          }}
        />,
        <Line
          pointerEvents="none"
          style={{
            coords: [
              [72, 72],
              [262, 184],
            ],
            stroke: '#ef4444',
            strokeWidth: 4,
          }}
        />,
        <Line
          pointerEvents="none"
          style={{
            coords: [
              [262, 72],
              [72, 184],
            ],
            stroke: '#ef4444',
            strokeWidth: 4,
          }}
        />,
        <Text
          pointerEvents="none"
          style={{
            left: 102,
            top: 136,
            font: '700 15px Arial',
            fill: '#991b1b',
          }}
        >
          {'target removed'}
        </Text>,
      ];
    default: {
      const selectedA = ['a', 'child'].includes(contractCase.visualTarget);
      const selectedB = ['b', 'layer', 'top'].includes(
        contractCase.visualTarget,
      );
      return [
        region('a', 72, 68, 190, 112, selectedA ? '#2563eb' : '#93c5fd'),
        region('b', 278, 86, 118, 100, selectedB ? '#7c3aed' : '#c4b5fd'),
        <Text
          pointerEvents="none"
          style={{
            left: 94,
            top: 100,
            font: '700 18px Arial',
            fill: '#fff',
          }}
        >
          {'A'}
        </Text>,
        <Text
          pointerEvents="none"
          style={{
            left: 300,
            top: 118,
            font: '700 18px Arial',
            fill: '#fff',
          }}
        >
          {'B'}
        </Text>,
      ];
    }
  }
}
const MouseContractScene = ({
  contractCase,
  recordTarget,
}: MouseContractSceneProps) => {
  const record = recordTarget ?? (() => undefined);
  const probe = contractCase.visualProbe;
  return [
    <Rectangle
      key="background"
      pointerEvents="none"
      style={{
        left: 0,
        top: 0,
        width: 480,
        height: 240,
        fill: '#f8fafc',
      }}
    />,
    <Text
      pointerEvents="none"
      style={{
        left: 24,
        top: 28,
        font: '700 17px Arial',
        fill: '#0f172a',
      }}
      key="title"
    >
      {contractCase.title}
    </Text>,
    ...caseVisual(contractCase, record),
    <Line
      key="probe-horizontal"
      pointerEvents="none"
      style={{
        coords: [
          [probe.x - 6, probe.y],
          [probe.x + 6, probe.y],
        ],
        stroke: '#dc2626',
        strokeWidth: 2,
      }}
    />,
    <Line
      key="probe-vertical"
      pointerEvents="none"
      style={{
        coords: [
          [probe.x, probe.y - 6],
          [probe.x, probe.y + 6],
        ],
        stroke: '#dc2626',
        strokeWidth: 2,
      }}
    />,
    <Text
      pointerEvents="none"
      style={{
        left: 24,
        top: 224,
        font: '13px Arial',
        fill: '#334155',
      }}
      key="approved-target"
    >{`approved target: ${probe.expectedTarget ?? 'none'}`}</Text>,
  ];
};
export function createMouseContractScene(
  contractCase: MouseContractCase,
  recordTarget?: (target: string) => void,
) {
  return (
    <MouseContractScene
      contractCase={contractCase}
      recordTarget={recordTarget}
    />
  );
}
