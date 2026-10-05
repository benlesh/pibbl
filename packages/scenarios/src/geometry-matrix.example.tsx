import type { geometryMatrixScenarioEntry } from './catalog.js';
import type { CRCKey, CRCLogicalMouseEvent } from '@crc/core';
import type {
  EventTraceEntry,
  EventTraceInput,
  TraceEventType,
} from './event-trace';
import { Clip, Group, Layer, Line, Rectangle } from '@crc/core';
export const GEOMETRY_MATRIX_SOURCE_ID = 'geometry-composition-matrix-example';
const BACKGROUND = [248, 250, 252, 255] as const;
const BLUE = [37, 99, 235, 255] as const;
const GREEN = [16, 185, 129, 255] as const;
const ORANGE = [245, 158, 11, 255] as const;
const PURPLE = [124, 58, 237, 255] as const;
const SKY = [147, 197, 253, 255] as const;
/**
 * A logical coordinate pair used by the geometry matrix scenario.
 *
 * @see {@link GeometryMatrixProbe}
 */
export interface GeometryMatrixPoint {
  /** X recorded or configured by this scenario. See {@link GeometryMatrixPoint}. */
  x: number;
  /** Y recorded or configured by this scenario. See {@link GeometryMatrixPoint}. */
  y: number;
}
/**
 * A logical probe point and its expected geometry-matrix observation.
 *
 * @see {@link GeometryMatrixPoint}
 * @see {@link GeometryMatrixCase}
 */
export interface GeometryMatrixProbe {
  /** Id recorded or configured by this scenario. See {@link GeometryMatrixProbe}. */
  id: string;
  /** Point recorded or configured by this scenario. See {@link GeometryMatrixPoint}. */
  point: GeometryMatrixPoint;
  /** Expected target recorded or configured by this scenario. See {@link GeometryMatrixProbe}. */
  expectedTarget: string | null;
  /** Expected pixel recorded or configured by this scenario. See {@link GeometryMatrixProbe}. */
  expectedPixel: readonly [number, number, number, number];
}
/**
 * A drawing fixture with expected logical geometry and probe locations.
 *
 * @see {@link GeometryMatrixProbe}
 * @see {@link GEOMETRY_MATRIX_CASES}
 */
export interface GeometryMatrixCase {
  /** Id recorded or configured by this scenario. See {@link GeometryMatrixCase}. */
  id: string;
  /** Title recorded or configured by this scenario. See {@link GeometryMatrixCase}. */
  title: string;
  /** Css size recorded or configured by this scenario. See {@link GeometryMatrixCase}. */
  cssSize: {
    /** Width recorded or configured by this scenario. See {@link GeometryMatrixCase}. */
    width: number;
    /** Height recorded or configured by this scenario. See {@link GeometryMatrixCase}. */
    height: number;
  };
  /** Contract case ids recorded or configured by this scenario. See {@link GeometryMatrixCase}. */
  contractCaseIds: readonly string[];
  /** Probes recorded or configured by this scenario. See {@link GeometryMatrixProbe}. */
  probes: readonly GeometryMatrixProbe[];
}
/**
 * Geometry fixtures and probe expectations used by the drawing matrix lab.
 *
 * @see {@link GeometryMatrixCase}
 */
export const GEOMETRY_MATRIX_CASES = [
  {
    id: 'root-fill',
    title: 'Root fill boundaries',
    cssSize: {
      width: 480,
      height: 240,
    },
    contractCaseIds: [],
    probes: [
      {
        id: 'center',
        point: {
          x: 240,
          y: 120,
        },
        expectedTarget: 'fill',
        expectedPixel: BLUE,
      },
      {
        id: 'boundary',
        point: {
          x: 160,
          y: 120,
        },
        expectedTarget: 'fill',
        expectedPixel: BLUE,
      },
      {
        id: 'outside',
        point: {
          x: 158,
          y: 120,
        },
        expectedTarget: null,
        expectedPixel: BACKGROUND,
      },
    ],
  },
  {
    id: 'css-scaled-fill',
    title: 'CSS-scaled fill boundaries',
    cssSize: {
      width: 240,
      height: 120,
    },
    contractCaseIds: ['css-scaled-coordinates'],
    probes: [
      {
        id: 'center',
        point: {
          x: 240,
          y: 120,
        },
        expectedTarget: 'fill',
        expectedPixel: BLUE,
      },
      {
        id: 'boundary',
        point: {
          x: 160,
          y: 120,
        },
        expectedTarget: 'fill',
        expectedPixel: BLUE,
      },
      {
        id: 'outside',
        point: {
          x: 158,
          y: 120,
        },
        expectedTarget: null,
        expectedPixel: BACKGROUND,
      },
    ],
  },
  {
    id: 'compound-transform-clip',
    title: 'Nested compound transform with clip',
    cssSize: {
      width: 480,
      height: 240,
    },
    contractCaseIds: ['nested-child', 'transformed-hit'],
    probes: [
      {
        id: 'visible-center',
        point: {
          x: 120,
          y: 70,
        },
        expectedTarget: 'transformed',
        expectedPixel: BLUE,
      },
      {
        id: 'clipped-target',
        point: {
          x: 120,
          y: 45,
        },
        expectedTarget: null,
        expectedPixel: BACKGROUND,
      },
      {
        id: 'outside',
        point: {
          x: 180,
          y: 70,
        },
        expectedTarget: null,
        expectedPixel: BACKGROUND,
      },
    ],
  },
  {
    id: 'nested-clip-intersection',
    title: 'Nested clip intersection and evenodd hole',
    cssSize: {
      width: 480,
      height: 240,
    },
    contractCaseIds: ['clip-intersection-miss'],
    probes: [
      {
        id: 'intersection',
        point: {
          x: 150,
          y: 85,
        },
        expectedTarget: 'clipped',
        expectedPixel: BLUE,
      },
      {
        id: 'outer-only',
        point: {
          x: 80,
          y: 120,
        },
        expectedTarget: null,
        expectedPixel: BACKGROUND,
      },
      {
        id: 'inner-only',
        point: {
          x: 340,
          y: 120,
        },
        expectedTarget: null,
        expectedPixel: BACKGROUND,
      },
      {
        id: 'evenodd-hole',
        point: {
          x: 230,
          y: 120,
        },
        expectedTarget: null,
        expectedPixel: BACKGROUND,
      },
    ],
  },
  {
    id: 'layer-paint-order',
    title: 'Root and sibling layer paint order',
    cssSize: {
      width: 480,
      height: 240,
    },
    contractCaseIds: ['later-layer-topmost'],
    probes: [
      {
        id: 'root-under',
        point: {
          x: 50,
          y: 120,
        },
        expectedTarget: 'root-under',
        expectedPixel: SKY,
      },
      {
        id: 'layer-one',
        point: {
          x: 120,
          y: 120,
        },
        expectedTarget: 'layer-one',
        expectedPixel: ORANGE,
      },
      {
        id: 'root-middle',
        point: {
          x: 260,
          y: 120,
        },
        expectedTarget: 'root-middle',
        expectedPixel: PURPLE,
      },
      {
        id: 'layer-two',
        point: {
          x: 350,
          y: 120,
        },
        expectedTarget: 'layer-two',
        expectedPixel: GREEN,
      },
    ],
  },
  {
    id: 'transformed-nested-layer',
    title: 'Transformed custom-size nested layer',
    cssSize: {
      width: 480,
      height: 240,
    },
    contractCaseIds: [],
    probes: [
      {
        id: 'nested',
        point: {
          x: 150,
          y: 60,
        },
        expectedTarget: 'nested-layer',
        expectedPixel: GREEN,
      },
      {
        id: 'cropped-nested',
        point: {
          x: 190,
          y: 70,
        },
        expectedTarget: 'layer-base',
        expectedPixel: ORANGE,
      },
      {
        id: 'base',
        point: {
          x: 210,
          y: 100,
        },
        expectedTarget: 'layer-base',
        expectedPixel: ORANGE,
      },
      {
        id: 'untransformed-location',
        point: {
          x: 50,
          y: 50,
        },
        expectedTarget: null,
        expectedPixel: BACKGROUND,
      },
    ],
  },
  {
    id: 'stroke-boundary',
    title: 'Transformed stroke interaction boundary',
    cssSize: {
      width: 480,
      height: 240,
    },
    contractCaseIds: [],
    probes: [
      {
        id: 'painted-center',
        point: {
          x: 240,
          y: 120,
        },
        expectedTarget: 'stroke',
        expectedPixel: BLUE,
      },
      {
        id: 'interaction-boundary',
        point: {
          x: 240,
          y: 110,
        },
        expectedTarget: 'stroke',
        expectedPixel: BACKGROUND,
      },
      {
        id: 'outside',
        point: {
          x: 240,
          y: 109,
        },
        expectedTarget: null,
        expectedPixel: BACKGROUND,
      },
    ],
  },
] as const satisfies readonly GeometryMatrixCase[];
/**
 * A stable identifier of a geometry-matrix fixture.
 *
 * @see {@link GeometryMatrixAction}
 * @see {@link GeometryMatrixState}
 */
export type GeometryMatrixCaseId = (typeof GEOMETRY_MATRIX_CASES)[number]['id'];
/**
 * Actions supported by the geometry matrix scenario's public controller.
 *
 * @see {@link GeometryMatrixCaseId}
 * @see {@link GeometryMatrixState}
 */
export type GeometryMatrixAction =
  'clear-trace' | 'mount' | 'reset' | `show-${GeometryMatrixCaseId}`;
/**
 * Observable state exposed by the geometry matrix scenario for controls and assertions.
 *
 * @see {@link GeometryMatrixCaseId}
 * @see {@link GeometryMatrixAction}
 * @see {@link EventTraceEntry}
 * @see {@link geometryMatrixScenarioEntry}
 */
export interface GeometryMatrixState {
  /** Case id recorded or configured by this scenario. See {@link GeometryMatrixCaseId}. */
  caseId: GeometryMatrixCaseId;
  /** Css height recorded or configured by this scenario. See {@link GeometryMatrixState}. */
  cssHeight: number;
  /** Css width recorded or configured by this scenario. See {@link GeometryMatrixState}. */
  cssWidth: number;
  /** Last action recorded or configured by this scenario. See {@link GeometryMatrixAction}. */
  lastAction: GeometryMatrixAction;
  /** Last coordinates recorded or configured by this scenario. See {@link GeometryMatrixState}. */
  lastCoordinates: readonly [number, number] | null;
  /** Last target recorded or configured by this scenario. See {@link GeometryMatrixState}. */
  lastTarget: string | null;
  /** Trace recorded or configured by this scenario. See {@link EventTraceEntry}. */
  trace: readonly EventTraceEntry[];
}
export interface GeometryMatrixRecord {
  (input: EventTraceInput): void;
}
interface GeometryMatrixSceneProps {
  caseId: GeometryMatrixCaseId;
  record: GeometryMatrixRecord;
}
type TraceHandlers = {
  onClick: (event: CRCLogicalMouseEvent) => void;
  onContextMenu: (event: CRCLogicalMouseEvent) => void;
  onDblClick: (event: CRCLogicalMouseEvent) => void;
  onMouseDown: (event: CRCLogicalMouseEvent) => void;
  onMouseMove: (event: CRCLogicalMouseEvent) => void;
  onMouseOut: (event: CRCLogicalMouseEvent) => void;
  onMouseOver: (event: CRCLogicalMouseEvent) => void;
  onMouseUp: (event: CRCLogicalMouseEvent) => void;
};
function traceHandlers(
  target: string,
  record: GeometryMatrixRecord,
): TraceHandlers {
  const handler = (type: TraceEventType) => (event: CRCLogicalMouseEvent) => {
    record({
      source: 'crc',
      type,
      target,
      x: Math.round(event.x),
      y: Math.round(event.y),
      event: event.originalEvent,
      relatedTarget: null,
    });
  };
  return {
    onClick: handler('click'),
    onContextMenu: handler('contextmenu'),
    onDblClick: handler('dblclick'),
    onMouseDown: handler('mousedown'),
    onMouseMove: handler('mousemove'),
    onMouseOut: handler('mouseout'),
    onMouseOver: handler('mouseover'),
    onMouseUp: handler('mouseup'),
  };
}
function interactiveRect(
  target: string,
  record: GeometryMatrixRecord,
  options: Parameters<typeof Rectangle>[0] & { key?: CRCKey },
) {
  return (
    <Rectangle
      {...options}
      {...traceHandlers(target, record)}
      style={options.style}
    />
  );
}
function rootFill(record: GeometryMatrixRecord) {
  return interactiveRect('fill', record, {
    key: 'root-fill',
    style: {
      left: 160,
      top: 80,
      width: 160,
      height: 80,
      fill: '#2563eb',
      cursor: 'pointer',
    },
  });
}
function compoundTransformClip(record: GeometryMatrixRecord) {
  const clipPath = new Path2D();
  clipPath.rect(0, 0, 40, 20);
  return (
    <Group
      style={{
        scaleX: 2,
        scaleY: 1,
        translateX: 80,
        translateY: 20,
      }}
      key="outer-transform"
    >
      <Group
        style={{
          rotationDegrees: 90,
          translateX: 20,
          translateY: 10,
          skewX: 45,
        }}
        key="inner-transform"
      >
        <Clip
          style={{
            d: clipPath,
          }}
        >
          {interactiveRect('transformed', record, {
            key: 'transformed-target',
            style: {
              left: -10,
              top: -10,
              width: 60,
              height: 40,
              fill: '#2563eb',
              cursor: 'pointer',
            },
          })}
        </Clip>
      </Group>
    </Group>
  );
}
function nestedClipIntersection(record: GeometryMatrixRecord) {
  const outerClip = new Path2D();
  outerClip.rect(60, 50, 240, 150);
  const innerClip = new Path2D();
  innerClip.rect(120, 70, 260, 110);
  innerClip.rect(190, 95, 80, 60);
  return (
    <Clip
      style={{
        d: outerClip,
      }}
    >
      <Clip
        style={{
          d: innerClip,
          fillRule: 'evenodd',
        }}
      >
        <Group
          style={{
            translateX: 20,
          }}
          key="group-inside-clips"
        >
          {interactiveRect('clipped', record, {
            key: 'clipped-target',
            style: {
              left: 0,
              top: 0,
              width: 380,
              height: 240,
              fill: '#2563eb',
              cursor: 'pointer',
            },
          })}
        </Group>
      </Clip>
    </Clip>
  );
}
function layerPaintOrder(record: GeometryMatrixRecord) {
  return [
    interactiveRect('root-under', record, {
      key: 'root-under',
      style: {
        left: 20,
        top: 60,
        width: 430,
        height: 120,
        fill: '#93c5fd',
        cursor: 'default',
      },
    }),
    <Layer key="layer-one">
      {interactiveRect('layer-one', record, {
        key: 'layer-one-target',
        style: {
          left: 80,
          top: 60,
          width: 280,
          height: 120,
          fill: '#f59e0b',
          cursor: 'pointer',
        },
      })}
    </Layer>,
    interactiveRect('root-middle', record, {
      key: 'root-middle',
      style: {
        left: 230,
        top: 60,
        width: 160,
        height: 120,
        fill: '#7c3aed',
        cursor: 'crosshair',
      },
    }),
    <Layer key="layer-two">
      {interactiveRect('layer-two', record, {
        key: 'layer-two-target',
        style: {
          left: 320,
          top: 60,
          width: 130,
          height: 120,
          fill: '#10b981',
          cursor: 'grab',
        },
      })}
    </Layer>,
  ];
}
function transformedNestedLayer(record: GeometryMatrixRecord) {
  return (
    <Group
      style={{
        translateX: 100,
        translateY: 30,
      }}
      key="translated-layer-group"
    >
      <Layer
        style={{
          width: 160,
          height: 120,
        }}
        key="outer-custom-layer"
      >
        <Group key="outer-layer-content">
          {interactiveRect('layer-base', record, {
            key: 'layer-base-target',
            style: {
              left: 0,
              top: 0,
              width: 160,
              height: 120,
              fill: '#f59e0b',
              cursor: 'crosshair',
            },
          })}
          <Layer
            style={{
              width: 80,
              height: 60,
            }}
            key="nested-custom-layer"
          >
            {interactiveRect('nested-layer', record, {
              key: 'nested-layer-target',
              style: {
                left: 20,
                top: 10,
                width: 80,
                height: 60,
                fill: '#10b981',
                cursor: 'pointer',
              },
            })}
          </Layer>
        </Group>
      </Layer>
    </Group>
  );
}
function strokeBoundary(record: GeometryMatrixRecord) {
  return [
    <Group
      style={{
        scaleY: 2,
      }}
      key="scaled-stroke-group"
    >
      <Line
        key="stroke-target"
        style={{
          coords: [
            [80, 60],
            [400, 60],
          ],
          stroke: '#2563eb',
          strokeWidth: 2,
          lineInteractionWidth: 10,
          cursor: 'pointer',
        }}
        {...traceHandlers('stroke', record)}
      />
    </Group>,
  ];
}
function caseVisual(
  caseId: GeometryMatrixCaseId,
  record: GeometryMatrixRecord,
) {
  switch (caseId) {
    case 'root-fill':
    case 'css-scaled-fill':
      return [rootFill(record)];
    case 'compound-transform-clip':
      return [compoundTransformClip(record)];
    case 'nested-clip-intersection':
      return [nestedClipIntersection(record)];
    case 'layer-paint-order':
      return layerPaintOrder(record);
    case 'transformed-nested-layer':
      return [transformedNestedLayer(record)];
    case 'stroke-boundary':
      return strokeBoundary(record);
  }
}
const GeometryMatrixScene = ({ caseId, record }: GeometryMatrixSceneProps) => [
  <Rectangle
    key="background"
    style={{
      left: 0,
      top: 0,
      width: 480,
      height: 240,
      fill: '#f8fafc',
    }}
  />,
  ...caseVisual(caseId, record),
];
export function createGeometryMatrixScene(props: GeometryMatrixSceneProps) {
  return <GeometryMatrixScene {...props} />;
}
