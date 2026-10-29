/**
 * Version-coupled layout-engine entry for official non-Canvas integrations.
 *
 * This module imports only the compiled layout module and the owned native-tree
 * bridge; it does not load the Pibbl renderer, scheduler, or Canvas surface.
 */
import { prepareLayoutEngineSync } from "./lib/layout/wasm/embedded.js";

/**
 * Prepares the embedded native layout module for an owned standalone tree.
 *
 * The dedicated entry uses the same verified module as Canvas layout, while
 * avoiding URL fetches so a Node host has no DOM, Canvas, or asset-server
 * prerequisite.
 * @returns A promise that resolves after the {@link prepareLayoutEngineSync} module is ready.
 */
export function prepareStandaloneLayoutKernel(): Promise<void> {
  prepareLayoutEngineSync();
  return Promise.resolve();
}
export { createStandaloneLayoutKernel } from "./lib/layout/standalone-kernel.js";
export type {
  StandaloneLayoutKernel,
  StandaloneLayoutKernelBox,
  StandaloneLayoutKernelInput,
  StandaloneLayoutKernelNode,
} from "./lib/layout/standalone-kernel.js";
