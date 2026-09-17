export const WEBGL_LIGHTING_EXAMPLE_IDS = [
  'lit-and-unlit',
  'ambient-light',
  'hemisphere-light',
  'directional-light',
  'point-light',
  'spot-light',
  'emissive-material',
  'webgl-background',
  'custom-geometry-normals',
  'multiple-lights',
  'transformed-light',
  'shadow-quality',
] as const;

export type WebGLLightingExampleId =
  (typeof WEBGL_LIGHTING_EXAMPLE_IDS)[number];

export interface WebGLLightingExampleSource {
  readonly id: WebGLLightingExampleId;
  readonly source: string;
}

const conceptDeltaStart = '// Concept delta: start';
const conceptDeltaEnd = '// Concept delta: end';
const sharedBaseStart = '// Shared base scene: start';
const sharedBaseEnd = '// Shared base scene: end';
const normalizedDelta = '// Concept delta intentionally differs here.';

const requiredBaseFragments = [
  'const groundGeometry = createWebGLGeometry({',
  'positions: [',
  'normals: [',
  'indices: [',
  "type: 'perspective'",
  'const orbit = useOrbitCamera({',
  'orbitPoint: [0, -0.25, 0]',
  'initialPosition: [5.8, 4.2, 7.8]',
  '<Group {...orbit.handlers}>',
  "<Rectangle style={{ width: 720, height: 420, fill: 'transparent' }} />",
  'position: orbit.position',
  'lookAt: orbit.lookAt',
  '<WebGLBackground style={{ color: sceneBackground }} />',
  'shadows: layerShadows',
  '<Cube',
  '<Sphere',
  '<Mesh',
  'geometry={groundGeometry}',
  "material: { type: 'lambert' }",
  'material: sphereMaterial',
  'opacity: 1',
] as const;

export function webGLLightingExampleSourcePath(
  id: WebGLLightingExampleId,
): string {
  return `packages/scenarios/src/learning/webgl/${id}.example.tsx`;
}

export function validateWebGLLightingExampleSources(
  sources: readonly WebGLLightingExampleSource[],
): void {
  const actualIds = sources.map(({ id }) => id);
  if (
    sources.length !== WEBGL_LIGHTING_EXAMPLE_IDS.length ||
    actualIds.some((id, index) => id !== WEBGL_LIGHTING_EXAMPLE_IDS[index])
  ) {
    throw new Error(
      'WebGL lighting examples must enumerate exactly the twelve canonical lessons in order.',
    );
  }

  let canonicalBase: string | undefined;
  let canonicalOutsideDelta: string | undefined;
  for (const { id, source } of sources) {
    const label = `WebGL lighting example "${id}"`;
    const normalizedSource = normalizeSource(source);
    requireCount(normalizedSource, conceptDeltaStart, 1, label);
    requireCount(normalizedSource, conceptDeltaEnd, 1, label);
    requireCount(normalizedSource, sharedBaseStart, 1, label);
    requireCount(normalizedSource, sharedBaseEnd, 1, label);
    requireCount(normalizedSource, "from '@crc/core'", 1, label);
    requireCount(normalizedSource, "from '@crc/webgl'", 1, label);
    requireCount(normalizedSource, 'useOrbitCamera({', 1, label);
    requireCount(normalizedSource, '<Group {...orbit.handlers}>', 1, label);
    requireCount(
      normalizedSource,
      "<Rectangle style={{ width: 720, height: 420, fill: 'transparent' }} />",
      1,
      label,
    );
    requireCount(normalizedSource, 'position: orbit.position', 1, label);
    requireCount(normalizedSource, 'lookAt: orbit.lookAt', 1, label);
    requireCount(normalizedSource, 'shadows: layerShadows', 1, label);
    requireCount(
      normalizedSource,
      "const layerShadows: CRCWebGLShadowQuality = 'medium';",
      1,
      label,
    );
    requireCount(
      normalizedSource,
      'export default function mount(canvas: HTMLCanvasElement): CRCController',
      1,
      label,
    );
    if ((normalizedSource.match(/\bcrc\s*\(/gu) ?? []).length !== 1) {
      throw new Error(`${label} must call crc exactly once from its mount.`);
    }

    const conceptDelta = delimitedRegion(
      normalizedSource,
      conceptDeltaStart,
      conceptDeltaEnd,
      label,
    );
    const sharedBase = delimitedRegion(
      normalizedSource,
      sharedBaseStart,
      sharedBaseEnd,
      label,
    );
    if (conceptDelta.start >= sharedBase.start) {
      throw new Error(`${label} must declare its concept delta before the shared base.`);
    }
    for (const fragment of requiredBaseFragments) {
      if (!sharedBase.content.includes(fragment)) {
        throw new Error(`${label} shared base is missing ${JSON.stringify(fragment)}.`);
      }
    }

    const outsideDelta =
      normalizedSource.slice(0, conceptDelta.contentStart) +
      `${normalizedDelta}\n` +
      normalizedSource.slice(conceptDelta.contentEnd);
    canonicalBase ??= sharedBase.content;
    canonicalOutsideDelta ??= outsideDelta;
    if (sharedBase.content !== canonicalBase) {
      throw new Error(
        `${label} changed the literal shared base scene; move the lesson-only change into its concept delta.`,
      );
    }
    if (outsideDelta !== canonicalOutsideDelta) {
      throw new Error(
        `${label} differs outside its single concept-delta region.`,
      );
    }
  }
}

function normalizeSource(source: string): string {
  return `${source
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd()}\n`;
}

function requireCount(
  source: string,
  token: string,
  expected: number,
  label: string,
): void {
  const actual = source.split(token).length - 1;
  if (actual !== expected) {
    throw new Error(
      `${label} must contain ${expected} occurrence of ${JSON.stringify(token)}; found ${actual}.`,
    );
  }
}

function delimitedRegion(
  source: string,
  startMarker: string,
  endMarker: string,
  label: string,
): {
  readonly start: number;
  readonly contentStart: number;
  readonly contentEnd: number;
  readonly content: string;
} {
  const start = source.indexOf(startMarker);
  const contentStart = start + startMarker.length;
  const contentEnd = source.indexOf(endMarker, contentStart);
  if (start < 0 || contentEnd < contentStart) {
    throw new Error(`${label} has an invalid ${startMarker} region.`);
  }
  return {
    start,
    contentStart,
    contentEnd,
    content: source.slice(contentStart, contentEnd),
  };
}
