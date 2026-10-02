import { crcStudioThreeModules } from "../playground/src/studio-three-runtime";

export * from "@crc/core";
export * from "@crc/core/filters";
export * from "@crc/particles";
export * from "@crc/three";
export * from "@crc/physics/2d";
export * from "@crc/physics/3d/geometry";
export { computed, useSignal, isSignal, signal, untracked } from "@crc/core";
export {
  usePlayback,
  useTransition,
  defineAnimation,
  easing,
  keyframes,
  marker,
  parallel,
  repeat,
  sequence,
  spring,
  stepper,
  track,
  tween,
  wait,
} from "@crc/core";
export { jsx, jsxs } from "@crc/core/jsx-runtime";
export { jsxDEV } from "@crc/core/jsx-dev-runtime";

export const __crcStudioModules = crcStudioThreeModules;

export * from "@crc/viz";

export * from "@crc/textures";
export { loadOutlineFont, createTextGeometry } from "@crc/text";
