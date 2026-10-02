import {
  computed,
  FocusManagement,
  useEventTarget,
<<<<<<< HEAD
  useEventListener,
=======
>>>>>>> origin/main
  Group,
  Layer,
  Rectangle,
  Text,
  type CRCLogicalMouseEvent,
  type CRCPointerEvent,
  type Signal,
} from '@crc/core';

export const AGENT_TARGETING_VERIFICATION_SOURCE_ID = 'agent-targeting-verification-example';

export type AgentTargetingMode = 'seed' | 'repair' | 'intentional-block' | 'capture-drag' | 'keyboard-focus';
export type AgentTargetingDelivery = 'action' | 'decoration' | null;

export interface AgentTargetingSceneProps {
<<<<<<< HEAD
  readonly wrapClick: (label: string, handler: (event: CRCLogicalMouseEvent) => void) => (event: CRCLogicalMouseEvent) => void;
=======
>>>>>>> origin/main
  readonly mode: Signal<AgentTargetingMode>;
  readonly onFocusEvidence: () => void;
  readonly onCapturedMove: (event: CRCPointerEvent) => void;
  readonly selectionLabel: Signal<string>;
  readonly selectedItem: Signal<'item-a' | null>;
  readonly selections: Signal<number>;
  readonly deliveredTo: Signal<AgentTargetingDelivery>;
  readonly onDelivery: (
    deliveredTo: Exclude<AgentTargetingDelivery, null>,
    event: CRCLogicalMouseEvent,
  ) => void;
  readonly onRender: (state: { mode: AgentTargetingMode; selectedItem: 'item-a' | null; selections: number; deliveredTo: AgentTargetingDelivery }) => void;
}

<<<<<<< HEAD
function KeyboardAction({ onDelivery, onFocusEvidence, wrapClick }: Pick<AgentTargetingSceneProps, 'onDelivery' | 'onFocusEvidence' | 'wrapClick'>) {
  const path = new Path2D(); path.rect(40, 32, 128, 96);
  const focus = useEventTarget({
    onClick: wrapClick('action', event => onDelivery('action', event)),
    onFocus: onFocusEvidence, onBlur: onFocusEvidence, onKeyUp: onFocusEvidence,
  }, { path, fill: true, keyboardFocusable: true });
  return <>
    <Rectangle pointerEvents="none" style={{ x: 40, y: 32, width: 128, height: 96, fill: '#2563eb', stroke: '#1e3a8a', strokeWidth: 2 }} />
    {focus.isFocusVisible ? <Rectangle pointerEvents="none" style={{ x: 36, y: 28, width: 136, height: 104, stroke: '#ff00ff', strokeWidth: 2 }} /> : null}
=======
function KeyboardAction({ onDelivery, onFocusEvidence }: Pick<AgentTargetingSceneProps, 'onDelivery' | 'onFocusEvidence'>) {
  const path = new Path2D(); path.rect(40, 32, 128, 96);
  const focus = useEventTarget({
    onClick: event => onDelivery('action', event),
    onFocus: onFocusEvidence, onBlur: onFocusEvidence, onKeyUp: onFocusEvidence,
  }, { path, fill: true, keyboardFocusable: true });
  return <>
    <Rectangle pointerEvents="none" style={{ left: 40, top: 32, width: 128, height: 96, fill: '#2563eb', stroke: '#1e3a8a', strokeWidth: 2 }} />
    {focus.isFocusVisible ? <Rectangle pointerEvents="none" style={{ left: 36, top: 28, width: 136, height: 104, stroke: '#ff00ff', strokeWidth: 2 }} /> : null}
>>>>>>> origin/main
  </>;
}

/**
 * A small public-API-only application used to distinguish an accidental target
 * interception from an intentionally blocking decoration. The two rectangles
 * deliberately share the exact action geometry.
 */
export function AgentTargetingVerificationScene({
  mode,
<<<<<<< HEAD
  wrapClick,
=======
>>>>>>> origin/main
  selectionLabel,
  selectedItem,
  selections,
  deliveredTo,
  onDelivery,
  onCapturedMove,
  onFocusEvidence,
  onRender,
}: AgentTargetingSceneProps) {
<<<<<<< HEAD
  useEventListener({ onClickCapture: wrapClick('scene-capture', () => undefined), onClick: wrapClick('scene-bubble', () => undefined) });
=======
>>>>>>> origin/main
  const rendered = { mode: mode.get(), selectedItem: selectedItem.get(), selections: selections.get(), deliveredTo: deliveredTo.get() };
  onRender(rendered);
  const repaired = rendered.mode === 'repair' || rendered.mode === 'capture-drag' || rendered.mode === 'keyboard-focus';

  const scene = (
    <>
      <Rectangle
        pointerEvents="none"
        style={{ width: 480, height: 240, fill: '#f8fafc' }}
      />
      <Group style={{ translateX: 40, translateY: 32 }}>
      <Layer style={{ width: 240, height: 160 }}>
<<<<<<< HEAD
      {rendered.mode === 'keyboard-focus' ? <KeyboardAction onDelivery={onDelivery} onFocusEvidence={onFocusEvidence} wrapClick={wrapClick} /> : <Rectangle
        style={{
          x: 40,
          y: 32,
=======
      {rendered.mode === 'keyboard-focus' ? <KeyboardAction onDelivery={onDelivery} onFocusEvidence={onFocusEvidence} /> : <Rectangle
        style={{
          left: 40,
          top: 32,
>>>>>>> origin/main
          width: 128,
          height: 96,
          fill: '#2563eb',
          stroke: '#1e3a8a',
          strokeWidth: 2,
        }}
        onPointerDown={event => { if (mode.get() === 'capture-drag') event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) onCapturedMove(event); }}
        onFocus={onFocusEvidence}
        onBlur={onFocusEvidence}
        onKeyUp={onFocusEvidence}
<<<<<<< HEAD
        onClick={wrapClick('action', event => onDelivery('action', event))}
=======
        onClick={(event) => onDelivery('action', event)}
>>>>>>> origin/main
      />}
      <Rectangle
        pointerEvents={repaired ? 'none' : 'auto'}
        style={{
<<<<<<< HEAD
          x: 40,
          y: 32,
=======
          left: 40,
          top: 32,
>>>>>>> origin/main
          width: 128,
          height: 96,
          fill: 'rgba(0, 0, 0, 0)',
        }}
<<<<<<< HEAD
        onClick={wrapClick('decoration', event => onDelivery('decoration', event))}
=======
        onClick={(event) => onDelivery('decoration', event)}
>>>>>>> origin/main
      />
      </Layer>
      </Group>
      <Text
        pointerEvents="none"
<<<<<<< HEAD
        style={{ x: 80, y: 36, fill: '#0f172a', font: '700 16px sans-serif' }}
=======
        style={{ left: 80, top: 36, fill: '#0f172a', font: '700 16px sans-serif' }}
>>>>>>> origin/main
      >
        {'Targeting verification fixture'}
      </Text>
      <Text
        pointerEvents="none"
<<<<<<< HEAD
        style={{ x: 80, y: 118, fill: '#ffffff', font: '700 15px sans-serif' }}
=======
        style={{ left: 80, top: 118, fill: '#ffffff', font: '700 15px sans-serif' }}
>>>>>>> origin/main
      >
        {'Select item A'}
      </Text>
      <Text
        pointerEvents="none"
<<<<<<< HEAD
        style={{ x: 232, y: 92, fill: '#334155', font: '14px sans-serif' }}
=======
        style={{ left: 232, top: 92, fill: '#334155', font: '14px sans-serif' }}
>>>>>>> origin/main
      >
        {`expected item-a: ${mode.get() !== 'intentional-block' ? 'yes' : 'no'}`}
      </Text>
      <Text
        pointerEvents="none"
<<<<<<< HEAD
        style={{ x: 232, y: 116, fill: '#334155', font: '14px sans-serif' }}
=======
        style={{ left: 232, top: 116, fill: '#334155', font: '14px sans-serif' }}
>>>>>>> origin/main
      >
        {`selected: ${selectionLabel.get()}`}
      </Text>
      <Text
        pointerEvents="none"
<<<<<<< HEAD
        style={{ x: 232, y: 140, fill: '#334155', font: '14px sans-serif' }}
=======
        style={{ left: 232, top: 140, fill: '#334155', font: '14px sans-serif' }}
>>>>>>> origin/main
      >
        {`deliveries: ${selections.get()} (${deliveredTo.get() ?? 'none'})`}
      </Text>
    </>
  );
  return rendered.mode === 'keyboard-focus' ? <FocusManagement><Group>{scene}</Group></FocusManagement> : scene;
}

/** Creates a deliberately dormant computed value for passivity verification. */
export function createDormantTargetingMetric(
  source: Signal<number>,
  onEvaluate: () => void,
) {
  return computed(() => {
    onEvaluate();
    return source.get() * 2;
  });
}
