import type { PibblRef, WritableSignal } from '@pibbl/core';
import {
  useCursor,
  useEventListener,
  useLinePath,
  useComputed,
  useRectPath,
  useRef,
  useSignal,
  useSvgPath,
  useReaction,
  Path,
  Rectangle,
} from '@pibbl/core';
export const RUNTIME_HOOKS_SOURCE_ID = 'runtime-hooks-laboratory-example';
/**
 * Supported runtime hooks root variant values: `"a"`, `"b"`.
 *
 * @see {@link RuntimeHooksState}
 */
export type RuntimeHooksRootVariant = 'a' | 'b';
/**
 * Supported runtime hooks sibling key values: `"a"`, `"b"`, `"c"`.
 *
 * @see {@link RuntimeHooksState}
 */
export type RuntimeHooksSiblingKey = 'a' | 'b' | 'c';
/**
 * Actions supported by the runtime hooks scenario's public controller.
 *
 * @see {@link RuntimeHooksState}
 */
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
/**
 * Observable state exposed by the runtime hooks scenario for controls and assertions.
 *
 * @see {@link RuntimeHooksAction}
 * @see {@link RuntimeHooksRootVariant}
 * @see {@link RuntimeHooksSiblingKey}
 */
export interface RuntimeHooksState {
  /** Component key recorded or configured by this scenario. See {@link RuntimeHooksState}. */
  componentKey: number;
  /** Component visible recorded or configured by this scenario. See {@link RuntimeHooksState}. */
  componentVisible: boolean;
  /** Dependency recorded or configured by this scenario. See {@link RuntimeHooksState}. */
  dependency: number;
  /** Falsy children recorded or configured by this scenario. See {@link RuntimeHooksState}. */
  falsyChildren: number;
  /** Hook acquisitions recorded or configured by this scenario. See {@link RuntimeHooksState}. */
  hookAcquisitions: number;
  /** Hook cleanups recorded or configured by this scenario. See {@link RuntimeHooksState}. */
  hookCleanups: number;
  /** Hook order recorded or configured by this scenario. See {@link RuntimeHooksState}. */
  hookOrder: string;
  /** Last action recorded or configured by this scenario. See {@link RuntimeHooksAction}. */
  lastAction: RuntimeHooksAction;
  /** Memo creates recorded or configured by this scenario. See {@link RuntimeHooksState}. */
  memoCreates: number;
  /** Memo identity recorded or configured by this scenario. See {@link RuntimeHooksState}. */
  memoIdentity: string;
  /** Misuse errors recorded or configured by this scenario. See {@link RuntimeHooksState}. */
  misuseErrors: number;
  /** Misuse message recorded or configured by this scenario. See {@link RuntimeHooksState}. */
  misuseMessage: string | null;
  /** Misuse name recorded or configured by this scenario. See {@link RuntimeHooksState}. */
  misuseName: string | null;
  /** Path identities recorded or configured by this scenario. See {@link RuntimeHooksState}. */
  pathIdentities: readonly [number, number, number];
  /** Ref identity recorded or configured by this scenario. See {@link RuntimeHooksState}. */
  refIdentity: number;
  /** Ref value recorded or configured by this scenario. See {@link RuntimeHooksState}. */
  refValue: number;
  /** Renders recorded or configured by this scenario. See {@link RuntimeHooksState}. */
  renders: number;
  /** Root variant recorded or configured by this scenario. See {@link RuntimeHooksRootVariant}. */
  rootVariant: RuntimeHooksRootVariant;
  /**
   * Sibling identities recorded or configured by this scenario. See {@link RuntimeHooksSiblingKey}
   * .
   */
  siblingIdentities: Readonly<Record<RuntimeHooksSiblingKey, number | null>>;
  /** Sibling order recorded or configured by this scenario. See {@link RuntimeHooksSiblingKey}. */
  siblingOrder: readonly RuntimeHooksSiblingKey[];
  /** State value recorded or configured by this scenario. See {@link RuntimeHooksState}. */
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
    | PibblRef<{
        identity: number;
        value: number;
      }>
    | undefined;
  renders: number;
  stateSignal: WritableSignal<number> | undefined;
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
  const stateValue = useSignal(0);
  order.push('memo');
  const memoValue = useComputed(() => {
    metrics.memoCreates++;
    return {
      identity: `dependency-${model.dependency}-memo-${metrics.memoCreates}`,
    };
  }, [model.dependency]).get();
  order.push('ref');
  const stableRef = useRef<{
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
  useReaction(() => {
    metrics.hookAcquisitions++;
    return () => {
      metrics.hookCleanups++;
    };
  }, [model.dependency]);
  order.push('rectPath');
  const rectanglePath = useRectPath(20, 25, 125 + model.dependency * 2, 70);
  order.push('linePath');
  const linePath = useLinePath([
    [20, 112],
    [85, 98 + model.dependency],
    [150, 112],
  ]);
  order.push('svgPath');
  const svgPath = useSvgPath(
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
  metrics.stateSignal = stateValue;
  metrics.stateValue = stateValue.get();
  return [
    <Path
      key="memo-rect-path"
      style={{
        d: rectanglePath,
        fill: stateValue.get() % 2 === 0 ? '#2563eb' : '#7c3aed',
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
  const identity = useRef<number>();
  if (identity.current === undefined) {
    identity.current = metrics.nextObjectIdentity++;
  }
  metrics.siblingIdentities[siblingKey] = identity.current;
  return (
    <Rectangle
      key={`${siblingKey}-fill`}
      style={{
        left: 190 + slot * 82,
        top: 50,
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
        left: 0,
        top: 0,
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
    () => useSignal(0),
    () => useComputed(() => 1),
    () => useRef(0),
    () => useReaction(() => undefined, []),
    () => useRectPath(0, 0, 1, 1),
    () =>
      useLinePath([
        [0, 0],
        [1, 1],
      ]),
    () => useSvgPath('M 0 0 L 1 1'),
    () => useEventListener({ onClick: () => undefined }),
    () =>
      useCursor({
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
