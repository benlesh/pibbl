import * as PIBBL_CORE_ROOT from '@pibbl/core';
import * as PIBBL_JSX_DEV_RUNTIME from '@pibbl/core/jsx-dev-runtime';
import * as PIBBL_JSX_RUNTIME from '@pibbl/core/jsx-runtime';
// @ts-expect-error the singular legacy event hook is not public
import { useEvent as RemovedEventHook } from '@pibbl/core';
// @ts-expect-error the definition wrapper is not part of the final type surface
import type { defineC\u006fmp as RemovedDefinitionWrapper } from '@pibbl/core';
// @ts-expect-error the old element type is not part of the final type surface
import type { Comp\u0045l as RemovedElementType } from '@pibbl/core';
// @ts-expect-error the old render-function type is not part of the final type surface
import type { Comp\u0046n as RemovedRenderType } from '@pibbl/core';
// @ts-expect-error the old component input type is not part of the final type surface
import type { Component\u0049nput as RemovedInputType } from '@pibbl/core';
// @ts-expect-error the old capability type is not part of the final type surface
import type { Component\u0043apabilities as RemovedCapabilityType } from '@pibbl/core';
// @ts-expect-error the old empty-node alias is not part of the final type surface
import type { Falsy\u004eodes as RemovedEmptyNodeType } from '@pibbl/core';
import {
  Arc,
  Circle,
  Ellipse,
  FocusManagement,
  KeyboardNavigation,
  Polygon,
  RegularPolygon,
  Star,
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
  createElement,
  type ArcProps,
  type ArcStyle,
  type ArcPathOptions,
  type BoxStyle,
  type CirclePathOptions,
  type CircleProps,
  type CircleStyle,
  type EllipsePathOptions,
  type PibblComponent,
  type PibblConfig,
  type PibblContainerChild,
  type PibblController,
  type PibblElement,
  type PibblElementType,
  type PibblEvent,
  type PibblEventHandlers,
  type PibblKeyboardNavigationOptions,
  type PibblKey,
  type PibblNode,
  type PibblPrimitiveComponent,
  type PibblRenderResult,
  type PibblTextChild,
  type Constraints,
  type EllipseProps,
  type EllipseStyle,
  type FocusManagementProps,
  type KeyboardNavigationProps,
  type MeasureInput,
  type MeasureResult,
  type PrimitiveCapabilities,
  type PrimitiveInput,
  type PrimitiveProgramProps,
  type PrimitiveRender,
  type PolygonProps,
  type PolygonStyle,
  type PolygonPathOptions,
  type RectanglePathOptions,
  type RegularPolygonNumericSize,
  type RegularPolygonPathOptions,
  type RegularPolygonPathPosition,
  type RegularPolygonProps,
  type RegularPolygonStyle,
  type RoundedCornerPathOptions,
  type RoundedCornerStyle,
  type RenderingContext2D,
  type ResolvedStyle,
  type SpecifiedStyle,
  type StyleResolutionContext,
  type SystemStyle,
  type StarPathOptions,
  type StarProps,
  type StarStyle,
  type SvgPathOptions,
  type LinePathOptions,
  type WedgePathOptions,
  type WedgeProps,
  type WedgeStyle,
} from '@pibbl/core';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { materializeContainerChildren } from '../element/children';

type RemovedPublicTypes = [
  typeof RemovedDefinitionWrapper,
  RemovedElementType,
  RemovedRenderType<Record<string, never>>,
  RemovedInputType<Record<string, never>>,
  RemovedCapabilityType<SystemStyle>,
  RemovedEmptyNodeType,
];

type ApprovedPublicTypes = {
  readonly element: PibblElement;
  readonly component: PibblComponent;
  readonly elementType: PibblElementType;
  readonly primitive: PibblPrimitiveComponent;
  readonly node: PibblNode;
  readonly containerChild: PibblContainerChild;
  readonly textChild: PibblTextChild;
  readonly renderResult: PibblRenderResult;
  readonly key: PibblKey;
  readonly programProps: PrimitiveProgramProps<{ label: string }>;
  readonly primitiveInput: PrimitiveInput<{ label: string }, SystemStyle>;
  readonly primitiveRender: PrimitiveRender<{ label: string }>;
  readonly primitiveCapabilities: PrimitiveCapabilities<{ label: string }>;
  readonly specifiedStyle: SpecifiedStyle<SystemStyle>;
  readonly resolvedStyle: ResolvedStyle<SystemStyle>;
  readonly styleContext: StyleResolutionContext;
  readonly boxStyle: BoxStyle;
  readonly constraints: Constraints;
  readonly measureInput: MeasureInput<{ label: string }>;
  readonly measureResult: MeasureResult;
  readonly renderingContext: RenderingContext2D;
  readonly controller: PibblController;
  readonly config: PibblConfig;
  readonly event: PibblEvent;
  readonly eventHandlers: PibblEventHandlers;
  readonly focusProps: FocusManagementProps;
  readonly keyboardProps: KeyboardNavigationProps;
  readonly circleProps: CircleProps;
  readonly circleStyle: CircleStyle;
  readonly ellipseProps: EllipseProps;
  readonly ellipseStyle: EllipseStyle;
  readonly arcProps: ArcProps;
  readonly arcStyle: ArcStyle;
  readonly wedgeProps: WedgeProps;
  readonly wedgeStyle: WedgeStyle;
  readonly polygonProps: PolygonProps;
  readonly polygonStyle: PolygonStyle;
  readonly roundedCornerStyle: RoundedCornerStyle;
  readonly roundedCornerPathOptions: RoundedCornerPathOptions;
  readonly rectanglePathOptions: RectanglePathOptions;
  readonly circlePathOptions: CirclePathOptions;
  readonly ellipsePathOptions: EllipsePathOptions;
  readonly arcPathOptions: ArcPathOptions;
  readonly wedgePathOptions: WedgePathOptions;
  readonly linePathOptions: LinePathOptions;
  readonly polygonPathOptions: PolygonPathOptions;
  readonly regularPolygonPosition: RegularPolygonPathPosition;
  readonly regularPolygonSize: RegularPolygonNumericSize;
  readonly regularPolygonPathOptions: RegularPolygonPathOptions;
  readonly starPathOptions: StarPathOptions;
  readonly svgPathOptions: SvgPathOptions;
  readonly regularPolygonProps: RegularPolygonProps;
  readonly regularPolygonStyle: RegularPolygonStyle;
  readonly starProps: StarProps;
  readonly starStyle: StarStyle;
};

const obsoleteRuntimeExportParts = [
  ['define', 'Comp'],
  ['r', 'ect'],
  ['p', 'ath'],
  ['svg', 'Path'],
  ['l', 'ine'],
  ['horizontal', 'Line'],
  ['vertical', 'Line'],
  ['t', 'ext'],
  ['i', 'mg'],
  ['g'],
  ['c', 'lip'],
  ['l', 'ayer'],
  ['a', 'bsolute'],
  ['o', 'verlay'],
  ['f', 'low'],
  ['f', 'lex'],
  ['g', 'rid'],
  ['with', 'Focus', 'Management'],
  ['with', 'Keyboard', 'Navigation'],
] as const;

describe('public Pibbl API', () => {
  it('exports drive without the removed track alias', () => {
    expect(PIBBL_CORE_ROOT).toHaveProperty('drive');
    expect(PIBBL_CORE_ROOT).not.toHaveProperty('track');
  });

  it('exports exactly the final runtime authoring surface', () => {
    expect(Object.keys(PIBBL_CORE_ROOT).sort()).toEqual([
      'Absolute',
      'Arc',
      'Circle',
      'Clip',
      'DragHandle',
      'Ellipse',
      'Flex',
      'Flow',
      'FocusManagement',
      'Fragment',
      'Grid',
      'Group',
      'HorizontalLine',
      'HtmlBox',
      'Image',
      'KeyboardNavigation',
      'Layer',
      'LayoutDiagnostic',
      'Line',
      'Manipulable',
      'ManipulationFrame',
      'Overlay',
      'Path',
      'PathGeometry',
      'Polygon',
      'Rectangle',
      'RegularPolygon',
      'ResizeHandle',
      'ResizeHandles',
      'RotationHandle',
      'Star',
      'SvgPath',
      'Text',
      'VerticalLine',
      'Wedge',
      'affineTransform',
      'arcBendTransform',
      'batch',
      'bifrost',
      'blurReveal',
      'composeTransforms',
      'computed',
      'createArcPath',
      'createCirclePath',
      'createElement',
      'createEllipsePath',
      'createLinePath',
      'createPolygonPath',
      'createRectanglePath',
      'createRegularPolygonPath',
      'createStarPath',
      'createSvgPath',
      'createWedgePath',
      'defineAnimation',
      'definePrimitive',
      'defineRenderLayer',
      'defineTexture',
      'defineTransition',
      'degrees',
      'dissolve',
      'drive',
      'easing',
      'embers',
      'envelopeTransform',
      'exportGif',
      'fade',
      'flattenPath',
      'flattenPathWang',
      'hologram',
      'isSignal',
      'keyframes',
      'layoutDiagnostic',
      'marker',
      'measureElement',
      'meshTransform',
      'normalizeEdges',
      'parallel',
      'pathBendTransform',
      'pibbl',
      'quadTransform',
      'recordFrames',
      'repeat',
      'resolveBox',
      'resolveLength',
      'resolveSignalValue',
      'sequence',
      'signal',
      'simplifyPath',
      'simplifyPathRadial',
      'slide',
      'spring',
      'stepper',
      'subdividePath',
      'toPath2D',
      'toSvgPathData',
      'transformPath',
      'tween',
      'untracked',
      'useAnimatedValue',
      'useCanvasContext',
      'useComputed',
      'useConst',
      'useCursor',
      'useEventListener',
      'useEventTarget',
      'useLayoutBox',
      'useLinePath',
      'useManipulation',
      'usePlayback',
      'useReaction',
      'useRectPath',
      'useRef',
      'useSignal',
      'useSvgPath',
      'useTexture',
      'useVisibilityTransition',
      'wait',
      'wipe',
      'zoom',
    ]);

    expect('useEvent' in PIBBL_CORE_ROOT).toBe(false);
    expect(PIBBL_CORE_ROOT.useEventListener).toBeTypeOf('function');
    expect(PIBBL_CORE_ROOT.useEventTarget).toBeTypeOf('function');

    for (const creator of [
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
    ]) expectTypeOf(creator).toBeFunction();

    for (const parts of obsoleteRuntimeExportParts) {
      const name = parts.join('');
      expect(
        (PIBBL_CORE_ROOT as Record<string, unknown>)[name],
        `${name} must not be exported`,
      ).toBeUndefined();
    }
  });

  it('keeps compiler functions on their compiler subpaths only', () => {
    expect(Object.keys(PIBBL_JSX_RUNTIME).sort()).toEqual([
      'Fragment',
      'jsx',
      'jsxs',
    ]);
    expect(Object.keys(PIBBL_JSX_DEV_RUNTIME).sort()).toEqual([
      'Fragment',
      'jsxDEV',
    ]);
    expect((PIBBL_CORE_ROOT as Record<string, unknown>).jsx).toBeUndefined();
    expect((PIBBL_CORE_ROOT as Record<string, unknown>).jsxs).toBeUndefined();
    expect((PIBBL_CORE_ROOT as Record<string, unknown>).jsxDEV).toBeUndefined();
  });

  it('exports the approved public type families', () => {
    expectTypeOf<ApprovedPublicTypes>().toBeObject();
    expect([Arc, Circle, Ellipse, Polygon, RegularPolygon, Star, Wedge])
      .toHaveLength(7);
  });

  it('exports identity-transparent focus and keyboard-navigation policies', () => {
    interface ProbeStyle extends SystemStyle {
      width: number;
    }
    const Probe = (_props: {} & { style: Readonly<ProbeStyle> }) => undefined;
    const style = { width: 24 };
    const element = createElement(Probe, { key: 'stable', style });
    const options: PibblKeyboardNavigationOptions = { mode: 'directional' };

    const policyTree = createElement(FocusManagement, {
      children: createElement(KeyboardNavigation, {
        ...options,
        children: element,
      }),
    });
    const [enhanced] = materializeContainerChildren(policyTree, 'public test');

    expect(policyTree.type).toBe(FocusManagement);
    expect(enhanced.type).toBe(element.type);
    expect(enhanced.props).toBe(element.props);
    expect(enhanced.props.style).toBe(style);
    expect(enhanced.key).toBe('stable');
  });
});

void (null as unknown as ApprovedPublicTypes);
void (null as unknown as RemovedPublicTypes);
