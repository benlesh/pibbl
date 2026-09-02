import type { CRCRef, StateUpdater } from '@crc/core';
import {
  crcCursor,
  crcEvent,
  crcLinePath,
  crcMemo,
  crcRectPath,
  crcRef,
  crcState,
  crcSvgPath,
  crcWhenChanged,
  Path,
  Rectangle,
} from '@crc/core';
export const RUNTIME_HOOKS_SOURCE_ID = 'runtime-hooks-laboratory-example';
export type RuntimeHooksRootVariant = 'a' | 'b';
export type RuntimeHooksSiblingKey = 'a' | 'b' | 'c';
export type RuntimeHooksAction =
  | 'change-dependency'
  | 'increment-state'
  | 'insert-sibling'
  | 'mount'
  | 'mutate-ref'
  | 'probe-hook-misuse'
  | 'remove-component'
  | 'remove-sibling'
  | 'render-stable'
  | 'reorder-siblings'
  | 'replace-component-key'
  | 'replace-root'
  | 'reset'
  | 'restore-component';
export interface RuntimeHooksState {
  componentKey: number;
  componentVisible: boolean;
  dependency: number;
  falsyChildren: number;
  hookAcquisitions: number;
  hookCleanups: number;
  hookOrder: string;
  lastAction: RuntimeHooksAction;
  memoCreates: number;
  memoIdentity: string;
  misuseErrors: number;
  misuseMessage: string | null;
  misuseName: string | null;
  pathIdentities: readonly [number, number, number];
  refIdentity: number;
  refValue: number;
  renders: number;
  rootVariant: RuntimeHooksRootVariant;
  siblingIdentities: Readonly<Record<RuntimeHooksSiblingKey, number | null>>;
  siblingOrder: readonly RuntimeHooksSiblingKey[];
  stateValue: number;
}
export interface RuntimeHooksModel {
  componentKey: number;
  componentVisible: boolean;
  dependency: number;
  insertedSibling: boolean;
  lastAction: RuntimeHooksAction;
  removedSibling: boolean;
  reversedSiblings: boolean;
  rootVariant: RuntimeHooksRootVariant;
}
export interface RuntimeHooksMetrics {
  falsyChildren: number;
  hookAcquisitions: number;
  hookCleanups: number;
  hookOrder: string;
  memoCreates: number;
  memoIdentity: string;
  misuseErrors: number;
  misuseMessage: string | null;
  misuseName: string | null;
  nextObjectIdentity: number;
  objectIdentities: WeakMap<object, number>;
  pathIdentities: readonly [number, number, number];
  refIdentity: number;
  refObject:
    | CRCRef<{
        identity: number;
        value: number;
      }>
    | undefined;
  renders: number;
  setState: StateUpdater<number> | undefined;
  siblingIdentities: Record<RuntimeHooksSiblingKey, number | null>;
  stateValue: number;
}
export interface RuntimeHooksMisuseError {
  message: string;
  name: string;
}
interface RuntimeHooksSceneProps {
  metrics: RuntimeHooksMetrics;
  model: Readonly<RuntimeHooksModel>;
}
interface HookProbeProps extends RuntimeHooksSceneProps {}
interface SiblingProps {
  color: string;
  metrics: RuntimeHooksMetrics;
  siblingKey: RuntimeHooksSiblingKey;
  slot: number;
}
function objectIdentity(metrics: RuntimeHooksMetrics, value: object): number {
  const current = metrics.objectIdentities.get(value);
  if (current !== undefined) {
    return current;
  }
  const identity = metrics.nextObjectIdentity++;
  metrics.objectIdentities.set(value, identity);
  return identity;
}
const HookProbe = ({ metrics, model }: HookProbeProps) => {
  const order: string[] = [];
  order.push('state');
  const [stateValue, setState] = crcState(0);
  order.push('memo');
  const memoValue = crcMemo(() => {
    metrics.memoCreates++;
    return {
      identity: `dependency-${model.dependency}-memo-${metrics.memoCreates}`,
    };
  }, [model.dependency]);
  order.push('ref');
  const stableRef = crcRef<{
    identity: number;
    value: number;
  }>();
  if (!stableRef.current) {
    stableRef.current = {
      identity: metrics.nextObjectIdentity++,
      value: 0,
    };
  }
  order.push('whenChanged');
  crcWhenChanged(() => {
    metrics.hookAcquisitions++;
    return () => {
      metrics.hookCleanups++;
    };
  }, [model.dependency]);
  order.push('rectPath');
  const rectanglePath = crcRectPath(20, 25, 125 + model.dependency * 2, 70);
  order.push('linePath');
  const linePath = crcLinePath([
    [20, 112],
    [85, 98 + model.dependency],
    [150, 112],
  ]);
  order.push('svgPath');
  const svgPath = crcSvgPath(
    model.dependency % 2 === 0
      ? 'M 70 145 L 100 105 L 130 145 Z'
      : 'M 70 145 L 100 100 L 130 145 Z',
  );
  metrics.hookOrder = order.join(' → ');
  metrics.memoIdentity = memoValue.identity;
  metrics.pathIdentities = [
    objectIdentity(metrics, rectanglePath),
    objectIdentity(metrics, linePath),
    objectIdentity(metrics, svgPath),
  ];
  metrics.refIdentity = stableRef.current.identity;
  metrics.refObject = stableRef;
  metrics.renders++;
  metrics.setState = setState;
  metrics.stateValue = stateValue;
  return [
    <Path
      key="memo-rect-path"
      style={{
        d: rectanglePath,
        fill: stateValue % 2 === 0 ? '#2563eb' : '#7c3aed',
      }}
    />,
    <Path
      key="memo-line-path"
      style={{
        d: linePath,
        stroke: '#0f172a',
        strokeWidth: 5,
      }}
    />,
    <Path
      key="memo-svg-path"
      style={{
        d: svgPath,
        fill: model.dependency % 2 === 0 ? '#f59e0b' : '#ec4899',
      }}
    />,
  ];
};
const Sibling = ({ color, metrics, siblingKey, slot }: SiblingProps) => {
  const identity = crcRef<number>();
  if (identity.current === undefined) {
    identity.current = metrics.nextObjectIdentity++;
  }
  metrics.siblingIdentities[siblingKey] = identity.current;
  return (
    <Rectangle
      key={`${siblingKey}-fill`}
      style={{
        x: 190 + slot * 82,
        y: 50,
        width: 64,
        height: 64,
        fill: color,
      }}
    />
  );
};
function siblingOrder(
  model: Readonly<RuntimeHooksModel>,
): RuntimeHooksSiblingKey[] {
  const order: RuntimeHooksSiblingKey[] = model.reversedSiblings
    ? ['b', 'a']
    : ['a', 'b'];
  if (model.removedSibling) {
    const index = order.indexOf('b');
    order.splice(index, 1);
  }
  if (model.insertedSibling) {
    order.splice(1, 0, 'c');
  }
  return order;
}
function sceneNodes({ metrics, model }: RuntimeHooksSceneProps) {
  metrics.siblingIdentities = {
    a: null,
    b: null,
    c: null,
  };
  const order = siblingOrder(model);
  const siblings = order.map((key, slot) => (
    <Sibling
      color={key === 'a' ? '#0ea5e9' : key === 'b' ? '#10b981' : '#f97316'}
      key={key}
      metrics={metrics}
      siblingKey={key}
      slot={slot}
    />
  ));
  const falsyChildren = [false, null, undefined, '', 0] as const;
  metrics.falsyChildren = falsyChildren.length;
  return [
    <Rectangle
      key="runtime-hooks-background"
      style={{
        x: 0,
        y: 0,
        width: 480,
        height: 240,
        fill: model.rootVariant === 'a' ? '#f8fafc' : '#eef2ff',
      }}
    />,
    ...falsyChildren,
    model.componentVisible && (
      <HookProbe
        key={`hook-probe-${model.componentKey}`}
        metrics={metrics}
        model={model}
      />
    ),
    ...siblings,
  ];
}
const RuntimeHooksRootA = (props: RuntimeHooksSceneProps) => sceneNodes(props);
const RuntimeHooksRootB = (props: RuntimeHooksSceneProps) => sceneNodes(props);
export function createRuntimeHooksScene(props: RuntimeHooksSceneProps) {
  return props.model.rootVariant === 'a' ? (
    <RuntimeHooksRootA {...props} />
  ) : (
    <RuntimeHooksRootB {...props} />
  );
}
export function getRuntimeHooksSiblingOrder(
  model: Readonly<RuntimeHooksModel>,
): readonly RuntimeHooksSiblingKey[] {
  return siblingOrder(model);
}
export function probeRuntimeHookMisuse(): readonly RuntimeHooksMisuseError[] {
  const errors: RuntimeHooksMisuseError[] = [];
  const probes = [
    () => crcState(0),
    () => crcMemo(() => 1, []),
    () => crcRef(0),
    () => crcWhenChanged(() => undefined, []),
    () => crcRectPath(0, 0, 1, 1),
    () =>
      crcLinePath([
        [0, 0],
        [1, 1],
      ]),
    () => crcSvgPath('M 0 0 L 1 1'),
    () => crcEvent('click', () => undefined),
    () =>
      crcCursor({
        style: 'pointer',
      }),
  ];
  for (const probe of probes) {
    try {
      probe();
    } catch (error) {
      errors.push(
        error instanceof Error
          ? {
              message: error.message,
              name: error.name,
            }
          : {
              message: String(error),
              name: 'UnknownError',
            },
      );
    }
  }
  return errors;
}
