import type {
  CRCBackendFrameInput,
  CRCElementSource,
  CRCEventTargetRegistration,
} from '@crc/core/internal';
import type { ResolvedWebGLCamera } from '../math/camera.js';
import type {
  CRCWebGLGeometry,
  CRCWebGLShadowQuality,
  CRCWebGLVector3,
} from '../types.js';
import type { ResolvedWebGLMaterial } from '../components/material.js';
import type { Matrix4Bounds } from '../math/matrix4.js';

export type WebGLSceneIdentity = object;

export type WebGLRGBA = readonly [red: number, green: number, blue: number, alpha: number];

export interface WebGLMeshSubmission {
  readonly kind: 'mesh';
  readonly componentName: string;
  readonly source: CRCElementSource | undefined;
  readonly geometry: CRCWebGLGeometry;
  readonly identity: WebGLSceneIdentity;
  readonly model: Readonly<Float32Array>;
  readonly color: WebGLRGBA;
  readonly lit: boolean;
  readonly castShadow: boolean | undefined;
  readonly receiveShadow: boolean | undefined;
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

interface WebGLDirectLightSubmissionBase extends WebGLLightSubmissionBase {
  readonly identity: WebGLSceneIdentity;
  readonly castShadow: boolean;
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
  extends WebGLDirectLightSubmissionBase {
  readonly kind: 'directional';
  readonly color: WebGLRGBA;
  readonly model: Readonly<Float32Array>;
}

export interface WebGLPointLightSubmission
  extends WebGLDirectLightSubmissionBase {
  readonly kind: 'point';
  readonly color: WebGLRGBA;
  readonly range: number | undefined;
  readonly model: Readonly<Float32Array>;
}

export interface WebGLSpotLightSubmission
  extends WebGLDirectLightSubmissionBase {
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
  readonly identity: WebGLSceneIdentity;
  readonly castShadow: boolean;
}

export interface SettledPointLight extends SettledWebGLLightBase {
  readonly kind: 'point';
  readonly linearColor: CRCWebGLVector3;
  readonly position: CRCWebGLVector3;
  readonly range: number | undefined;
  readonly identity: WebGLSceneIdentity;
  readonly castShadow: boolean;
}

export interface SettledSpotLight extends SettledWebGLLightBase {
  readonly kind: 'spot';
  readonly linearColor: CRCWebGLVector3;
  readonly position: CRCWebGLVector3;
  readonly direction: CRCWebGLVector3;
  readonly range: number | undefined;
  readonly innerConeCosine: number;
  readonly outerConeCosine: number;
  readonly identity: WebGLSceneIdentity;
  readonly castShadow: boolean;
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
  readonly shadowQuality?: CRCWebGLShadowQuality;
}

export interface SubmitWebGLMeshInput {
  readonly componentName: string;
  readonly source?: CRCElementSource;
  readonly geometry: CRCWebGLGeometry;
  readonly identity?: WebGLSceneIdentity;
  readonly localModel: Readonly<Float32Array>;
  readonly color: WebGLRGBA;
  readonly lit?: boolean;
  readonly material?: ResolvedWebGLMaterial;
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
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

type SubmitDirectWebGLLightBase = SubmitTransformableWebGLLightBase & {
  readonly identity?: WebGLSceneIdentity;
  readonly castShadow?: boolean;
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
  | (SubmitDirectWebGLLightBase & {
      readonly kind: 'directional';
      readonly color: WebGLRGBA;
    })
  | (SubmitDirectWebGLLightBase & {
      readonly kind: 'point';
      readonly color: WebGLRGBA;
      readonly range: number | undefined;
    })
  | (SubmitDirectWebGLLightBase & {
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
  readonly shadowQuality: CRCWebGLShadowQuality;
  readonly meshes: readonly WebGLMeshSubmission[];
  readonly lights: readonly WebGLLightSubmission[];
  readonly backgrounds: readonly WebGLBackgroundSubmission[];
}
export type WebGLWorldBounds = Matrix4Bounds;

interface SettledWebGLShadowPlanBase {
  readonly lightIdentity: WebGLSceneIdentity;
  readonly lightIndex: number;
  readonly bias: number;
  readonly casters: readonly import('./settle.js').SettledWebGLMesh[];
  readonly receivers: readonly import('./settle.js').SettledWebGLMesh[];
  readonly requestedResolution: number;
  readonly comparisonCount: 1 | 4 | 9;
  readonly contextGeneration: number;
  readonly shadowProgramGeneration: number;
}

export interface SettledWebGLDirectionalShadowPlan
  extends SettledWebGLShadowPlanBase {
  readonly kind: 'directional';
  readonly projectionViewMatrix: Readonly<Float32Array>;
}

export interface SettledWebGLPointShadowPlan
  extends SettledWebGLShadowPlanBase {
  readonly kind: 'point';
  readonly projectionViewMatrices: readonly Readonly<Float32Array>[];
  readonly lightPosition: CRCWebGLVector3;
  readonly nearDistance: number;
  readonly farDistance: number;
}

export interface SettledWebGLSpotShadowPlan
  extends SettledWebGLShadowPlanBase {
  readonly kind: 'spot';
  readonly projectionViewMatrix: Readonly<Float32Array>;
  readonly lightPosition: CRCWebGLVector3;
  readonly nearDistance: number;
  readonly farDistance: number;
}

export type SettledWebGLShadowPlan =
  | SettledWebGLDirectionalShadowPlan
  | SettledWebGLPointShadowPlan
  | SettledWebGLSpotShadowPlan;

export interface WebGLSceneComposer extends ClosedWebGLSceneDraft {
  readonly modelStack: readonly Readonly<Float32Array>[];
  readonly state: 'open' | 'closed';
}
