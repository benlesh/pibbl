import type { manipulationLabScenarioEntry } from './catalog.js';
import {
  DragHandle,
  ManipulationFrame,
  Rectangle,
  ResizeHandles,
  Text,
  signal,
  useManipulation,
  type PibblManipulationCancelReason,
  type PibblManipulationController,
  type PibblNode,
  type WritableSignal,
} from "@pibbl/core";

export const MANIPULATION_LAB_SOURCE_ID = "component-manipulation-laboratory-example";

/**
 * Actions supported by the manipulation lab scenario's public controller.
 *
 * @see {@link ManipulationLabState}
 */
export type ManipulationLabAction =
  | "toggle-snap"
  | "cancel"
  | "external-write"
  | "reset";

/**
 * Observable state exposed by the manipulation lab scenario for controls and assertions.
 *
 * @see {@link PibblManipulationCancelReason}
 * @see {@link ManipulationLabAction}
 * @see {@link manipulationLabScenarioEntry}
 */
export interface ManipulationLabState {
  /** Box recorded or configured by this scenario. See {@link ManipulationLabState}. */
  readonly box: Readonly<{
    /** Left recorded or configured by this scenario. See {@link ManipulationLabState}. */
    left: number;
    /** Top recorded or configured by this scenario. See {@link ManipulationLabState}. */
    top: number;
    /** Width recorded or configured by this scenario. See {@link ManipulationLabState}. */
    width: number;
    /** Height recorded or configured by this scenario. See {@link ManipulationLabState}. */
    height: number;
  }>;
  /** Snap enabled recorded or configured by this scenario. See {@link ManipulationLabState}. */
  readonly snapEnabled: boolean;
  /** Active recorded or configured by this scenario. See {@link ManipulationLabState}. */
  readonly active: "idle" | "move" | "resize" | "rotate";
  /** Changes recorded or configured by this scenario. See {@link ManipulationLabState}. */
  readonly changes: number;
  /** Commits recorded or configured by this scenario. See {@link ManipulationLabState}. */
  readonly commits: number;
  /**
   * Cancellation recorded or configured by this scenario. See {@link PibblManipulationCancelReason}
   * .
   */
  readonly cancellation: PibblManipulationCancelReason | null;
  /** Last action recorded or configured by this scenario. See {@link ManipulationLabAction}. */
  readonly lastAction: "mount" | ManipulationLabAction;
}

export interface ManipulationLabModel {
  readonly box: WritableSignal<{ left: number; top: number; width: number; height: number }>;
  readonly snapEnabled: WritableSignal<boolean>;
  control: PibblManipulationController | undefined;
  changes: number;
  commits: number;
  cancellation: PibblManipulationCancelReason | null;
  publish: (() => void) | undefined;
}

export function createManipulationLabModel(): ManipulationLabModel {
  return {
    box: signal({ left: 64, top: 72, width: 180, height: 120 }),
    snapEnabled: signal(false),
    control: undefined,
    changes: 0,
    commits: 0,
    cancellation: null,
    publish: undefined,
  };
}

export function ManipulationLabRoot({ model }: { readonly model: ManipulationLabModel }): PibblNode {
  const control = useManipulation({
    box: model.box,
    move: { snap: { enabled: model.snapEnabled, step: 20 } },
    resize: { minWidth: 100, minHeight: 72 },
    onChange: () => {
      model.changes++;
      model.publish?.();
    },
    onCommit: () => {
      model.commits++;
      model.publish?.();
    },
    onCancel: event => {
      model.cancellation = event.reason;
      model.publish?.();
    },
  });
  model.control = control;
  const box = model.box.get();
  const snapEnabled = model.snapEnabled.get();
  const active = control.active.get();
  return [
    <Rectangle
      key="background"
      pointerEvents="none"
      style={{ left: 0, top: 0, width: 480, height: 300, fill: "#f8fafc" }}
    />,
    <ManipulationFrame
      key="frame"
      controller={control}
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
    >
      <Rectangle
        pointerEvents="none"
        style={{ width: "100%", height: "100%", fill: "#ffffff", stroke: "#2563eb", strokeWidth: 2, cornerRadius: 10 }}
      />
      <DragHandle controller={control}>
        <Rectangle
          pointerEvents="auto"
          keyboardFocusable
          style={{ width: "100%", height: 36, fill: "#dbeafe", cornerRadius: 10 }}
        />
        <Text pointerEvents="none" style={{ left: 14, top: 11, font: "700 14px sans-serif", fill: "#17324d" }}>
          Drag this card
        </Text>
      </DragHandle>
      <Text pointerEvents="none" style={{ left: 14, top: 54, font: "13px sans-serif", fill: "#334155" }}>
        {`${Math.round(box.left)}, ${Math.round(box.top)} · ${Math.round(box.width)} × ${Math.round(box.height)}`}
      </Text>
      <ResizeHandles controller={control} positions="corners" />
    </ManipulationFrame>,
    <Text key="status" pointerEvents="none" style={{ left: 18, top: 254, font: "12px monospace", fill: "#334155" }}>
      {`snap ${snapEnabled ? "on" : "off"} · ${active?.operation ?? "idle"} · changes ${model.changes}`}
    </Text>,
  ];
}
