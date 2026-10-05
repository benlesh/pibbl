export type Engine = {
  HEAPU8: Uint8Array;
  _pibbl_protocol(): number;
  _pibbl_profile_enabled(enabled: number): void;
  _pibbl_profile_time(phase: number): number;
  _pibbl_live_fonts(): number;
  _pibbl_live_results(): number;
  _pibbl_heap_used(): number;
  _pibbl_test_fail_setup(phase: number): void;
  _pibbl_test_fail_draw_after(count: number): void;
  _malloc(size: number): number;
  _free(pointer: number): void;
  _pibbl_font_create(pointer: number, length: number): number;
  _pibbl_font_release(handle: number): void;
  _pibbl_font_upem(handle: number): number;
  _pibbl_shape(
    handle: number,
    text: number,
    length: number,
    limit: number,
    direction: number,
    script: number,
    language: number,
    features: number,
    count: number,
    missingGlyphs: number,
  ): number;
  _pibbl_error(): number;
  _pibbl_result_data(handle: number, field: number): number;
  _pibbl_result_length(handle: number, field: number): number;
  _pibbl_result_advance(handle: number, axis: number): number;
  _pibbl_result_release(handle: number): void;
};
let enginePromise: Promise<Engine> | undefined;
export function getEngine(): Promise<Engine> {
  return (enginePromise ??= import("../engine.mjs")
    .then((module) => module.default() as Promise<Engine>)
    .then((engine) => {
      if (
        typeof engine._pibbl_protocol !== "function" ||
        engine._pibbl_protocol() !== 2
      )
        throw new Error(
          "Text engine protocol mismatch; deploy matching JavaScript and WASM assets.",
        );
      return engine;
    })
    .catch((error) => {
      enginePromise = undefined;
      throw error;
    }));
}
