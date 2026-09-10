/**
 * @packageDocumentation
 * Reserved for official CRC packages that are released in lockstep with
 * `@crc/core`. This version-coupled module is not a stable third-party plugin
 * API and intentionally does not re-export the public root module.
 */

export {
  crcInternalCreateSignalConsumer,
  crcInternalCurrentFrame,
  crcInternalCurrentRenderOwner,
  crcInternalQueueComplete,
  crcInternalRequestRendererWork,
} from './lib/scheduler/renderer-participant.js';
export type {
  CRCInternalFrame,
  CRCInternalRendererWorkKind,
  CRCInternalRenderOwner,
  CRCInternalSignalConsumer,
} from './lib/scheduler/renderer-participant.js';
