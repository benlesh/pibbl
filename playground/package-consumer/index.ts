import { blur, brightness, contrast, dropShadow, grayscale, hueRotate, invert, opacity, saturate, sepia } from '@crc/core/filters';
import type {
  CRCAnimationDefinition,
  CRCAnimationOptions,
  CRCAnimationProgram,
  CRCAnimationRepeatDirection,
  CRCAnimationRepeatOptions,
  CRCAnimationSampleInput,
  CRCConfig,
  CRCClipboardEvent,
  CRCCompositionEvent,
  CRCController,
  CRCRenderLayerComponentProps,
  CRCRenderLayerContext,
  CRCRenderLayerDefinition,
  CRCRenderLayerFrame,
  CRCRenderLayerHit,
  CRCRenderLayerInput,
  CRCRenderLayerInteraction,
  CRCRenderLayerInteractionSnapshot,
  CRCRenderLayerProps,
  CRCRenderLayerSize,
  CRCRenderLayerStyle,
  CRCRenderLayerTarget,
  CRCEasing,
  CRCElement,
  CRCDragEvent,
  CRCEvent,
  CRCEventCapturePropName,
  CRCEventHandler,
  CRCEventHandlers,
  CRCEventMap,
  CRCEventPhase,
  CRCEventPropName,
  CRCEventTarget,
  CRCEventTargetOptions,
  CRCEventTargetSnapshot,
  CRCEventType,
  CRCFilter,
  CRCFit,
  CRCFixedViewportConfig,
  CRCFocusEvent,
  CRCInputEvent,
  CRCKeyboardEvent,
  CRCKeyboardNavigationOptions,
  CRCInterpolator,
  CRCKeyframesOptions,
  CRCLogicalMouseEvent,
  CRCManipulableProps,
  CRCManipulationBox,
  CRCManipulationController,
  CRCManipulationOptions,
  CRCManipulationResizeInput,
  CRCResizePosition,
  CRCMouseEvent,
  CRCNode,
  CRCPixelRatio,
  CRCPointerEvent,
  CRCPlayback,
  CRCPlaybackEvent,
  CRCPlaybackOptions,
  CRCPlaybackStatus,
  CRCReactionOptions,
  CRCRef,
  CRCResponsiveViewportConfig,
  CRCSpringOptions,
  CRCSpringAnimatedValueOptions,
  CRCStepperOptions,
  CRCTouchEvent,
  CRCTweenOptions,
  CRCTweenAnimatedValueOptions,
  CRCWheelEvent,
  ArcProps,
  ArcStyle,
  ArcPathOptions,
  AbsoluteStyle,
  BoxStyle,
  CirclePathOptions,
  CircleProps,
  CircleStyle,
  ClipStyle,
  GStyle,
  GridItemStyle,
  GridStyle,
  HorizontalLineStyle,
  ImgStyle,
  EllipseProps,
  EllipseStyle,
  EllipsePathOptions,
  LayerStyle,
  LayoutBox,
  LayoutItemStyle,
  Length,
  LineStyle,
  LinePathOptions,
  PathStyle,
  PolygonProps,
  PolygonStyle,
  PolygonPathOptions,
  RectangleProps,
  RectanglePathOptions,
  RegularPolygonNumericSize,
  RegularPolygonPathOptions,
  RegularPolygonPathPosition,
  RegularPolygonProps,
  RegularPolygonStyle,
  RoundedCornerPathOptions,
  RoundedCornerStyle,
  RectStyle,
  RenderingContext2D,
  Signal,
  SignalEquals,
  SignalOptions,
  SignalValue,
  SvgPathStyle,
  SvgPathOptions,
  StarPathOptions,
  StarProps,
  StarStyle,
  SystemStyle,
  Percentage,
  FlexItemStyle,
  FlexStyle,
  FlowStyle,
  OverlayStyle,
  TextStyle,
  VerticalLineStyle,
  WedgeProps,
  WedgeStyle,
  WedgePathOptions,
  WritableSignal,
} from '@crc/core';
import type * as CoreTypes from '@crc/core/types';
import * as ParticleRuntime from '@crc/core/particles';
import type * as ParticleTypes from '@crc/core/particles';
import * as ThreeRuntime from '@crc/three';
import {
  defineThreeLayer,
  type CRCThreeLayerResources,
} from '@crc/three';
import { PerspectiveCamera, Scene } from 'three';
import {
  Particles2D,
  useParticleSystem,
  useFlowField2D,
  useFlowSource2D,
  type CRCFlowField2D,
  type CRCFlowObstacleSource2D,
  defineParticleEffect2D,
  particleChoice,
  particleCurve,
  particleGradient,
  particleInteger,
  particleParameter,
  particleRange,
  type CRCParticleEffect2D,
  type CRCParticleParameterValues,
  type CRCParticleSystem,
  type Particles2DProps,
} from '@crc/core/particles';
import { PhysicsWorld2D, crcPhysicsWorld2D, physicsObstacles2D } from '@crc/core/physics/2d';
import * as Physics3DGeometry from '@crc/core/physics/3d/geometry';
import type * as Physics3DGeometryTypes from '@crc/core/physics/3d/geometry';
import {
  createBackendToken,
  defineBackendPrimitive,
  executeBackendCRC,
  getBackendEnvironment,
  getCurrentFrameTimestamp,
  getCurrentLogicalViewport,
  haveSameLayerNodeTree,
  isBackendEventTargetLive,
  mountBackendCRC,
  onCurrentRenderFinish,
  registerNestedInteractionResolver,
  requestCurrentInstanceFrame,
  setCurrentComponentAfterRender,
  snapshotLayerNodeTree,
  useBackendEventTarget,
  useInternalHookSlot,
  type CRCBackendDriver,
  type CRCBackendFrame,
  type CRCBackendFrameInput,
  type CRCBackendMount,
  type CRCBackendPrimitiveDefinition,
  type CRCBackendPrimitiveInput,
  type CRCBackendToken,
  type CRCNestedResolverInput,
  crcInternalAssertCommandAllowed,
  crcInternalCreateSignalConsumer,
  crcInternalCurrentFrame,
  crcInternalCurrentRenderOwner,
  crcInternalOnRenderFinish,
  crcInternalPaintTarget,
  crcInternalQueueBegin,
  crcInternalQueueComplete,
  crcInternalQueueCurrentCommit,
  crcInternalQueueCurrentComplete,
  crcInternalRegisterAdvance,
  crcInternalRequestRender,
  crcInternalRequestRendererWork,
  type CRCInternalCommandHandle,
  crcInternalCurrentSimulationOwner,
  crcInternalOnSimulationRenderTransactionFinish,
  crcInternalQueueSimulationBegin,
  crcInternalQueueSimulationCommitAcknowledgement,
  crcInternalQueueSimulationComplete,
  crcInternalRegisterSimulationAdvance,
  crcInternalRequestSimulationRender,
  type CRCInternalAdvanceLane,
  type CRCInternalFrame,
  type CRCInternalRendererWorkKind,
  type CRCInternalRenderOwner,
  type CRCInternalSignalBatch,
  type CRCInternalSignalConsumer,
  type CRCInternalSimulationOwner,
} from '@crc/core/internal';
import {
  crc,
  useComputed,
  useConst,
  useCursor,
  useEvent,
  useEventListener,
  useEventTarget,
  useLayoutBox,
  useLinePath,
  usePlayback,
  useRectPath,
  useRef,
  useSignal,
  useSvgPath,
  useAnimatedValue,
  useReaction,
  createElement,
  HtmlBox,
  defineAnimation,
  definePrimitive,
  defineRenderLayer,
  DragHandle,
  easing,
  Absolute,
  Arc,
  Circle,
  Clip,
  Ellipse,
  Flex,
  Flow,
  Grid,
  Group,
  HorizontalLine,
  Image,
  Layer,
  Line,
  Manipulable,
  ManipulationFrame,
  Overlay,
  Path,
  Polygon,
  RegularPolygon,
  Rectangle,
  ResizeHandle,
  ResizeHandles,
  RotationHandle,
  Star,
  SvgPath,
  Text,
  VerticalLine,
  Wedge,
  createArcPath,
  createCirclePath,
  createEllipsePath,
  createLinePath,
  createPolygonPath,
  createRectanglePath,
  createRegularPolygonPath,
  createStarPath,
  createSvgPath,
  createWedgePath,
  measureElement,
  FocusManagement,
  KeyboardNavigation,
  keyframes,
  marker,
  parallel,
  repeat,
  resolveSignalValue,
  sequence,
  useCanvasContext,
  useManipulation,
  batch,
  computed,
  degrees,
  isSignal,
  signal,
  spring,
  stepper,
  track,
  tween,
  untracked,
  wait,
} from '@crc/core';

// Removed hooks intentionally have no built-package compatibility exports.
// @ts-expect-error useState was replaced by useSignal
import { useState as removedUseState } from '@crc/core';
// @ts-expect-error StateUpdater was removed with useState
import type { StateUpdater as RemovedStateUpdater } from '@crc/core';
// @ts-expect-error useMemo was replaced by useConst and useComputed
import { useMemo as removedUseMemo } from '@crc/core';
// @ts-expect-error useWhenChanged was replaced by useReaction
import { useWhenChanged as removedUseWhenChanged } from '@crc/core';

type RemovedHookVocabulary = [
  typeof removedUseState,
  RemovedStateUpdater<number>,
  typeof removedUseMemo,
  typeof removedUseWhenChanged,
];
void (null as unknown as RemovedHookVocabulary);

const packedParticleSize = particleRange(2, 6);
const packedParticleCount = particleInteger(4, 8);
const packedParticleColor = particleChoice([
  { value: '#f97316', weight: 2 },
  { value: '#fde68a', weight: 1 },
]);
const packedParticleIntensity = particleParameter('intensity');
const packedParticleOpacity = particleCurve([
  [0, 0],
  [0.2, 1],
  [1, 0],
]);
const packedParticleGradient = particleGradient([
  [0, '#fff7cc'],
  [1, '#f97316'],
]);

const packedParticleEffect2D = defineParticleEffect2D({
  parameters: {
    intensity: { type: 'number', default: 1, timing: 'render' },
  },
  emitters: [
    {
      name: 'spark',
      capacity: 32,
      emission: [{ type: 'manual', count: packedParticleCount }],
      shape: { type: 'point' },
      initial: {
        lifetimeMilliseconds: 500,
        velocity: [particleRange(-20, 20), particleRange(-60, -20)],
        size: packedParticleSize,
        color: packedParticleColor,
        opacity: packedParticleIntensity,
      },
      appearance: { opacity: packedParticleOpacity, color: packedParticleGradient },
      renderer: { type: 'circle', blend: 'additive' },
      bounds: { min: [-30, -70], max: [30, 10] },
    },
  ],
});

function PackedParticleScene() {
  const system = useParticleSystem(packedParticleEffect2D, {
    autoplay: false,
    seed: 42,
  });
  return createElement(Particles2D, {
    system,
    parameters: { intensity: 0.8 },
    style: { width: 100, height: 100 },
  });
}

createElement(PackedParticleScene, {});
void ParticleRuntime;
void (undefined as unknown as ParticleTypes.CRCParticleEmitter2D);
void (undefined as unknown as CRCParticleEffect2D<'spark'>);
void (undefined as unknown as CRCParticleSystem<'spark', CRCParticleParameterValues>);
void (undefined as unknown as Particles2DProps<'spark'>);

const packageConsumerBackendToken: CRCBackendToken =
  createBackendToken('package-consumer');
const packageConsumerEnvironment = Object.freeze({ kind: 'consumer' });
const packageConsumerBackend: CRCBackendDriver<
  typeof packageConsumerEnvironment
> = {
  token: packageConsumerBackendToken,
  name: 'package-consumer',
  beginFrame(_input: CRCBackendFrameInput) {
    return { environment: packageConsumerEnvironment };
  },
  enterComponent(_frame: CRCBackendFrame<typeof packageConsumerEnvironment>) {
    return () => undefined;
  },
  runPrimitive(_frame, _input: CRCBackendPrimitiveInput, runProgram) {
    runProgram(() => undefined);
  },
  finishFrame() {},
  dispose() {},
};
const PackageConsumerPrimitive = defineBackendPrimitive(
  packageConsumerBackendToken,
  function renderPackageConsumerPrimitive() {},
);
const packageConsumerDefinition = undefined as unknown as
  CRCBackendPrimitiveDefinition;
const packageConsumerMount = undefined as unknown as CRCBackendMount;
const packageConsumerResolver = undefined as unknown as CRCNestedResolverInput;
void PackageConsumerPrimitive;
void packageConsumerDefinition;
void packageConsumerMount;
void packageConsumerResolver;
void packageConsumerBackend;
void [
  executeBackendCRC,
  getBackendEnvironment,
  getCurrentFrameTimestamp,
  haveSameLayerNodeTree,
  isBackendEventTargetLive,
  mountBackendCRC,
  registerNestedInteractionResolver,
  requestCurrentInstanceFrame,
  setCurrentComponentAfterRender,
  snapshotLayerNodeTree,
  useBackendEventTarget,
  useInternalHookSlot,
];

declare const internalOwner: CRCInternalRenderOwner;
declare const internalFrame: CRCInternalFrame;
declare const internalBatch: CRCInternalSignalBatch;
declare const internalCommand: CRCInternalCommandHandle;
declare const internalConsumer: CRCInternalSignalConsumer;
declare const internalSignalBatch: CRCInternalSignalBatch;
declare const internalSimulationOwner: CRCInternalSimulationOwner;
const internalWorkKind = 'draw' satisfies CRCInternalRendererWorkKind;
const internalAdvanceLane = 'physics' satisfies CRCInternalAdvanceLane;
void internalOwner;
void internalFrame;
void internalBatch;
void internalCommand;
void internalConsumer;
void internalSignalBatch;
void internalSimulationOwner;
void internalWorkKind;
void internalAdvanceLane;
void crcInternalAssertCommandAllowed;
void crcInternalCreateSignalConsumer;
void crcInternalCurrentFrame;
void crcInternalCurrentRenderOwner;
void crcInternalOnRenderFinish;
void crcInternalPaintTarget;
void crcInternalQueueBegin;
void crcInternalQueueComplete;
void crcInternalQueueCurrentCommit;
void crcInternalQueueCurrentComplete;
void crcInternalRegisterAdvance;
void crcInternalRequestRender;
void crcInternalRequestRendererWork;
void getCurrentLogicalViewport;
void onCurrentRenderFinish;
void crcInternalCurrentSimulationOwner;
void crcInternalOnSimulationRenderTransactionFinish;
void crcInternalQueueSimulationBegin;
void crcInternalQueueSimulationCommitAcknowledgement;
void crcInternalQueueSimulationComplete;
void crcInternalRegisterSimulationAdvance;
void crcInternalRequestSimulationRender;

export type PublicEventTypes = {
  base: CRCEvent;
  clipboard: CRCClipboardEvent;
  composition: CRCCompositionEvent;
  drag: CRCDragEvent;
  focus: CRCFocusEvent;
  input: CRCInputEvent;
  keyboard: CRCKeyboardEvent;
  logicalMouse: CRCLogicalMouseEvent;
  canvasObserverMouse: CRCMouseEvent;
  pointer: CRCPointerEvent;
  touch: CRCTouchEvent;
  wheel: CRCWheelEvent;
  eventMap: CRCEventMap;
  eventType: CRCEventType;
  eventPhase: CRCEventPhase;
  eventProp: CRCEventPropName;
  eventCaptureProp: CRCEventCapturePropName;
  eventTarget: CRCEventTarget;
  eventTargetOptions: CRCEventTargetOptions;
  eventTargetSnapshot: CRCEventTargetSnapshot;
};

const pointerHandler: CRCEventHandler<'pointerdown'> = event => {
  const pressure: number = event.pressure;
  void pressure;
};
const eventHandlers = {
  onPointerDown: pointerHandler,
  onMouseDown: event => {
    const detail: number = event.detail;
    void detail;
  },
  onTouchStart: event => {
    const changedTouches: TouchList = event.changedTouches;
    void changedTouches;
  },
  onWheel: event => {
    const deltaMode: number = event.deltaMode;
    void deltaMode;
  },
  onKeyDownCapture: event => {
    const key: string = event.key;
    void key;
  },
  onFocus: event => {
    const original: FocusEvent = event.originalEvent;
    void original;
  },
  onBeforeInput: event => {
    const inputType: string = event.inputType;
    void inputType;
  },
  onChange: event => {
    const original: Event = event.originalEvent;
    void original;
  },
  onCompositionUpdate: event => {
    const data: string = event.data;
    void data;
  },
  onCopyCapture: event => {
    const clipboardData: DataTransfer | null = event.clipboardData;
    void clipboardData;
  },
  onDragStart: event => {
    const dataTransfer: DataTransfer | null = event.dataTransfer;
    void dataTransfer;
  },
} satisfies CRCEventHandlers;

function PublicEventProbe(): CRCNode {
  const options = {
    path: new Path2D(),
    fill: true,
    keyboardFocusable: true,
    keyboardNavigationBounds: { x: 0, y: 0, width: 20, height: 20 },
  } satisfies CRCEventTargetOptions;
  const snapshot: CRCEventTargetSnapshot = useEventTarget(
    eventHandlers,
    options,
  );
  useEventListener({ onPointerDownCapture: pointerHandler });
  const focused: boolean = snapshot.isFocused;
  void focused;
  return undefined;
}
createElement(PublicEventProbe, {});

const rectangleStyle = {
  left: 10,
  top: 10,
  width: 40,
  height: 20,
  fill: '#2563eb',
} satisfies RectStyle;
const rectangleProps = {} satisfies RectangleProps;

const blurFilter: CRCFilter = blur({  radius: 2 });
const brightnessFilter: CRCFilter = brightness({
  
  amount: 1.25,
});
const contrastFilter: CRCFilter = contrast({  amount: 0.8 });
const dropShadowFilter: CRCFilter = dropShadow({
  
  offsetX: 3,
  offsetY: 4,
  blurRadius: 2,
  color: 'rgb(0 0 0 / 40%)',
});
const grayscaleFilter: CRCFilter = grayscale({
  
  amount: 0.5,
});
const hueRotateFilter: CRCFilter = hueRotate({
  
  degrees: 45,
});
const invertFilter: CRCFilter = invert({  amount: 0.25 });
const opacityFilter: CRCFilter = opacity({  amount: 0.75 });
const saturateFilter: CRCFilter = saturate({  amount: 1.5 });
const sepiaFilter: CRCFilter = sepia({  amount: 0.4 });
const publicFilterList = [
  blurFilter,
  brightnessFilter,
  contrastFilter,
  dropShadowFilter,
  grayscaleFilter,
  hueRotateFilter,
  invertFilter,
  opacityFilter,
  saturateFilter,
  sepiaFilter,
] as const satisfies readonly CRCFilter[];

createElement(Rectangle, {
  style: { ...rectangleStyle, filter: blurFilter },
});
createElement(Rectangle, {
  style: { ...rectangleStyle, filter: publicFilterList },
});
createElement(Group, {
  style: { filter: dropShadowFilter },
  children: createElement(Rectangle, { style: rectangleStyle }),
});
createElement(Group, {
  style: { filter: publicFilterList },
  children: createElement(Rectangle, { style: rectangleStyle }),
});
createElement(Absolute, {
  style: { width: 100, height: 50, filter: opacityFilter },
  children: createElement(Rectangle, { style: rectangleStyle }),
});
createElement(Absolute, {
  style: { width: 100, height: 50, filter: publicFilterList },
  children: createElement(Rectangle, { style: rectangleStyle }),
});

// @ts-expect-error raw CSS strings are not CRC filters
const raw: SystemStyle = { filter: 'blur(4px)' };
// @ts-expect-error boxShadow is not a CRC system style property
const box: SystemStyle = { boxShadow: { offsetX: 1 } };
// @ts-expect-error url filters are excluded
const url: CRCFilter = { type: 'url', value: '#filter' };
void raw;
void box;
void url;

export type PublicCoreTypes = typeof CoreTypes;
export type PublicCoreEventTypes = [
  CoreTypes.CRCClipboardEvent,
  CoreTypes.CRCCompositionEvent,
  CoreTypes.CRCDragEvent,
  CoreTypes.CRCEvent,
  CoreTypes.CRCEventHandlers,
  CoreTypes.CRCEventTarget,
  CoreTypes.CRCEventTargetOptions,
  CoreTypes.CRCEventTargetSnapshot,
  CoreTypes.CRCFocusEvent,
  CoreTypes.CRCInputEvent,
  CoreTypes.CRCKeyboardEvent,
  CoreTypes.CRCLogicalMouseEvent,
  CoreTypes.CRCMouseEvent,
  CoreTypes.CRCPointerEvent,
  CoreTypes.CRCTouchEvent,
  CoreTypes.CRCWheelEvent,
];
const keyboardNavigationOptions = {
  mode: 'directional',
} satisfies CRCKeyboardNavigationOptions;
export const scene = createElement(FocusManagement, {
  children: createElement(KeyboardNavigation, {
    ...keyboardNavigationOptions,
    children: createElement(Rectangle, {
      ...rectangleProps,
      key: 'packed-focus-probe',
      style: rectangleStyle,
    }),
  }),
});
export const mount = crc;

const pathStyle = {
  d: new Path2D(),
  fill: '#2563eb',
  stroke: '#0f172a',
  strokeWidth: 2,
  opacity: 0.5,
  cursor: 'pointer',
  lineInteractionWidth: 8,
} satisfies PathStyle;
createElement(Path, { style: pathStyle, onClick: () => undefined });
createElement(Path, { style: pathStyle, ...eventHandlers });

const svgPathStyle = {
  d: 'M 0 0 L 10 10',
  stroke: '#0f172a',
} satisfies SvgPathStyle;
createElement(SvgPath, { style: svgPathStyle });

const lineStyle = {
  coords: [[0, 0], [20, 10]],
  stroke: '#2563eb',
  strokeWidth: 2,
  opacity: 0.5,
  lineInteractionWidth: 8,
  cursor: 'pointer',
} satisfies LineStyle;
createElement(Line, { style: lineStyle, onMouseMove: () => undefined });

const circleStyle = {
  cx: '25%',
  cy: 30,
  radius: '10%',
  fill: '#2563eb',
  cursor: 'pointer',
} satisfies CircleStyle;
const circleProps = { onClick: () => undefined } satisfies CircleProps;

const ellipseStyle = {
  cx: 80,
  cy: '40%',
  radiusX: '15%',
  radiusY: 12,
  rotation: Math.PI / 8,
  stroke: '#0f172a',
  strokeWidth: 2,
} satisfies EllipseStyle;
const ellipseProps = { onPointerDown: () => undefined } satisfies EllipseProps;

const arcStyle = {
  cx: 120,
  cy: 50,
  radius: 24,
  startAngle: 0,
  endAngle: Math.PI,
  counterclockwise: false,
  stroke: '#dc2626',
  lineInteractionWidth: 8,
} satisfies ArcStyle;
const arcProps = { onMouseMove: () => undefined } satisfies ArcProps;

const wedgeStyle = {
  cx: 170,
  cy: 50,
  radius: 28,
  startAngle: -Math.PI / 2,
  endAngle: Math.PI / 3,
  fill: '#f97316',
  stroke: '#9a3412',
} satisfies WedgeStyle;
const wedgeProps = { keyboardFocusable: true } satisfies WedgeProps;

const polygonStyle = {
  coords: [[210, 20], [250, 50], [225, 85]] as [number, number][],
  fill: '#16a34a',
  stroke: '#14532d',
} satisfies PolygonStyle;
const polygonProps = { onClick: () => undefined } satisfies PolygonProps;

const regularPolygonStyle = {
  sides: 6,
  circumradius: 24,
  cornerRadius: 2,
  fill: '#0ea5e9',
} satisfies RegularPolygonStyle;
const regularPolygonProps = { onClick: () => undefined } satisfies RegularPolygonProps;
const starStyle = {
  points: 5,
  outerRadius: 24,
  innerRadius: 10,
  cornerRadii: [2, 0],
  fill: '#f59e0b',
} satisfies StarStyle;
const starProps = { onClick: () => undefined } satisfies StarProps;

const roundedCornerStyle = { cornerRadius: 2 } satisfies RoundedCornerStyle;
const roundedCornerPathOptions = { cornerRadii: [2, null] } satisfies RoundedCornerPathOptions;
const rectanglePathOptions = { width: 20, height: 10, cornerRadius: 2 } satisfies RectanglePathOptions;
const circlePathOptions = { radius: 10 } satisfies CirclePathOptions;
const ellipsePathOptions = { radiusX: 10, radiusY: 5 } satisfies EllipsePathOptions;
const arcPathOptions = { radius: 10, startAngle: 0, endAngle: Math.PI } satisfies ArcPathOptions;
const wedgePathOptions = { radius: 10, startAngle: 0, endAngle: Math.PI } satisfies WedgePathOptions;
const linePathOptions = { coords: [[0, 0], [10, 10]] } satisfies LinePathOptions;
const polygonPathOptions = { coords: [[0, 0], [10, 0], [5, 10]] } satisfies PolygonPathOptions;
const regularPolygonPathPosition = { sides: 6, cx: 10, cy: 10 } satisfies RegularPolygonPathPosition;
const regularPolygonNumericSize = { inradius: 10 } satisfies RegularPolygonNumericSize;
const regularPolygonPathOptions = {
  ...regularPolygonPathPosition,
  ...regularPolygonNumericSize,
} satisfies RegularPolygonPathOptions;
const starPathOptions = { points: 5, outerRadius: 10, innerRadius: 4 } satisfies StarPathOptions;
const svgPathOptions = { d: 'M 0 0 L 10 10' } satisfies SvgPathOptions;
const pathCreators = [
  createArcPath,
  createCirclePath,
  createEllipsePath,
  createLinePath,
  createPolygonPath,
  createRectanglePath,
  createRegularPolygonPath,
  createStarPath,
  createSvgPath,
  createWedgePath,
] as const;
void roundedCornerStyle;
void roundedCornerPathOptions;
void rectanglePathOptions;
void circlePathOptions;
void ellipsePathOptions;
void arcPathOptions;
void wedgePathOptions;
void linePathOptions;
void polygonPathOptions;
void regularPolygonPathPosition;
void regularPolygonNumericSize;
void regularPolygonPathOptions;
void starPathOptions;
void svgPathOptions;
void pathCreators;

export const standardShapeScene = createElement(Group, {
  children: [
    createElement(Circle, { ...circleProps, style: circleStyle }),
    createElement(Ellipse, { ...ellipseProps, style: ellipseStyle }),
    createElement(Arc, { ...arcProps, style: arcStyle }),
    createElement(Wedge, { ...wedgeProps, style: wedgeStyle }),
    createElement(Polygon, { ...polygonProps, style: polygonStyle }),
    createElement(RegularPolygon, {
      ...regularPolygonProps,
      style: regularPolygonStyle,
    }),
    createElement(Star, { ...starProps, style: starStyle }),
  ],
});

const horizontalLineStyle = {
  y: 12,
  x1: 4,
  x2: 40,
  stroke: 'black',
  alignToPixelGrid: 'round',
} satisfies HorizontalLineStyle;
createElement(HorizontalLine, { style: horizontalLineStyle });

const verticalLineStyle = {
  x: 12,
  y1: 4,
  y2: 40,
  stroke: 'black',
  alignToPixelGrid: 'round',
} satisfies VerticalLineStyle;
createElement(VerticalLine, { style: verticalLineStyle });

const textStyle = {
  left: 20,
  top: 24,
  width: 180,
  height: 60,
  lineHeight: 18,
  wrap: true,
  fit: 'ellipsis',
  font: '16px sans-serif',
  textAlign: 'left',
  textBaseline: 'top',
  fill: '#111827',
  opacity: 0.8,
  cursor: 'pointer',
} satisfies TextStyle;
createElement(Text, {
  style: textStyle,
  onClick: () => undefined,
}, 'Hello Canvas');

const imageStyle = {
  src: 'image.png',
  width: 80,
  height: 60,
  stroke: '#0f172a',
  strokeWidth: 1,
  opacity: 0.8,
  alignToPixelGrid: 'round',
  cursor: 'pointer',
} satisfies ImgStyle;
createElement(Image, { style: imageStyle, onClick: () => undefined });

const groupStyle = {
  scaleX: 1.5,
  rotationDegrees: 15,
  rotationOrigin: [10, 10],
  translateX: 20,
  translateY: 30,
  skewX: 5,
  skewY: 3,
} satisfies GStyle;
createElement(Group, {
  style: groupStyle,
  children: createElement(Rectangle, { style: rectangleStyle }),
});

const clipStyle = {
  d: new Path2D(),
  fillRule: 'evenodd',
} satisfies ClipStyle;
createElement(Clip, {
  style: clipStyle,
  children: createElement(Rectangle, { style: rectangleStyle }),
});

const layerStyle = { width: 320, height: 180 } satisfies LayerStyle;
createElement(Layer, {
  style: layerStyle,
  children: createElement(Rectangle, { style: rectangleStyle }),
});

const percentage = '50%' satisfies Percentage;
const length: Length = percentage;
const boxStyle = { width: length, height: 120, overflow: 'clip' } satisfies BoxStyle;
const absoluteStyle = { width: '100%', height: '100%' } satisfies AbsoluteStyle;
const overlayStyle = {
  width: 240,
  height: 120,
  alignItems: 'center',
  justifyItems: 'end',
} satisfies OverlayStyle;
const flowStyle = { width: 300, height: 120, gap: 8, wrap: true } satisfies FlowStyle;
const flexStyle = { width: 300, height: 120, gap: 8, alignItems: 'center' } satisfies FlexStyle;
const gridStyle = {
  width: 300,
  height: 120,
  gridTemplateColumns: [100, '1fr'],
  gridTemplateRows: [120],
} satisfies GridStyle;
const flexItem = { flexBasis: '50%', flexGrow: 1 } satisfies FlexItemStyle;
const gridItem = { gridColumnStart: 1, gridRowStart: 1 } satisfies GridItemStyle;
const layoutItem = { left: '25%', top: 10 } satisfies LayoutItemStyle;
void boxStyle;
void flexItem;
void gridItem;
void layoutItem;

const layoutChild = createElement(Rectangle, {
  style: { ...rectangleStyle, width: '50%' },
});
createElement(Absolute, { style: absoluteStyle, children: layoutChild });
createElement(Overlay, { style: overlayStyle, children: layoutChild });
createElement(Flow, { style: flowStyle, children: layoutChild });
createElement(Flex, {
  style: flexStyle,
  children: createElement(Rectangle, { style: {
    ...rectangleStyle, minWidth: 0, flexBasis: 40,
  } }),
});
createElement(Grid, {
  style: gridStyle,
  children: createElement(Rectangle, { style: {
    ...rectangleStyle, gridColumnStart: 1, gridRowStart: 1,
  } }),
});

createElement(Absolute, {
  style: {
    width: 100, height: 50, left: 5, top: '10%',
    alignSelf: 'center', justifySelf: 'end',
    flexBasis: 40, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 1,
    gridRowStart: 1, gridRowSpan: 1,
  },
  children: [],
});
createElement(Overlay, {
  style: {
    width: 100, height: 50, left: 5, top: '10%',
    alignSelf: 'center', justifySelf: 'end',
    flexBasis: 40, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 1,
    gridRowStart: 1, gridRowSpan: 1,
  },
  children: [],
});
createElement(Flow, {
  style: {
    width: 100, height: 50, left: 5, top: '10%',
    alignSelf: 'center', justifySelf: 'end',
    flexBasis: 40, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 1,
    gridRowStart: 1, gridRowSpan: 1,
  },
  children: [],
});
createElement(Flex, {
  style: {
    width: 100, height: 50, minWidth: 0, left: 5, top: '10%',
    alignSelf: 'center', justifySelf: 'end',
    flexBasis: 40, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 1,
    gridRowStart: 1, gridRowSpan: 1,
  },
  children: [],
});
createElement(Grid, {
  style: {
    width: 100, height: 50, left: 5, top: '10%',
    alignSelf: 'center', justifySelf: 'end',
    flexBasis: 40, flexGrow: 1, flexShrink: 0,
    gridColumnStart: 1, gridColumnSpan: 1,
    gridRowStart: 1, gridRowSpan: 1,
    gridTemplateColumns: [100],
    gridTemplateRows: [50],
  },
  children: [],
});

const observedBox: Readonly<LayoutBox> = useLayoutBox();
void observedBox;
measureElement(createElement(Text, null, 'measure me'), {
  minWidth: 0, maxWidth: 200, minHeight: 0, maxHeight: 100,
}, { measureText: () => ({ width: 80 }) as TextMetrics });

// @ts-expect-error reverse Flex directions are outside the supported subset
createElement(Flex, { style: { ...flexStyle, flexDirection: 'row-reverse' } }, []);
// @ts-expect-error Grid track grammar excludes intrinsic auto tracks
createElement(Grid, { style: { ...gridStyle, gridTemplateColumns: ['auto'] } }, []);
// @ts-expect-error lengths use finite numbers, decimal percentages, or auto
const invalidLength: Length = 'wide';
// @ts-expect-error useLayoutBox accepts no arguments
useLayoutBox('parent');

const subpathGroupStyle: CoreTypes.GStyle = groupStyle;
const subpathCircleStyle: CoreTypes.CircleStyle = circleStyle;
const subpathEllipseStyle: CoreTypes.EllipseStyle = ellipseStyle;
const subpathArcStyle: CoreTypes.ArcStyle = arcStyle;
const subpathWedgeStyle: CoreTypes.WedgeStyle = wedgeStyle;
const subpathPolygonStyle: CoreTypes.PolygonStyle = polygonStyle;
const subpathClipStyle: CoreTypes.ClipStyle = clipStyle;
const subpathLayerStyle: CoreTypes.LayerStyle = layerStyle;
const subpathGridStyle: CoreTypes.GridStyle = gridStyle;
const subpathPercentage: CoreTypes.Percentage = percentage;
const subpathKeyboardNavigationOptions: CoreTypes.CRCKeyboardNavigationOptions =
  keyboardNavigationOptions;
void subpathGroupStyle;
void subpathCircleStyle;
void subpathEllipseStyle;
void subpathArcStyle;
void subpathWedgeStyle;
void subpathPolygonStyle;
void subpathClipStyle;
void subpathLayerStyle;
void subpathGridStyle;
void subpathPercentage;
void subpathKeyboardNavigationOptions;

// @ts-expect-error rectangle geometry is style-only
createElement(Rectangle, { x: 10, y: 10, width: 40, height: 20 });
// @ts-expect-error rectangle style requires width and height
createElement(Rectangle, { style: { fill: 'red' } });
// @ts-expect-error Path2D data is style-only
createElement(Path, { d: new Path2D() });
// @ts-expect-error SVG path data is style-only
createElement(SvgPath, { d: 'M 0 0 L 10 10' });
// @ts-expect-error line coordinates are style-only
createElement(Line, { coords: [[0, 0], [20, 10]] });
// @ts-expect-error line style is required because coordinates are required
createElement(Line, {});
// @ts-expect-error legacy line paint names are not style properties
createElement(Line, { style: { coords: [[0, 0], [20, 10]], strokeStyle: 'black', lineWidth: 1 } });
// @ts-expect-error line is stroke-only and does not accept fill paint
createElement(Line, { style: { coords: [[0, 0], [20, 10]], fill: 'red' } });
// @ts-expect-error horizontal-line geometry is style-only
createElement(HorizontalLine, { y: 12 });
// @ts-expect-error horizontal line requires style.y
createElement(HorizontalLine, { style: { stroke: 'black' } });
// @ts-expect-error legacy horizontal endpoint names are not supported
createElement(HorizontalLine, { style: { y: 12, right: 40 } });
// @ts-expect-error vertical-line geometry is style-only
createElement(VerticalLine, { x: 12 });
// @ts-expect-error vertical line requires style.x
createElement(VerticalLine, { style: { stroke: 'black' } });
// @ts-expect-error legacy vertical endpoint names are not supported
createElement(VerticalLine, { style: { x: 12, bottom: 40 } });
// @ts-expect-error text content is supplied through children, not a program prop
createElement(Text, { text: 'legacy' });
// @ts-expect-error text is not a style property
createElement(Text, { style: { text: 'legacy' } });
// @ts-expect-error legacy text sizing names are not supported
createElement(Text, { style: { overflow: 'ellipsis' } }, 'legacy');
// @ts-expect-error text does not accept visual values as program props
createElement(Text, { fillStyle: 'red' }, 'styled');
// @ts-expect-error image source is style-only
createElement(Image, { src: 'legacy.png' });
// @ts-expect-error image style is required because source is required
createElement(Image, {});
// @ts-expect-error legacy image paint names are not style properties
createElement(Image, { style: { src: 'legacy.png', strokeStyle: 'red', lineWidth: 1 } });
// @ts-expect-error image does not accept visual values as program props
createElement(Image, { style: { src: 'styled.png' }, alpha: 0.5 });

const manipulationBox = signal<CRCManipulationBox>({
  left: 20,
  top: 30,
  width: 180,
  height: 100,
});
const manipulationRotation = signal(degrees(15));
const manipulationOptions = {
  box: manipulationBox,
  rotation: manipulationRotation,
  move: { axis: 'both', snap: { step: { x: 8, y: 8 }, origin: { x: 0 } } },
  resize: {
    minWidth: 40,
    minHeight: 20,
    snap: { target: 'size', step: { width: 8, height: 8 } },
  },
  rotate: { snap: { step: degrees(15), origin: 0 } },
} satisfies CRCManipulationOptions;
const manipulationController: CRCManipulationController =
  useManipulation(manipulationOptions);
const manipulationHandle: CRCResizePosition = 'bottom-right';
const manipulableProps = {
  style: manipulationBox,
  rotation: manipulationRotation,
  draggable: { axis: 'x', snap: { step: 8 } },
  resizable: { snap: { target: 'grid', step: { x: 8, y: 8 } } },
  rotatable: { snap: { step: degrees(15) } },
} satisfies CRCManipulableProps;
createElement(Manipulable, manipulableProps);
createElement(ManipulationFrame, {
  ...manipulationController.frameProps,
  children: [
    createElement(DragHandle, { controller: manipulationController, style: { readout: { gap: 8, active: { visible: true } } }, formatReadout: ({ left, top }) => `${left}, ${top}`, children: createElement(Rectangle, { keyboardFocusable: true, style: { width: 24, height: 24, fill: "blue", cursor: "grab" } }) }),
    createElement(ResizeHandle, {
      controller: manipulationController,
      position: manipulationHandle,
      hitSize: 24,
    }),
    createElement(ResizeHandles, {
      controller: manipulationController,
      positions: 'edges-and-corners',
      hitSize: 24,
    }),
    createElement(RotationHandle, { controller: manipulationController }),
  ],
});

// @ts-expect-error Rectangle positioning uses left/top; RectStyle no longer has x.
const retiredRectanglePosition: RectStyle = { x: 20, width: 40, height: 20 };
// @ts-expect-error Text positioning uses left/top; TextStyle no longer has y.
const retiredTextPosition: TextStyle = { y: 20 };
// @ts-expect-error Image positioning uses left/top; ImgStyle no longer has x.
const retiredImagePosition: ImgStyle = { src: 'asset.png', x: 20 };
const invalidGridResizeSnap: CRCManipulationResizeInput = {
  snap: {
    target: 'grid',
    // @ts-expect-error Grid resize snapping uses parent-space x/y increments.
    step: { width: 8, height: 8 },
  },
};
const invalidSizeResizeSnap: CRCManipulationResizeInput = {
  snap: {
    target: 'size',
    step: 8,
    // @ts-expect-error Size resize snapping cannot supply a parent-space origin.
    origin: { x: 0 },
  },
};
void [
  retiredRectanglePosition,
  retiredTextPosition,
  retiredImagePosition,
  invalidGridResizeSnap,
  invalidSizeResizeSnap,
];
// @ts-expect-error group translation is style-only
createElement(Group, { x: 10 }, []);
// @ts-expect-error CRC-native transform names replace the legacy aliases
createElement(Group, { style: { rotate: 45, rotateOrigin: [0, 0] } }, []);
// @ts-expect-error clipping geometry is style-only
createElement(Clip, { path: new Path2D() }, []);
// @ts-expect-error clip style requires path data
createElement(Clip, { style: {} }, []);
// @ts-expect-error layer dimensions are style-only
createElement(Layer, { width: 100, height: 100 },
  createElement(Rectangle, { style: rectangleStyle }));

export function disposeMount(controller: ReturnType<typeof crc>): void {
  const publicController: CRCController = controller;
  publicController.dispose();
}

declare const canvas: HTMLCanvasElement;

function RuntimeProbe({ count }: { count: number; label?: string }): CRCNode {
  const publicContext: RenderingContext2D = useCanvasContext();
  const reactiveCount = useSignal(count);
  publicContext.fillRect(0, 0, reactiveCount.get(), reactiveCount.get());
  return [
    createElement(Rectangle, { style: { left: count, top: 0, width: 1, height: 1 } }),
    false,
    null,
    undefined,
    '',
    0,
  ];
}

const runtimeElement = createElement(RuntimeProbe, { count: 1, label: 'typed' });
type PublicElementHasEnhancers = 'enhancers' extends keyof CRCElement ? true : false;
const publicElementHasEnhancers: PublicElementHasEnhancers = false;
const unsupportedEnhancerElement: CRCElement = {
  ...runtimeElement,
  // @ts-expect-error arbitrary enhancer metadata is not part of public CRC elements
  enhancers: [],
};
void publicElementHasEnhancers;
void unsupportedEnhancerElement;
const runtimeController: CRCController = crc(canvas, runtimeElement, {
  signal: new AbortController().signal,
});
runtimeController.dispose();

const surfaceFit: CRCFit = 'scale-down';
const surfacePixelRatio: CRCPixelRatio = 2;
const fixedSurfaceConfig: CRCFixedViewportConfig = {
  viewport: { width: 720, height: 420 },
  fit: surfaceFit,
  pixelRatio: surfacePixelRatio,
};
const responsiveSurfaceConfig: CRCResponsiveViewportConfig = {
  viewport: 'responsive',
  pixelRatio: 'device',
};
const publicSurfaceConfig: CRCConfig = fixedSurfaceConfig;
crc(canvas, runtimeElement, publicSurfaceConfig);
crc(canvas, runtimeElement, responsiveSurfaceConfig);

interface RuntimeProbeStyle extends SystemStyle {
  width: number;
  opacity?: number;
}

const StyledRuntimeProbe = definePrimitive<
  { count: number },
  RuntimeProbeStyle
>((props, style, context) => {
  context.fillRect(0, 0, props.count * style.width, style.opacity ?? 1);
});

type RenderLayerConsumerProps = { color: string };
type RenderLayerConsumerResources = { context: CRCRenderLayerContext };
type RenderLayerConsumerTarget = { readonly id: string };
const renderLayerSize: CRCRenderLayerSize = {
  width: 1,
  height: 1,
  backingWidth: 1,
  backingHeight: 1,
  pixelRatioX: 1,
  pixelRatioY: 1,
};
const renderLayerFrame: CRCRenderLayerFrame = {
  frameId: 0,
  time: 0,
  delta: 0,
  deltaSeconds: 0,
  invalidate() {},
};
const renderLayerStyle: CRCRenderLayerStyle = { width: 1, height: 1 };
const renderLayerProps: CRCRenderLayerProps<RenderLayerConsumerProps> = {
  color: 'red',
  style: renderLayerStyle,
};
const renderLayerComponentProps: CRCRenderLayerComponentProps = {};
const renderLayerTargetIdentity: RenderLayerConsumerTarget = { id: 'target' };
const renderLayerHit: CRCRenderLayerHit<RenderLayerConsumerTarget> = {
  kind: 'target',
  target: renderLayerTargetIdentity,
};
const renderLayerTarget: CRCRenderLayerTarget<RenderLayerConsumerTarget> = {
  target: renderLayerTargetIdentity,
  keyboardFocusable: true,
};
const renderLayerSnapshot: CRCRenderLayerInteractionSnapshot<RenderLayerConsumerTarget> = {
  targets: [renderLayerTarget],
  hitTest() { return renderLayerHit; },
  onInput(input: Readonly<CRCRenderLayerInput<RenderLayerConsumerTarget>>) {
    void input.hit;
  },
};
const renderLayerInteraction: CRCRenderLayerInteraction<
  RenderLayerConsumerProps,
  RenderLayerConsumerResources,
  RenderLayerConsumerTarget
> = {
  settle() { return renderLayerSnapshot; },
};
const renderLayerDefinition: CRCRenderLayerDefinition<
  RenderLayerConsumerProps,
  RenderLayerConsumerResources,
  RenderLayerConsumerTarget
> = {
  create(context) { return { context }; },
  render() {},
  interaction: renderLayerInteraction,
};
const RenderLayerConsumer = defineRenderLayer(renderLayerDefinition);
createElement(RenderLayerConsumer, renderLayerProps);
void renderLayerSize;
void renderLayerFrame;
void renderLayerComponentProps;

type ThreeLayerConsumerProps = { exposure: number };
type ThreeLayerConsumerResources = CRCThreeLayerResources & {
  readonly initialExposure: number;
};
const ThreeLayerConsumer = defineThreeLayer<
  ThreeLayerConsumerProps,
  ThreeLayerConsumerResources
>({
  create(_context, props) {
    return {
      scene: new Scene(),
      camera: new PerspectiveCamera(),
      initialExposure: props.exposure,
    };
  },
});
createElement(ThreeLayerConsumer, {
  exposure: 1,
  missBehavior: 'block',
  style: { width: 64, height: 64, filter: sepiaFilter },
});

const ReservedThreeLayerConsumer = defineThreeLayer<
  { style: string },
  CRCThreeLayerResources
>({
  create() {
    return { scene: new Scene(), camera: new PerspectiveCamera() };
  },
});
type ReservedThreeLayerConsumerProps = Parameters<
  typeof ReservedThreeLayerConsumer
>[0];
type ReservedThreeLayerPropsAreNever = [ReservedThreeLayerConsumerProps] extends [
  never,
]
  ? true
  : false;
const reservedThreeLayerPropsAreNever: ReservedThreeLayerPropsAreNever = true;
void reservedThreeLayerPropsAreNever;
void ThreeRuntime;

createElement(StyledRuntimeProbe, { count: 2, style: { width: 3 } });
createElement(StyledRuntimeProbe, {
  count: 2,
  style: { custom: { source: 'consumer' }, width: 3 },
});
createElement(StyledRuntimeProbe, {
  count: 2,
  style: { width: 3, filter: sepiaFilter },
});
createElement(StyledRuntimeProbe, {
  count: 2,
  style: { width: 3, filter: publicFilterList },
});
// @ts-expect-error declared styles remain closed to excess properties
createElement(StyledRuntimeProbe, { count: 2, style: { unknown: true, width: 3 } });
// @ts-expect-error required style members make the style field required
createElement(StyledRuntimeProbe, { count: 2 });
// @ts-expect-error key is reserved descriptor metadata, not a program prop
definePrimitive<{ key: string }, SystemStyle>(() => undefined);
// @ts-expect-error style is reserved descriptor metadata, not a program prop
definePrimitive<{ style: string }, SystemStyle>(() => undefined);

type PartiallyReservedKeyProps =
  | { kind: 'value'; value: number }
  | { key: string; kind: 'reserved' };
type PartiallyReservedStyleProps =
  | { kind: 'value'; value: number }
  | { kind: 'reserved'; style: string };

// @ts-expect-error key is forbidden in every member of a program-props union
definePrimitive<PartiallyReservedKeyProps, SystemStyle>(() => undefined);
// @ts-expect-error style is forbidden in every member of a program-props union
definePrimitive<PartiallyReservedStyleProps, SystemStyle>(() => undefined);

type DisjointUnionStyle =
  | (SystemStyle & { opacity?: number })
  | (SystemStyle & { width: number });
const DisjointUnionStyleProbe = definePrimitive<{}, DisjointUnionStyle>(
  () => undefined,
);
createElement(DisjointUnionStyleProbe, { style: { opacity: 0.5 } });
createElement(DisjointUnionStyleProbe, { style: { width: 4 } });
// @ts-expect-error one union style member has a required field
createElement(DisjointUnionStyleProbe, {});

// @ts-expect-error arrays are not plain style schemas
definePrimitive<{}, string[]>(() => undefined);
// @ts-expect-error functions are not plain style schemas
definePrimitive<{}, () => void>(() => undefined);
// @ts-expect-error dates are not plain style schemas
definePrimitive<{}, Date>(() => undefined);
// @ts-expect-error URL instances are resources, not declared style schemas
definePrimitive<{}, URL>(() => undefined);
// @ts-expect-error Error instances are resources, not declared style schemas
definePrimitive<{}, Error>(() => undefined);
// @ts-expect-error Blob instances are resources, not declared style schemas
definePrimitive<{}, Blob>(() => undefined);

createElement((_props: object) => false, {});
createElement((_props: object) => null, {});
createElement((_props: object) => undefined, {});
createElement((_props: object) => '', {});
createElement((_props: object) => 0, {});

// @ts-expect-error required component props stay required
createElement(RuntimeProbe, {});
// @ts-expect-error excess component props are rejected
createElement(RuntimeProbe, { count: 1, unknown: true });
// @ts-expect-error crc requires an HTML Canvas
crc(document.createElement('div'), runtimeElement);
// @ts-expect-error crc requires a component element, not a component factory
crc(canvas, RuntimeProbe);
// @ts-expect-error crc signal must be an AbortSignal
crc(canvas, runtimeElement, { signal: 'abort' });
// @ts-expect-error responsive viewports do not accept a fit
crc(canvas, runtimeElement, { viewport: 'responsive', fit: 'contain' });
// @ts-expect-error fixed viewport dimensions must be numeric
crc(canvas, runtimeElement, { viewport: { width: '720', height: 420 } });
// @ts-expect-error pixelRatio accepts only device or a number
crc(canvas, runtimeElement, { pixelRatio: 'retina' });

const state = useSignal({ count: 0 });
const stateCount: number = state.get().count;
const typedState: WritableSignal<{ count: number }> = state;
typedState.set({ count: stateCount + 1 });
typedState.update(previous => ({ count: previous.count + 1 }));
// @ts-expect-error writable signals preserve the initialized value type
typedState.set({ count: 'one' });

const signalEquals: SignalEquals<number> = (previous, next) => previous === next;
const signalOptions: SignalOptions<number> = {
  debugName: 'package count',
  equals: signalEquals,
};
const inferredWritable = signal(1, signalOptions);
const writableCount: WritableSignal<number> = inferredWritable;
const readonlyCount: Signal<number> = writableCount.asReadonly();
const computedCount: Signal<number> = computed(() => readonlyCount.get() * 2);
const untrackedCount: number = untracked(() => computedCount.get());
const batchedResult: number = batch(() => 42);
const callbackSignal = signal<() => string>(() => 'ready');
const callbackValue: () => string = callbackSignal.get();
callbackSignal.set(() => 'updated');
const reactiveRectangleX = signal(10);
const reactiveRectangleFill = signal('red');
const reactiveRectangleHandler = signal<CRCEventHandler<'click'>>(() => {});
const reactiveRectangleStyle = signal<RectStyle>({
  left: 10,
  fill: 'red',
  width: 20,
  height: 20,
});
const signalValuedRectangle = createElement(Rectangle, {
  onClick: reactiveRectangleHandler,
  style: {
    left: reactiveRectangleX,
    fill: reactiveRectangleFill,
    width: 20,
    height: 20,
  },
});
const wholeSignalValuedRectangle = createElement(Rectangle, {
  style: reactiveRectangleStyle,
});
function SignalValueConsumer(props: { value: SignalValue<number> }): CRCNode {
  return createElement(Text, null, resolveSignalValue(props.value));
}
const customSignalValueConsumer = createElement(SignalValueConsumer, {
  value: reactiveRectangleX,
});
const ExactSignalConsumer = definePrimitive<{
  valueSignal: Signal<number>;
}>(() => undefined, { preserveSignalProps: ['valueSignal'] });
const exactSignalConsumer = createElement(ExactSignalConsumer, {
  valueSignal: reactiveRectangleX,
});
const unknownSignal: unknown = readonlyCount;
if (isSignal(unknownSignal)) {
  const narrowedSignal: Signal<unknown> = unknownSignal;
  void narrowedSignal.get();
}
void batchedResult;
void signalValuedRectangle;
void wholeSignalValuedRectangle;
void customSignalValueConsumer;
void exactSignalConsumer;

const animationOutput = signal(0);
const objectAnimationOutput = signal({ x: 0 });
const objectInterpolator: CRCInterpolator<{ x: number }> = (
  from,
  to,
  progress,
) => ({ x: from.x + (to.x - from.x) * progress });
const tweenDefinition: CRCAnimationDefinition<number> = tween({
  to: 10,
  duration: 100,
  easing: easing.easeInOut,
});
const springDefinition: CRCAnimationDefinition<number> = spring({ to: 20 });
const objectDefinition = tween({
  to: { x: 10 },
  duration: 100,
  interpolate: objectInterpolator,
});
const keyframeDefinition = keyframes({ values: [0, 5, 10], duration: 200 });
const customDefinition = defineAnimation<number>({
  duration: 10,
  sample: ({ progress }) => progress,
});
const fixedStepper = stepper<{ value: number }, number>({
  stepMilliseconds: 10,
  initial: value => ({ value }),
  step: state => ({ value: state.value + 1 }),
  read: state => state.value,
});
const animationProgram: CRCAnimationProgram = sequence(
  parallel(
    track(animationOutput, tweenDefinition),
    track(objectAnimationOutput, objectDefinition),
  ),
  marker('middle'),
  track(animationOutput, keyframeDefinition),
  wait(10),
  repeat(track(animationOutput, springDefinition), {
    iterations: 2,
    direction: 'alternate',
  }),
  track(animationOutput, customDefinition),
  track(animationOutput, fixedStepper),
);
const easingFunction: CRCEasing = easing.linear;
const repeatDirection: CRCAnimationRepeatDirection = 'alternate-reverse';
const repeatOptions: CRCAnimationRepeatOptions = {
  iterations: 2,
  direction: repeatDirection,
};
const tweenOptions: CRCTweenOptions<number> = { to: 1, duration: 10 };
const keyframesOptions: CRCKeyframesOptions<number> = {
  values: [0, 1],
  duration: 10,
};
const springOptions: CRCSpringOptions = { to: 1 };
const sampleInput: CRCAnimationSampleInput<number> = {
  initialValue: 0,
  localTime: 5,
  progress: 0.5,
};
const animationOptions: CRCAnimationOptions<number> = {
  duration: 10,
  sample: input => input.progress,
};
const stepperOptions: CRCStepperOptions<{ value: number }, number> = {
  stepMilliseconds: 10,
  initial: value => ({ value }),
  step: state => state,
  read: state => state.value,
};
const playbackOptions: CRCPlaybackOptions = { autoplay: false };
const playbackStatus: CRCPlaybackStatus = 'scheduled';
const playbackEvent = null as CRCPlaybackEvent | null;
const tweenTransitionOptions: CRCTweenAnimatedValueOptions<{ x: number }> = {
  type: 'tween',
  duration: 100,
  interpolate: objectInterpolator,
};
const springTransitionOptions: CRCSpringAnimatedValueOptions = { type: 'spring' };

function AnimationProbe(): CRCNode {
  const player: CRCPlayback = usePlayback(animationProgram, playbackOptions);
  const tweened = useAnimatedValue({ x: 10 }, tweenTransitionOptions);
  const sprung = useAnimatedValue(10, springTransitionOptions);
  return createElement(
    Text,
    null,
    `${player.status.get()}:${tweened.get().x}:${sprung.get()}`,
  );
}
createElement(AnimationProbe, {});

// @ts-expect-error spring values are number-only
spring({ to: 'done' });
const numberDefinition = tween({ to: 10, duration: 100 });
// @ts-expect-error a numeric definition cannot write an object signal
track(objectAnimationOutput, numberDefinition);
type CoreExports = typeof import('@crc/core');
// @ts-expect-error no free playback function is exported
type FreePlay = CoreExports['play'];

// @ts-expect-error readonly signals do not expose writes
readonlyCount.set(2);
// @ts-expect-error CRC style accepts resolved numbers, not signal containers
const badSignalStyle: RectStyle = { left: writableCount, width: 10, height: 10 };
// @ts-expect-error computed values are readonly
computed(() => writableCount.get() * 2).update(value => value + 1);
void untrackedCount;
void callbackValue;
void badSignalStyle;
void easingFunction;
void repeatOptions;
void tweenOptions;
void keyframesOptions;
void springOptions;
void sampleInput;
void animationOptions;
void stepperOptions;
void playbackStatus;
void playbackEvent;
void (null as unknown as FreePlay);

const constValue: Readonly<{ value: number }> = useConst(
  () => ({ value: stateCount }),
);
const computedValue: Signal<number> = useComputed(
  () => writableCount.get() + constValue.value,
  [constValue],
  { debugName: 'package consumer computed' },
);
computedValue.get();
// @ts-expect-error computed hook values are readonly
computedValue.set(1);

const reactionOptions: CRCReactionOptions = {
  debugName: 'package consumer reaction',
};
useReaction(() => {
  writableCount.get();
  return () => undefined;
}, [constValue], reactionOptions);
// @ts-expect-error reaction setup is synchronous
useReaction(async () => undefined);

const initializedRef: CRCRef<number> = useRef(1);
const emptyRef: CRCRef<string> = useRef<string>();
initializedRef.current = 2;
emptyRef.current = 'ready';
// @ts-expect-error refs preserve their generic current-value type
initializedRef.current = 'two';

const rectanglePath: Path2D = useRectPath(0, 0, 10, 20, {
  alignToPixelGrid: 'round',
  lineWidth: 1,
});
const linePath: Path2D = useLinePath([[0, 0], [10, 10]], {
  closePath: true,
});
const parsedPath: Path2D = useSvgPath('M 0 0 L 10 10');
rectanglePath.addPath(linePath);
parsedPath.addPath(rectanglePath);
// @ts-expect-error rectangle path geometry is numeric
useRectPath('0', 0, 10, 20);
// @ts-expect-error line coordinates are numeric tuples
useLinePath([['0', 0]]);
// @ts-expect-error SVG path input is a string
useSvgPath(123);

useEvent('click', (event: CRCLogicalMouseEvent) => {
  const x: number = event.x;
  const original: MouseEvent = event.originalEvent;
  void x;
  void original;
}, rectanglePath, true, 8);
const observer = (event: CRCMouseEvent) => {
  const x: number = event.x;
  const original: MouseEvent = event.originalEvent;
  void x;
  void original;
};
useEvent('mousemove', observer);
useEvent('mousemove', undefined);
useEvent('mousemove', event => {
  const x: number = event.x;
  void x;
  // @ts-expect-error pathless useEvent observers retain the legacy payload
  event.preventDefault();
});
// @ts-expect-error event names are limited to the public CRC event registry
useEvent('pointerdown', () => undefined);
// @ts-expect-error CRC handlers receive a logical mouse facade, not PointerEvent
useEvent('click', (_event: PointerEvent) => undefined);

useCursor({ style: 'crosshair' });
useCursor({
  path: linePath,
  style: 'pointer',
  fill: false,
  lineInteractionWidth: 8,
});
// @ts-expect-error cursor path must be a Path2D
useCursor({ path: 'line', style: 'pointer' });
// @ts-expect-error cursor configuration has no unrelated fields
useCursor({ style: 'pointer', capture: true });

const consumerPhysicsSphere = Physics3DGeometry.sphereShape3D({ radius: 1 });
const consumerPhysicsBox = Physics3DGeometry.boxShape3D({
  width: 2,
  height: 2,
  depth: 2,
});
const consumerPhysicsPose = {
  position: [0, 0, 0],
  orientation: [0, 0, 0, 1],
} as const satisfies Physics3DGeometryTypes.CRCPhysicsPose3D;

export const physics3DGeometryConsumer = {
  bounds: Physics3DGeometry.boundsOfShape3D(consumerPhysicsSphere),
  mass: Physics3DGeometry.massProperties3D(consumerPhysicsBox, { density: 1 }),
  contains: Physics3DGeometry.containsPoint3D(
    consumerPhysicsSphere,
    consumerPhysicsPose,
    [0, 0, 0],
  ),
  distance: Physics3DGeometry.distanceBetweenShapes3D(
    consumerPhysicsSphere,
    consumerPhysicsPose,
    consumerPhysicsBox,
    consumerPhysicsPose,
  ),
  overlap: Physics3DGeometry.overlapShapes3D(
    consumerPhysicsSphere,
    consumerPhysicsPose,
    consumerPhysicsBox,
    consumerPhysicsPose,
  ),
  contact: Physics3DGeometry.contactBetweenShapes3D(
    consumerPhysicsSphere,
    consumerPhysicsPose,
    consumerPhysicsBox,
    consumerPhysicsPose,
  ),
  ray: Physics3DGeometry.raycastShape3D(
    consumerPhysicsSphere,
    consumerPhysicsPose,
    { origin: [-2, 0, 0], direction: [1, 0, 0], maxDistance: 4 },
  ),
  cast: Physics3DGeometry.shapeCastAgainstShape3D(
    consumerPhysicsSphere,
    consumerPhysicsPose,
    [2, 0, 0],
    consumerPhysicsBox,
    { position: [4, 0, 0], orientation: [0, 0, 0, 1] },
  ),
  transformed: Physics3DGeometry.transformShape3D(
    consumerPhysicsSphere,
    consumerPhysicsPose,
  ),
  shapes: [
    Physics3DGeometry.ellipsoidShape3D({ radii: [1, 2, 3] }),
    Physics3DGeometry.capsuleShape3D({ start: [0, -1, 0], end: [0, 1, 0], radius: 0.5 }),
    Physics3DGeometry.cylinderShape3D({ radius: 1, halfHeight: 1 }),
    Physics3DGeometry.coneShape3D({ radius: 1, halfHeight: 1 }),
    Physics3DGeometry.convexHullShape3D({
      points: [[-1, -1, -1], [1, -1, -1], [0, 1, -1], [0, 0, 1]],
    }),
    Physics3DGeometry.triangleMeshShape3D({
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      indices: [0, 1, 2],
    }),
    Physics3DGeometry.heightfieldShape3D({
      rows: 2,
      columns: 2,
      heights: [0, 0, 0, 0],
    }),
  ],
};

void (undefined as unknown as Physics3DGeometryTypes.CRCPhysicsShape3D);

// Editable path geometry is consumed exclusively through the public entry.
import { PathGeometry, toPath2D, toSvgPathData } from '@crc/core';
import type { PathSegment } from '@crc/core';
const editableOutline = new PathGeometry();
editableOutline.rect(0, 0, 20, 20);
editableOutline.arc(20, 20, 10, 0, Math.PI);
editableOutline.addPath(editableOutline.clone(), { e: 10 });
const editableSegment: PathSegment = editableOutline.getSegment(0);
editableOutline.setSegment(0, editableSegment);
const editableNative: Path2D = toPath2D(editableOutline);
const editableSvg: string = toSvgPathData(editableOutline);
void [editableNative, editableSvg];
import { flattenPath, simplifyPath, subdividePath } from '@crc/core';
const flattenedOutline = flattenPath(editableOutline, { tolerance: 0.25 });
void simplifyPath(flattenedOutline, { tolerance: 0.5 });
void subdividePath(editableOutline, { divisions: 2 });
const editableTarget: CRCEventTargetOptions = { path: editableOutline, fill: true };
void editableTarget;

import { warpPath, type PathWarpPoint, type PathWarpRect, type PathWarpCorners, type PathWarpMode, type WarpPathOptions } from '@crc/core';
const warpOrigin: PathWarpPoint = { x: 0, y: 0 };
const warpSource: PathWarpRect = { ...warpOrigin, width: 20, height: 20 };
const warpCorners: PathWarpCorners = { topLeft: warpOrigin, topRight: { x: 30, y: 0 }, bottomLeft: { x: 0, y: 20 }, bottomRight: { x: 20, y: 20 } };
for (const mode of ['bilinear', 'perspective'] satisfies PathWarpMode[]) {
  const options: WarpPathOptions = { source: warpSource, destination: warpCorners, mode, tolerance: 0.25 };
  const warped: PathGeometry = warpPath(editableOutline, options);
  void toSvgPathData(warped);
}

import {
  bendPathAlongArc, bendPathAlongPath,
  type PathBendFrame, type PathBendArc, type PathBendAlign, type PathBendBaseline,
  type PathBendFit, type PathBendOverflow, type PathBendOptions, type BendPathAlongArcOptions,
} from '@crc/core';
const bendFrame: PathBendFrame = { x: 0, y: 0, width: 20, height: 20 };
const bendArc: PathBendArc = { cx: 50, cy: 50, radius: 40, startAngle: 0, sweep: Math.PI };
const bendAlign: PathBendAlign = 'center';
const bendBaseline: PathBendBaseline = 'bottom';
const bendFit: PathBendFit = 'stretch';
const bendOverflow: PathBendOverflow = 'extend';
const bendOptions: Readonly<PathBendOptions> = { source: bendFrame, align: bendAlign, baseline: bendBaseline, fit: bendFit, overflow: bendOverflow, tolerance: 0.1 };
const bendArcOptions: Readonly<BendPathAlongArcOptions> = { ...bendOptions, arc: bendArc };
const bendGuide = new PathGeometry(); bendGuide.moveTo(0, 0); bendGuide.quadraticCurveTo(50, 0, 100, 50);
const bentArc: PathGeometry = bendPathAlongArc(editableOutline, bendArcOptions);
const bentPath: PathGeometry = bendPathAlongPath(editableOutline, bendGuide, bendOptions);
void [toSvgPathData(bentArc), toSvgPathData(bentPath)];


// HtmlBox preserves the application's generic payload across mount and update.
const htmlMount: import('@crc/core').HtmlMountCallback<{ label: string }> = (element, initial, abort) => {
  element.textContent = initial.label;
  element.addEventListener('click', () => undefined, { signal: abort });
  return next => { element.textContent = next.label; };
};
createElement(HtmlBox, { data: { label: 'native' }, mount: htmlMount, style: { width: 120, height: 40, rotationDegrees: 5 } });
// @ts-expect-error payload and mount callback types must agree
createElement(HtmlBox<{ label: string }>, { data: { label: 42 }, mount: htmlMount });
const htmlConfig: CRCConfig = { viewport: 'responsive', htmlOverlay: undefined };
void htmlConfig;

// Ember physics stays opt-in and uses receiver-local swept point collisions.
import { embers as physicsEmbers, type CRCEmbersPhysicsOptions, type CRCEmberCollision } from '@crc/core';
const emberHit: CRCEmberCollision = {fraction:.5,normal:[0,-1]};
const emberPhysicsOptions: CRCEmbersPhysicsOptions = {gravity:[0,500],wind:[20,0],drag:3,restitution:.5,collide:()=>emberHit};
void physicsEmbers({region:{x:0,y:0,width:100,height:100},linger:1000,physics:emberPhysicsOptions});
// @ts-expect-error collision callbacks must return a hit synchronously
const asyncEmberPhysics: CRCEmbersPhysicsOptions = {collide:async()=>emberHit};
void asyncEmberPhysics;
import { flattenPathWang, simplifyPathRadial } from '@crc/core';
const wangOutline: PathGeometry = flattenPathWang(editableOutline, { tolerance: 0.25 });
const radialOutline: PathGeometry = simplifyPathRadial(wangOutline, { tolerance: 0.5 });
void radialOutline;


const packedSmoke = defineParticleEffect2D({ emitters: [{
  name: 'smoke', capacity: 32, emission: [{ type: 'manual', count: 1 }],
  shape: { type: 'point' }, initial: { lifetimeMilliseconds: 1000 },
  renderer: { type: 'circle' },
}] });
function PackedFlowScene() {
  const obstacles: CRCFlowObstacleSource2D = physicsObstacles2D(crcPhysicsWorld2D());
  const field: CRCFlowField2D = useFlowField2D({ bounds: { width: 240, height: 160 }, resolution: [24, 16], obstacles });
  useFlowSource2D(field, { position: useSignal<readonly [number, number]>([120, 120]), radius: 24, heat: 2 });
  const system = useParticleSystem(packedSmoke, { flow: field });
  field.sampleBatch(new Float32Array([120, 80]), new Float32Array(2), 1);
  return createElement(Particles2D, { system, pointerEvents: 'none' as const, style: { width: 240, height: 160 } });
}
createElement(PhysicsWorld2D, {}, createElement(PackedFlowScene, {}));
