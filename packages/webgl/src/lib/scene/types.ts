import type {
  CRCBackendFrameInput,
  CRCElementSource,
  CRCEventTargetRegistration,
} from '@crc/core/internal';
import type { ResolvedWebGLCamera } from '../math/camera.js';
import type { CRCWebGLGeometry, CRCWebGLVector3 } from '../types.js';
import type { ResolvedWebGLMaterial } from '../components/material.js';

export type WebGLRGBA = readonly [red: number, green: number, blue: number, alpha: number];

export interface WebGLMeshSubmission {
  readonly kind: 'mesh';
  readonly componentName: string;
  readonly source: CRCElementSource | undefined;
  readonly geometry: CRCWebGLGeometry;
  readonly model: Readonly<Float32Array>;
  readonly color: WebGLRGBA;
  readonly lit: boolean;
  readonly material: ResolvedWebGLMaterial;
  readonly sourceIndex: number;
  readonly target: CRCEventTargetRegistration | undefined;
  readonly keyboardNavigationBounds: CRCEventTargetRegistration['keyboardNavigationBounds'];
}

interface WebGLLightSubmissionBase {
  readonly componentName: string;
  readonly source: CRCElementSource | undefined;
  readonly intensity: number;
  readonly model?: Readonly<Float32Array>;
}

export interface WebGLAmbientLightSubmission
  extends WebGLLightSubmissionBase {
  readonly kind: 'ambient';
  readonly color: WebGLRGBA;
  readonly model?: never;
}

export interface WebGLHemisphereLightSubmission
  extends WebGLLightSubmissionBase {
  readonly kind: 'hemisphere';
  readonly skyColor: WebGLRGBA;
  readonly groundColor: WebGLRGBA;
  readonly model: Readonly<Float32Array>;
}

export interface WebGLDirectionalLightSubmission
  extends WebGLLightSubmissionBase {
  readonly kind: 'directional';
  readonly color: WebGLRGBA;
  readonly model: Readonly<Float32Array>;
}

export interface WebGLPointLightSubmission
  extends WebGLLightSubmissionBase {
  readonly kind: 'point';
  readonly color: WebGLRGBA;
  readonly range: number | undefined;
  readonly model: Readonly<Float32Array>;
}

export interface WebGLSpotLightSubmission
  extends WebGLLightSubmissionBase {
  readonly kind: 'spot';
  readonly color: WebGLRGBA;
  readonly range: number | undefined;
  readonly innerConeAngleDegrees: number;
  readonly outerConeAngleDegrees: number;
  readonly model: Readonly<Float32Array>;
}

export type WebGLLightSubmission =
  | WebGLAmbientLightSubmission
  | WebGLHemisphereLightSubmission
  | WebGLDirectionalLightSubmission
  | WebGLPointLightSubmission
  | WebGLSpotLightSubmission;

export interface WebGLBackgroundSubmission {
  readonly kind: 'background';
  readonly componentName: string;
  readonly source: CRCElementSource | undefined;
  readonly color: WebGLRGBA;
}

export type SettledWebGLShading =
  | {
      readonly kind: 'unlit';
      readonly displayBaseColor: WebGLRGBA;
      readonly linearEmissive: CRCWebGLVector3;
    }
  | {
      readonly kind: 'lambert';
      readonly linearBaseColor: WebGLRGBA;
      readonly linearEmissive: CRCWebGLVector3;
      readonly normalMatrix: Readonly<Float32Array>;
    };

interface SettledWebGLLightBase {
  readonly intensity: number;
}

export interface SettledAmbientLight extends SettledWebGLLightBase {
  readonly kind: 'ambient';
  readonly linearColor: CRCWebGLVector3;
}

export interface SettledHemisphereLight extends SettledWebGLLightBase {
  readonly kind: 'hemisphere';
  readonly linearSkyColor: CRCWebGLVector3;
  readonly linearGroundColor: CRCWebGLVector3;
  readonly axis: CRCWebGLVector3;
}

export interface SettledDirectionalLight extends SettledWebGLLightBase {
  readonly kind: 'directional';
  readonly linearColor: CRCWebGLVector3;
  readonly direction: CRCWebGLVector3;
}

export interface SettledPointLight extends SettledWebGLLightBase {
  readonly kind: 'point';
  readonly linearColor: CRCWebGLVector3;
  readonly position: CRCWebGLVector3;
  readonly range: number | undefined;
}

export interface SettledSpotLight extends SettledWebGLLightBase {
  readonly kind: 'spot';
  readonly linearColor: CRCWebGLVector3;
  readonly position: CRCWebGLVector3;
  readonly direction: CRCWebGLVector3;
  readonly range: number | undefined;
  readonly innerConeCosine: number;
  readonly outerConeCosine: number;
}

export type SettledWebGLLight =
  | SettledAmbientLight
  | SettledHemisphereLight
  | SettledDirectionalLight
  | SettledPointLight
  | SettledSpotLight;

export interface SettledWebGLBackground {
  readonly kind: 'background';
  readonly color: WebGLRGBA;
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
  readonly lit?: boolean;
  readonly material?: ResolvedWebGLMaterial;
  readonly target?: CRCEventTargetRegistration;
  readonly keyboardNavigationBounds?: CRCEventTargetRegistration['keyboardNavigationBounds'];
}

type SubmitWebGLLightBase = {
  readonly componentName: string;
  readonly source?: CRCElementSource;
  readonly intensity: number;
};

type SubmitTransformableWebGLLightBase = SubmitWebGLLightBase & {
  readonly localModel: Readonly<Float32Array>;
};

export type SubmitWebGLLightInput =
  | (SubmitWebGLLightBase & {
      readonly kind: 'ambient';
      readonly color: WebGLRGBA;
    })
  | (SubmitTransformableWebGLLightBase & {
      readonly kind: 'hemisphere';
      readonly skyColor: WebGLRGBA;
      readonly groundColor: WebGLRGBA;
    })
  | (SubmitTransformableWebGLLightBase & {
      readonly kind: 'directional';
      readonly color: WebGLRGBA;
    })
  | (SubmitTransformableWebGLLightBase & {
      readonly kind: 'point';
      readonly color: WebGLRGBA;
      readonly range: number | undefined;
    })
  | (SubmitTransformableWebGLLightBase & {
      readonly kind: 'spot';
      readonly color: WebGLRGBA;
      readonly range: number | undefined;
      readonly innerConeAngleDegrees: number;
      readonly outerConeAngleDegrees: number;
    });

export interface SubmitWebGLBackgroundInput {
  readonly componentName: string;
  readonly source?: CRCElementSource;
  readonly color: WebGLRGBA;
}

export interface ClosedWebGLSceneDraft {
  readonly contextGeneration: number;
  readonly camera: ResolvedWebGLCamera;
  readonly logicalViewport: Readonly<{ width: number; height: number }>;
  readonly backingViewport: Readonly<{ width: number; height: number }>;
  readonly density: Readonly<{ x: number; y: number }>;
  readonly timestamp: number;
  readonly meshes: readonly WebGLMeshSubmission[];
  readonly lights: readonly WebGLLightSubmission[];
  readonly backgrounds: readonly WebGLBackgroundSubmission[];
}

export interface WebGLSceneComposer extends ClosedWebGLSceneDraft {
  readonly modelStack: readonly Readonly<Float32Array>[];
  readonly state: 'open' | 'closed';
}
