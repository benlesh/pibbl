/** Opt-in source tooling for one native Canvas2D context. No measurement,
 * pixel reads, child traversal, global prototype patch or render scheduling.
 */
const active = new WeakSet<CanvasRenderingContext2D>();
type Operation = "fillText" | "strokeText";
type Content =
  | Readonly<{ status: "redacted" }>
  | Readonly<{ status: "fixture"; value: string }>;
type RecordEntry = Readonly<{
  sequence: number;
  operation: Operation;
  content: Content;
  x: number | null;
  y: number | null;
  maxWidth: number | null;
  alignment: CanvasTextAlign;
  baseline: CanvasTextBaseline;
}>;
export function createTextRecorder(
  context: CanvasRenderingContext2D,
  {
    capacity = 64,
    fixtureText = [],
  }: { capacity?: number; fixtureText?: readonly string[] } = {},
) {
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 256)
    throw new RangeError("Text recorder capacity must be 1 through 256.");
  if (
    !Array.isArray(fixtureText) ||
    fixtureText.length > 16 ||
    fixtureText.some((text) => typeof text !== "string" || text.length > 256)
  )
    throw new RangeError(
      "Explicit fixture text must contain at most 16 strings of at most 256 UTF-16 units.",
    );
  if (active.has(context))
    throw new Error("Text recorder already owns this context.");
  const allowed = new Set(fixtureText);
  let target: CanvasRenderingContext2D | null = context;
  let status: "recording" | "stopped" | "disposed" = "recording";
  const ring: RecordEntry[] = [];
  let total = 0;
  let observationFailures = 0;
  const hooks: {
    name: Operation;
    previous: PropertyDescriptor | undefined;
    wrapper: (
      ...args: Parameters<CanvasRenderingContext2D["fillText"]>
    ) => void;
  }[] = [];
  const finite = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : null;
  function restore() {
    if (!target) return;
    for (const hook of hooks) {
      if (
        Object.getOwnPropertyDescriptor(target, hook.name)?.value !==
        hook.wrapper
      )
        continue;
      if (hook.previous)
        Object.defineProperty(target, hook.name, hook.previous);
      else Reflect.deleteProperty(target, hook.name);
    }
    active.delete(target);
  }
  try {
    for (const name of ["fillText", "strokeText"] as const) {
      const original = context[name];
      const previous = Object.getOwnPropertyDescriptor(context, name);
      const wrapper = function (
        this: CanvasRenderingContext2D,
        ...args: Parameters<CanvasRenderingContext2D["fillText"]>
      ) {
        const result = Reflect.apply(original, this, args);
        if (status === "recording" && this === target) {
          try {
            // Exact string allowlist only: never coerce input again, disclose private
            // prefixes/lengths/hashes, or retain the original unapproved argument.
            const content: Content =
              typeof args[0] === "string" && allowed.has(args[0])
                ? Object.freeze({ status: "fixture", value: args[0] })
                : Object.freeze({ status: "redacted" });
            const alignment = this.textAlign,
              baseline = this.textBaseline;
            if (
              !["left", "right", "center", "start", "end"].includes(
                alignment,
              ) ||
              ![
                "top",
                "hanging",
                "middle",
                "alphabetic",
                "ideographic",
                "bottom",
              ].includes(baseline)
            )
              throw new Error("Invalid observed text settings.");
            const sequence = total + 1;
            ring[(sequence - 1) % capacity] = Object.freeze({
              sequence,
              operation: name,
              content,
              x: finite(args[1]),
              y: finite(args[2]),
              maxWidth: finite(args[3]),
              alignment,
              baseline,
            });
            total = sequence;
          } catch {
            observationFailures++;
          }
        }
        return result;
      };
      Object.defineProperty(context, name, {
        configurable: true,
        writable: true,
        value: wrapper,
      });
      hooks.push({ name, previous, wrapper });
    }
    active.add(context);
  } catch (error) {
    restore();
    target = null;
    allowed.clear();
    throw error;
  }
  function stop() {
    if (status === "recording") {
      status = "stopped";
      restore();
      target = null;
    }
  }
  return Object.freeze({
    snapshot() {
      const count = ring.length;
      const records = Array.from(
        { length: count },
        (_, index) => ring[(Math.max(0, total - count) + index) % capacity],
      );
      return Object.freeze({
        schema: "crc-text-call-evidence/1",
        status,
        scope: "one-context-successful-calls",
        geometry: "draw-positions-not-glyph-bounds",
        fontAttribution: "unknown",
        fontRequest: "not-recorded",
        clipping: "not-observed",
        pixels: "not-observed",
        observationFailures,
        completeness: observationFailures
          ? "incomplete"
          : total > count
            ? "truncated"
            : "complete",
        total,
        dropped: total - count,
        capacity,
        records: Object.freeze(records),
      });
    },
    stop,
    dispose() {
      stop();
      status = "disposed";
      ring.length = 0;
      total = 0;
      observationFailures = 0;
      allowed.clear();
      target = null;
      hooks.length = 0;
    },
  });
}
