import type {
  CRCBackendFrameInput,
  CRCElementSource,
  CRCEventTargetRegistration,
} from '@crc/core/internal';
import type { ResolvedWebGLCamera } from '../math/camera.js';
import type { CRCWebGLGeometry } from '../types.js';

export type WebGLRGBA = readonly [red: number, green: number, blue: number, alpha: number];

export interface WebGLMeshSubmission {
  readonly kind: 'mesh';
  readonly componentName: string;
  readonly source: CRCElementSource | undefined;
  readonly geometry: CRCWebGLGeometry;
  readonly model: Readonly<Float32Array>;
  readonly color: WebGLRGBA;
  readonly sourceIndex: number;
  readonly target: CRCEventTargetRegistration | undefined;
  readonly keyboardNavigationBounds: CRCEventTargetRegistration['keyboardNavigationBounds'];
}

export interface CreateWebGLSceneComposerInput {
  readonly frame: CRCBackendFrameInput;
  readonly camera: ResolvedWebGLCamera;
  readonly contextGeneration: number;
}

export interface SubmitWebGLMeshInput {
  readonly componentName: string;
  readonly source?: CRCElementSource;
  readonly geometry: CRCWebGLGeometry;
  readonly localModel: Readonly<Float32Array>;
  readonly color: WebGLRGBA;
  readonly target?: CRCEventTargetRegistration;
  readonly keyboardNavigationBounds?: CRCEventTargetRegistration['keyboardNavigationBounds'];
}

export interface ClosedWebGLSceneDraft {
  readonly contextGeneration: number;
  readonly camera: ResolvedWebGLCamera;
  readonly logicalViewport: Readonly<{ width: number; height: number }>;
  readonly backingViewport: Readonly<{ width: number; height: number }>;
  readonly density: Readonly<{ x: number; y: number }>;
  readonly timestamp: number;
  readonly meshes: readonly WebGLMeshSubmission[];
}

export interface WebGLSceneComposer extends ClosedWebGLSceneDraft {
  readonly modelStack: readonly Readonly<Float32Array>[];
  readonly state: 'open' | 'closed';
}
