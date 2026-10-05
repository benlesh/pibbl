import { signal, type Signal } from "@pibbl/core";
import { useLinearScale, useBarScale, useUTCScale, type ResolvedLinearScale, LinearScale, BarScale, UTCScale } from "@pibbl/core/viz";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

it("reads each explicit scale hook with a stable shared readonly signal", () => {
  runtime = testRuntime();
  const domain = signal<readonly [number, number]>([0, 10]);
  const identities: Signal<ResolvedLinearScale>[] = [];
  const positions: number[] = [];
  function Linear() {
    const scale = useLinearScale("value");
    identities.push(scale);
    expect(useLinearScale("value")).toBe(scale);
    positions.push(scale.get().map(5));
  }
  function Categories() {
    const bar = useBarScale("category").get();
    expect(bar.map("A")).toBe(0);
    expect(bar.bandwidth).toBe(50);
  }
  function Calendar() {
    const utc = useUTCScale("date").get();
    expect(utc.formatTick(0)).toBe("1970-01-01T00:00:00.000Z");
  }
  runtime.mount(<>
    <LinearScale id="value"  domain={domain} range={[0, 100]}><Linear /><Linear /></LinearScale>
    <BarScale id="category"  domain={["A", "B"]} range={[0, 100]}><Categories /></BarScale>
    <UTCScale id="date"  domain={[0, 86400000]} range={[0, 100]}><Calendar /></UTCScale>
  </>);
  runtime.flush();
  expect(positions).toEqual([50, 50]);
  expect(identities[0]).toBe(identities[1]);
  domain.set([0, 20]); runtime.flush();
  expect(positions.slice(-2)).toEqual([25, 25]);
  expect(identities.at(-1)).toBe(identities[0]);
  runtime.dispose(); domain.set([0, 30]); expect(runtime.pending).toBe(0);
});

it("keeps mismatched hook validation lazy", () => {
  runtime = testRuntime();
  let saved!: Signal<ResolvedLinearScale>;
  function Capture() { saved = useLinearScale("x"); }
  runtime.mount(<UTCScale id="x" domain={[0, 100]} range={[0, 10]}><Capture /></UTCScale>);
  runtime.flush();
  expect(() => saved.get()).toThrow(/useLinearScale.*utc/);
});
