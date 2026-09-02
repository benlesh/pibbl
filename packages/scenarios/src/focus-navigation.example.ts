import {
  FocusManagement,
  KeyboardNavigation,
  createElement,
  crcEventTarget,
  defineComp,
  rect,
  text,
  type CRCEventTargetSnapshot,
  type CRCKeyboardEvent,
  type CRCLogicalMouseEvent,
  type CRCNode,
} from '@crc/core';

export const FOCUS_NAVIGATION_SOURCE_ID =
  'focus-and-keyboard-navigation-example';

export type FocusNavigationAction =
  | 'remove-current-square'
  | 'reorder-squares'
  | 'restore-squares';

export type FocusNavigationTarget =
  | 'none'
  | 'top-primary'
  | 'top-form-like'
  | `square-${number}`
  | 'bottom-primary'
  | 'bottom-secondary';

export type FocusNavigationActivationSource =
  | 'none'
  | 'click'
  | 'enter'
  | 'space';

export type FocusNavigationModality = 'none' | 'keyboard' | 'pointer';

export interface FocusNavigationState {
  currentTarget: FocusNavigationTarget;
  lastActivationSource: FocusNavigationActivationSource;
  activationCount: number;
  focusVisibleModality: FocusNavigationModality;
}

export interface FocusNavigationSceneProps {
  readonly squareLabels: readonly number[];
  readonly state: FocusNavigationState;
  readonly onActivation: (
    target: FocusNavigationTarget,
    event: CRCLogicalMouseEvent,
  ) => void;
  readonly onFocusChange: (target: FocusNavigationTarget) => void;
  readonly onFocusSnapshot: (
    target: FocusNavigationTarget,
    snapshot: CRCEventTargetSnapshot,
  ) => void;
}

interface ControlProps extends Omit<FocusNavigationSceneProps, 'squareLabels'> {
  readonly fill: string;
  readonly height: number;
  readonly label: string;
  readonly navigation?: boolean;
  readonly ownsHorizontalArrows?: boolean;
  readonly target: FocusNavigationTarget;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

function rectanglePath(
  x: number,
  y: number,
  width: number,
  height: number,
): Path2D {
  const path = new Path2D();
  path.rect(x, y, width, height);
  return path;
}

function activationLabel(snapshot: CRCEventTargetSnapshot, label: string): string {
  if (snapshot.isFocusVisible) return `▶ ${label}`;
  if (snapshot.isFocused) return `● ${label}`;
  return label;
}

const CanvasControl = defineComp<ControlProps>(function CanvasControl({
  fill,
  height,
  label,
  navigation = false,
  onActivation,
  onFocusChange,
  onFocusSnapshot,
  ownsHorizontalArrows = false,
  target,
  width,
  x,
  y,
}) {
  const geometry = rectanglePath(x, y, width, height);
  const snapshot = crcEventTarget({
    onBlur: () => onFocusChange('none'),
    onClick: event => onActivation(target, event),
    onFocus: () => onFocusChange(target),
    onKeyDown: ownsHorizontalArrows ? (event: CRCKeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
      }
    } : undefined,
  }, {
    path: geometry,
    fill: true,
    keyboardFocusable: true,
    keyboardNavigationBounds: navigation ? { x, y, width, height } : undefined,
    cursor: 'pointer',
  });
  onFocusSnapshot(target, snapshot);

  return [
    rect({
      style: {
        x,
        y,
        width,
        height,
        fill,
        stroke: snapshot.isFocused ? '#020617' : '#475569',
        strokeWidth: snapshot.isFocused ? 3 : 1,
      },
    }),
    snapshot.isFocusVisible ? rect({
      style: {
        x: x - 5,
        y: y - 5,
        width: width + 10,
        height: height + 10,
        stroke: '#020617',
        strokeWidth: 3,
      },
    }) : undefined,
    text({
      style: {
        x: x + width / 2,
        y: y + height / 2,
        text: activationLabel(snapshot, label),
        textAlign: 'center',
        textBaseline: 'middle',
        font: navigation ? '700 14px Arial' : '700 13px Arial',
        fill: '#ffffff',
      },
    }),
  ];
});

const DirectionalSquares = defineComp<FocusNavigationSceneProps>(function DirectionalSquares(
  props,
) {
  return props.squareLabels.map((value, index) => CanvasControl({
    key: `square-${value}`,
    ...props,
    fill: '#2563eb',
    height: 48,
    label: String(value),
    navigation: true,
    target: `square-${value}`,
    width: 48,
    x: 80 + (index % 4) * 100,
    y: 130 + Math.floor(index / 4) * 70,
  }));
});

const FocusNavigationScene = defineComp<FocusNavigationSceneProps>(function FocusNavigationScene(
  props,
) {
  return [
    rect({ style: { x: 0, y: 0, width: 560, height: 420, fill: '#f8fafc' } }),
    text({
      style: {
        x: 28,
        y: 25,
        text: 'One Tab order · arrows stay inside the square boundary',
        font: '700 15px Arial',
        fill: '#0f172a',
      },
    }),
    CanvasControl({ ...props, fill: '#0f766e', height: 44, label: 'Top action', target: 'top-primary', width: 150, x: 40, y: 48 }),
    CanvasControl({ ...props, fill: '#7c3aed', height: 44, label: 'Owns ← →', ownsHorizontalArrows: true, target: 'top-form-like', width: 150, x: 210, y: 48 }),
    directionalPolicy(DirectionalSquares(props)),
    CanvasControl({ ...props, fill: '#b45309', height: 42, label: 'Bottom action', target: 'bottom-primary', width: 150, x: 40, y: 350 }),
    CanvasControl({ ...props, fill: '#be123c', height: 42, label: 'Last action', target: 'bottom-secondary', width: 150, x: 210, y: 350 }),
    text({ style: { x: 390, y: 356, text: `focused: ${props.state.currentTarget}`, font: '13px Arial', fill: '#334155' } }),
    text({ style: { x: 390, y: 380, text: `activations: ${props.state.activationCount}`, font: '13px Arial', fill: '#334155' } }),
  ];
});

export function createFocusNavigationScene(
  props: FocusNavigationSceneProps,
): CRCNode {
  return focusManaged(FocusNavigationScene(props));
}

function focusManaged(child: CRCNode): CRCNode {
  return createElement(FocusManagement, {
    children: child as Parameters<typeof FocusManagement>[0]['children'],
  });
}

function directionalPolicy(child: CRCNode): CRCNode {
  return createElement(KeyboardNavigation, {
    mode: 'directional',
    children: child as Parameters<typeof KeyboardNavigation>[0]['children'],
  });
}
