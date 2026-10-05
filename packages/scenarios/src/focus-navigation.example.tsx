import {
  FocusManagement,
  KeyboardNavigation,
  useEventTarget,
  Rectangle,
  Text,
  type CRCEventTargetSnapshot,
  type CRCKeyboardEvent,
  type CRCLogicalMouseEvent,
  type CRCNode,
} from '@crc/core';
export const FOCUS_NAVIGATION_SOURCE_ID =
  'focus-and-keyboard-navigation-example';
/**
 * Actions supported by the focus navigation scenario's public controller.
 *
 * @see {@link FocusNavigationState}
 */
export type FocusNavigationAction =
  'remove-current-square' | 'reorder-squares' | 'restore-squares';
/**
 * A stable logical focus target in the keyboard-navigation scenario.
 *
 * @see {@link FocusNavigationState}
 */
export type FocusNavigationTarget =
  | 'none'
  | 'top-primary'
  | 'top-form-like'
  | `square-${number}`
  | 'bottom-primary'
  | 'bottom-secondary';
/**
 * Supported focus navigation activation source values: `"none"`, `"click"`, `"enter"`, `"space"`.
 *
 * @see {@link FocusNavigationState}
 */
export type FocusNavigationActivationSource =
  'none' | 'click' | 'enter' | 'space';
/**
 * Supported focus navigation modality values: `"none"`, `"keyboard"`, `"pointer"`.
 *
 * @see {@link FocusNavigationState}
 */
export type FocusNavigationModality = 'none' | 'keyboard' | 'pointer';
/**
 * Observable state exposed by the focus navigation scenario for controls and assertions.
 *
 * @see {@link FocusNavigationTarget}
 * @see {@link FocusNavigationActivationSource}
 * @see {@link FocusNavigationModality}
 * @see {@link FocusNavigationAction}
 */
export interface FocusNavigationState {
  /** Current target recorded or configured by this scenario. See {@link FocusNavigationTarget}. */
  currentTarget: FocusNavigationTarget;
  /**
   * Last activation source recorded or configured by this scenario. See
   * {@link FocusNavigationActivationSource}.
   */
  lastActivationSource: FocusNavigationActivationSource;
  /** Activation count recorded or configured by this scenario. See {@link FocusNavigationState}. */
  activationCount: number;
  /**
   * Focus visible modality recorded or configured by this scenario. See
   * {@link FocusNavigationModality}.
   */
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
function activationLabel(
  snapshot: CRCEventTargetSnapshot,
  label: string,
): string {
  if (snapshot.isFocusVisible) return `▶ ${label}`;
  if (snapshot.isFocused) return `● ${label}`;
  return label;
}
const CanvasControl = function CanvasControl({
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
}: ControlProps) {
  const geometry = rectanglePath(x, y, width, height);
  const snapshot = useEventTarget(
    {
      onBlur: () => onFocusChange('none'),
      onClick: (event) => onActivation(target, event),
      onFocus: () => onFocusChange(target),
      onKeyDown: ownsHorizontalArrows
        ? (event: CRCKeyboardEvent) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault();
            }
          }
        : undefined,
    },
    {
      path: geometry,
      fill: true,
      keyboardFocusable: true,
      keyboardNavigationBounds: navigation
        ? {
            x,
            y,
            width,
            height,
          }
        : undefined,
      cursor: 'pointer',
    },
  );
  onFocusSnapshot(target, snapshot);
  return [
    <Rectangle
      pointerEvents="none"
      style={{
        left: x,
        top: y,
        width,
        height,
        fill,
        stroke: snapshot.isFocused ? '#020617' : '#475569',
        strokeWidth: snapshot.isFocused ? 3 : 1,
      }}
    />,
    snapshot.isFocusVisible ? (
      <Rectangle
        pointerEvents="none"
        style={{
          left: x - 5,
          top: y - 5,
          width: width + 10,
          height: height + 10,
          stroke: '#020617',
          strokeWidth: 3,
        }}
      />
    ) : undefined,
    <Text
      pointerEvents="none"
      style={{
        left: x + width / 2,
        top: y + height / 2,
        textAlign: 'center',
        textBaseline: 'middle',
        font: navigation ? '700 14px Arial' : '700 13px Arial',
        fill: '#ffffff',
      }}
    >
      {activationLabel(snapshot, label)}
    </Text>,
  ];
};
const DirectionalSquares = function DirectionalSquares(
  props: FocusNavigationSceneProps,
) {
  return props.squareLabels.map((value, index) => (
    <CanvasControl
      key={`square-${value}`}
      {...props}
      fill="#2563eb"
      height={48}
      label={String(value)}
      navigation
      target={`square-${value}`}
      width={48}
      x={80 + (index % 4) * 100}
      y={130 + Math.floor(index / 4) * 70}
    />
  ));
};
const FocusNavigationScene = function FocusNavigationScene(
  props: FocusNavigationSceneProps,
) {
  return [
    <Rectangle
      pointerEvents="none"
      style={{
        left: 0,
        top: 0,
        width: 560,
        height: 420,
        fill: '#f8fafc',
      }}
    />,
    <Text
      pointerEvents="none"
      style={{
        left: 28,
        top: 25,
        font: '700 15px Arial',
        fill: '#0f172a',
      }}
    >
      {'One Tab order · arrows stay inside the square boundary'}
    </Text>,
    <CanvasControl
      {...props}
      fill="#0f766e"
      height={44}
      label="Top action"
      target="top-primary"
      width={150}
      x={40}
      y={48}
    />,
    <CanvasControl
      {...props}
      fill="#7c3aed"
      height={44}
      label="Owns ← →"
      ownsHorizontalArrows
      target="top-form-like"
      width={150}
      x={210}
      y={48}
    />,
    <KeyboardNavigation mode="directional">
      <DirectionalSquares {...props} />
    </KeyboardNavigation>,
    <CanvasControl
      {...props}
      fill="#b45309"
      height={42}
      label="Bottom action"
      target="bottom-primary"
      width={150}
      x={40}
      y={350}
    />,
    <CanvasControl
      {...props}
      fill="#be123c"
      height={42}
      label="Last action"
      target="bottom-secondary"
      width={150}
      x={210}
      y={350}
    />,
    <Text
      pointerEvents="none"
      style={{
        left: 390,
        top: 356,
        font: '13px Arial',
        fill: '#334155',
      }}
    >{`focused: ${props.state.currentTarget}`}</Text>,
    <Text
      pointerEvents="none"
      style={{
        left: 390,
        top: 380,
        font: '13px Arial',
        fill: '#334155',
      }}
    >{`activations: ${props.state.activationCount}`}</Text>,
  ];
};
export function createFocusNavigationScene(
  props: FocusNavigationSceneProps,
): CRCNode {
  return (
    <FocusManagement>
      <FocusNavigationScene {...props} />
    </FocusManagement>
  );
}
