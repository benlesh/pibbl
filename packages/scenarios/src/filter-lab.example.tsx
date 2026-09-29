import {
  Circle,
  Clip,
  Group,
  Image,
  Layer,
  Rectangle,
  Text,
  type CRCFilter,
} from '@crc/core';

export const FILTER_LAB_SOURCE_ID = 'first-class-filters-laboratory-example';

export type FilterLabMode =
  | 'all'
  | 'ordered'
  | 'nested'
  | 'transformed'
  | 'clipped'
  | 'layered';

export type FilterLabOrder =
  | 'none'
  | 'grayscale-then-shadow'
  | 'shadow-then-grayscale'
  | 'inside-out';

export type FilterLabTarget = 'layered-source';

export interface FilterLabState {
  mode: FilterLabMode;
  order: FilterLabOrder;
  revision: number;
  lastTarget: FilterLabTarget | null;
}

export interface FilterLabPoint {
  x: number;
  y: number;
}

interface FilterLabProbes {
  opaque: FilterLabPoint;
  transparent: FilterLabPoint;
  shadow: FilterLabPoint;
}

export const FILTER_LAB_PROBES: Readonly<Record<FilterLabMode, FilterLabProbes>> & {
  readonly ordered: FilterLabProbes & { readonly orderSample: FilterLabPoint };
  readonly clipped: FilterLabProbes & { readonly visibleCenters: readonly FilterLabPoint[] };
  readonly layered: FilterLabProbes & {
    readonly source: FilterLabPoint;
    readonly shadowOnly: FilterLabPoint;
  };
} = {
  all: {
    opaque: { x: 42, y: 50 },
    transparent: { x: 470, y: 230 },
    shadow: { x: 17, y: 50 },
  },
  ordered: {
    opaque: { x: 130, y: 108 },
    transparent: { x: 36, y: 210 },
    shadow: { x: 198, y: 108 },
    orderSample: { x: 198, y: 108 },
  },
  nested: {
    opaque: { x: 116, y: 118 },
    transparent: { x: 36, y: 210 },
    shadow: { x: 171, y: 118 },
  },
  transformed: {
    opaque: { x: 110, y: 105 },
    transparent: { x: 36, y: 210 },
    shadow: { x: 157, y: 118 },
  },
  clipped: {
    opaque: { x: 55, y: 126 },
    transparent: { x: 16, y: 216 },
    shadow: { x: 418, y: 134 },
    visibleCenters: [{ x: 55, y: 126 }, { x: 215, y: 126 }, { x: 375, y: 126 }],
  },
  layered: {
    opaque: { x: 160, y: 115 },
    transparent: { x: 24, y: 216 },
    shadow: { x: 208, y: 115 },
    source: { x: 160, y: 115 },
    shadowOnly: { x: 208, y: 115 },
  },
};

export const FILTER_LAB_IMAGE_SOURCE = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18">
    <rect width="18" height="18" fill="#f8fafc"/>
    <path d="M2 15 L9 2 L16 15 Z" fill="#fb7185"/>
  </svg>
`)}`;

export type FilterLabRecordTarget = (target: FilterLabTarget) => void;

interface FilterLabSceneProps {
  state: Readonly<FilterLabState>;
  recordTarget: FilterLabRecordTarget;
}

const ALL_FILTERS: readonly { label: string; filter: CRCFilter }[] = [
  { label: 'blur', filter: { type: 'blur', radius: 3 } },
  { label: 'bright', filter: { type: 'brightness', amount: 1.5 } },
  { label: 'contrast', filter: { type: 'contrast', amount: 1.6 } },
  {
    label: 'shadow',
    filter: { type: 'dropShadow', offsetX: 5, offsetY: 4, blurRadius: 2, color: '#0f172a' },
  },
  { label: 'gray', filter: { type: 'grayscale', amount: 1 } },
  { label: 'hue', filter: { type: 'hueRotate', degrees: 120 } },
  { label: 'invert', filter: { type: 'invert', amount: 1 } },
  { label: 'opacity', filter: { type: 'opacity', amount: 0.55 } },
  { label: 'saturate', filter: { type: 'saturate', amount: 2 } },
  { label: 'sepia', filter: { type: 'sepia', amount: 1 } },
];

function label(text: string, x: number, y: number) {
  return <Text key={`${text}-${x}-${y}`} pointerEvents="none" style={{
    left: x,
    top: y,
    fill: '#0f172a',
    font: '600 9px monospace',
    textAlign: 'center',
  }}>{text}</Text>;
}

function tile(filter: CRCFilter, x: number, y: number, labelText: string) {
  return [
    <Group key={`tile-${labelText}`} style={{ filter }}>
      <Rectangle style={{ left: x, top: y, width: 48, height: 26, fill: '#2563eb' }} />
      <Circle style={{ cx: x + 32, cy: y + 13, radius: 10, fill: '#f7c948' }} />
      <Image style={{ src: FILTER_LAB_IMAGE_SOURCE, left: x + 4, top: y + 4, width: 18, height: 18 }} />
    </Group>,
    label(labelText, x + 24, y + 40),
  ];
}

function allFiltersScene() {
  return ALL_FILTERS.flatMap((entry, index) => {
    const column = index % 5;
    const row = Math.floor(index / 5);
    return tile(entry.filter, 18 + column * 94, 28 + row * 98, entry.label);
  });
}

const ORDERED_SHADOW: CRCFilter = {
  type: 'dropShadow',
  offsetX: 16,
  offsetY: 0,
  blurRadius: 0,
  color: 'rgb(220 38 38)',
};

function orderedScene(order: FilterLabOrder) {
  const filters: readonly CRCFilter[] = order === 'shadow-then-grayscale'
    ? [ORDERED_SHADOW, { type: 'grayscale', amount: 1 }]
    : [{ type: 'grayscale', amount: 1 }, ORDERED_SHADOW];
  return [
    <Group style={{ filter: filters }}>
      <Rectangle style={{ left: 90, top: 80, width: 100, height: 58, fill: '#2563eb' }} />
      <Circle style={{ cx: 118, cy: 108, radius: 18, fill: '#f7c948' }} />
    </Group>,
    label(order === 'shadow-then-grayscale' ? 'shadow → gray' : 'gray → shadow', 140, 166),
  ];
}

function nestedScene() {
  return [
    <Group style={{ filter: { type: 'blur', radius: 2 } }}>
      <Group style={{
        filter: {
          type: 'dropShadow', offsetX: 8, offsetY: 6, blurRadius: 3, color: 'rgb(15 23 42)',
        },
      }}>
        <Group style={{ filter: { type: 'grayscale', amount: 1 } }}>
          <Rectangle style={{ left: 80, top: 88, width: 80, height: 60, fill: '#2563eb' }} />
          <Circle style={{ cx: 106, cy: 118, radius: 18, fill: '#f7c948' }} />
        </Group>
      </Group>
    </Group>,
    label('gray → shadow → blur', 120, 176),
  ];
}

function transformedScene() {
  return [
    <Group style={{
      filter: {
        type: 'dropShadow', offsetX: 12, offsetY: 8, blurRadius: 3, color: 'rgb(15 23 42)',
      },
      translateX: 100,
      translateY: 100,
      scaleX: 1.25,
      scaleY: 0.7,
      rotationDegrees: 18,
      rotationOrigin: [30, 20],
    }}>
      <Rectangle style={{ left: 0, top: 0, width: 60, height: 40, fill: '#2563eb' }} />
      <Circle style={{ cx: 20, cy: 20, radius: 14, fill: '#f7c948' }} />
    </Group>,
    label('rotated + nonuniform', 140, 178),
  ];
}

function rectangleClip(x: number, y: number, width: number, height: number): Path2D {
  const path = new Path2D();
  path.rect(x, y, width, height);
  return path;
}

const CLIP_FILTER: CRCFilter = {
  type: 'dropShadow', offsetX: 12, offsetY: 0, blurRadius: 0, color: '#0f172a',
};

function clippedScene() {
  return [
    <Clip style={{ d: rectangleClip(20, 96, 70, 60), filter: CLIP_FILTER }}>
      <Rectangle style={{ left: 20, top: 96, width: 70, height: 60, fill: '#2563eb' }} />
    </Clip>,
    <Clip style={{ d: rectangleClip(180, 96, 70, 60) }}>
      <Group style={{ filter: CLIP_FILTER }}>
        <Rectangle style={{ left: 180, top: 96, width: 70, height: 60, fill: '#2563eb' }} />
      </Group>
    </Clip>,
    <Group style={{ filter: CLIP_FILTER }}>
      <Clip style={{ d: rectangleClip(340, 96, 70, 60) }}>
        <Rectangle style={{ left: 340, top: 96, width: 70, height: 60, fill: '#2563eb' }} />
      </Clip>
    </Group>,
    label('same clip', 55, 178),
    label('ancestor clip', 215, 178),
    label('descendant clip', 375, 178),
  ];
}

function layeredScene(recordTarget: FilterLabRecordTarget) {
  return [
    <Group style={{ translateX: 120, translateY: 90 }}>
      <Layer style={{
        width: 80,
        height: 50,
        filter: {
          type: 'dropShadow', offsetX: 12, offsetY: 0, blurRadius: 3, color: 'rgb(15 23 42)',
        },
      }}>
        <Rectangle
          style={{ left: 0, top: 0, width: 80, height: 50, fill: '#2563eb', cursor: 'pointer' }}
          onClick={() => recordTarget('layered-source')}
        />
        <Circle pointerEvents="none" style={{ cx: 25, cy: 25, radius: 16, fill: '#f7c948' }} />
      </Layer>
    </Group>,
    label('cached Layer · source hit only', 160, 168),
  ];
}

const FilterLabScene = ({ state, recordTarget }: FilterLabSceneProps) => {
  switch (state.mode) {
    case 'all':
      return allFiltersScene();
    case 'ordered':
      return orderedScene(state.order);
    case 'nested':
      return nestedScene();
    case 'transformed':
      return transformedScene();
    case 'clipped':
      return clippedScene();
    case 'layered':
      return layeredScene(recordTarget);
  }
};

export function createFilterLabScene(props: FilterLabSceneProps) {
  return <FilterLabScene {...props} />;
}
