import * as core from "@pibbl/core";
import * as internal from "@pibbl/core/internal";
import * as particles from "@pibbl/core/particles";
import * as threeAdapter from "@pibbl/three";
import * as physics2d from "@pibbl/core/physics/2d";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import {
  Fragment as ProductionFragment,
  jsx,
  jsxs,
} from "@pibbl/core/jsx-runtime";
import {
  Fragment as DevelopmentFragment,
  jsxDEV,
} from "@pibbl/core/jsx-dev-runtime";

const expected = [
  "DragHandle", "ResizeHandle", "ResizeHandles", "RotationHandle",
  "ManipulationFrame", "Manipulable", "useManipulation", "degrees",
  "Absolute",
  "Arc",
  "Circle",
  "Clip",
  "Ellipse",
  "Flex",
  "Flow",
  "FocusManagement",
  "Fragment",
  "Grid",
  "Group",
  "HtmlBox",
  "HorizontalLine",
  "Image",
  "KeyboardNavigation",
  "Layer",
  "LayoutDiagnostic",
  "Line",
  "Overlay",
  "Path",
  "PathGeometry",
  "affineTransform",
  "arcBendTransform",
  "composeTransforms",
  "envelopeTransform",
  "meshTransform",
  "pathBendTransform",
  "quadTransform",
  "transformPath",

  "Polygon",
  "Rectangle",
  "RegularPolygon",
  "Star",
  "SvgPath",
  "Text",
  "VerticalLine",
  "Wedge",
  "batch",
  "computed",
  "pibbl",
  "createArcPath",
  "createCirclePath",
  "createElement",
  "createEllipsePath",
  "createLinePath",
  "createPolygonPath",
  "createRectanglePath",
  "createRegularPolygonPath",
  "createStarPath",
  "createSvgPath",
  "createWedgePath",
  "defineAnimation",
  "definePrimitive",
  "defineRenderLayer",
  "defineTexture",
  "defineTransition",
  "recordFrames",
  "exportGif",
  "useVisibilityTransition",
  "fade",
  "bifrost",
  "embers",
  "hologram",
  "slide",
  "zoom",
  "wipe",
  "blurReveal",
  "dissolve",
  "easing",
  "flattenPath",
  "flattenPathWang",
  "simplifyPathRadial",
  "simplifyPath",
  "subdividePath",
  "toPath2D",
  "toSvgPathData",
  "isSignal",
  "keyframes",
  "layoutDiagnostic",
  "marker",
  "measureElement",
  "normalizeEdges",
  "parallel",
  "repeat",
  "resolveBox",
  "resolveLength",
  "resolveSignalValue",
  "sequence",
  "signal",
  "spring",
  "stepper",
  "drive",
  "tween",
  "untracked",
  "useCanvasContext",
  "useComputed",
  "useConst",
  "useCursor",
  "useEventListener",
  "useEventTarget",
  "useLayoutBox",
  "useLinePath",
  "usePlayback",
  "useReaction",
  "useRectPath",
  "useRef",
  "useSignal",
  "useSvgPath",
  "useAnimatedValue",
  "useTexture",
  "wait",



].sort();

const actual = Object.keys(core).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`Unexpected @pibbl/core exports: ${actual.join(", ")}`);
}
for (const removedName of ["useState", "useMemo", "useWhenChanged", "useSpringValue", "useTweenValue"]) {
  if (removedName in core) {
    throw new Error(
      `Removed @pibbl/core export is still present: ${removedName}`,
    );
  }
}

const expectedInternal = [
  "PibblInternalManualSchedulerDriver",
  "borrowTextureRaster",
  "borrowDispatchResource",
  "captureSeriesInspectionFrame",
  "pibblInternalAssertCommandAllowed",
  "pibblInternalCreatePropAttachment",
  "pibblInternalCreateSignalConsumer",
  "pibblInternalCurrentFrame",
  "pibblInternalCurrentRenderOwner",
  "pibblInternalCurrentSimulationOwner",
  "pibblInternalCurrentWorldTransform",
  "pibblInternalInstallTestSchedulerDriver",
  "pibblInternalOnRenderFinish",
  "pibblInternalOnSimulationRenderTransactionFinish",
  "pibblInternalPaintTarget",
  "pibblInternalQueueBegin",
  "pibblInternalQueueComplete",
  "pibblInternalQueueCurrentCommit",
  "pibblInternalQueueCurrentComplete",
  "pibblInternalQueueSimulationBegin",
  "pibblInternalQueueSimulationCommitAcknowledgement",
  "pibblInternalQueueSimulationComplete",
  "pibblInternalRegisterAdvance",
  "pibblInternalRegisterSimulationAdvance",
  "pibblInternalRequestRender",
  "pibblInternalRequestRendererWork",
  "pibblInternalRequestSimulationRender",
  "pibblInternalRunPurePrimitiveResolver",
  "pibblInternalSnapshotRealmScheduler",
  "createBackendToken",
  "defineBackendPrimitive",
  "derivePrimitive",
  "getBackendEnvironment",
  "getCurrentBackendHostCanvas",
  "getCurrentElementSource",
  "getCurrentFrameTimestamp",
  "getCurrentLogicalViewport",
  "getCurrentSurfaceDensity",
  "hasPibblEventHandler",
  "haveSameLayerNodeTree",
  "isBackendEventTargetLive",
  "materializeRetainedLayerChildren",
  "mountBackendPibbl",
  "onCurrentRenderFinish",
  "pushLayoutBox",
  "registerNestedInteractionResolver",
  "releaseBackendEventTarget",
  "requestCurrentInstanceFrame",
  "resolveTexturePaint",
  "setCurrentComponentAfterRender",
  "snapshotLayerNodeTree",
  "useBackendEventTarget",
  "useInternalHookSlot",
  "useInternalValueMemoSlot",
  "validateTexturePaint",
  "withHooksForbidden",
];
const actualInternal = Object.keys(internal).sort();
if (JSON.stringify(actualInternal) !== JSON.stringify([...expectedInternal].sort())) {
  throw new Error(
    `Unexpected @pibbl/core/internal exports: ${actualInternal.join(", ")}`,
  );
}
for (const exportName of expectedInternal) {
  if (typeof internal[exportName] !== "function") {
    throw new Error(
      `Expected @pibbl/core/internal ${exportName} to be callable.`,
    );
  }
  if (exportName in core) {
    throw new Error(
      `Internal renderer function leaked from @pibbl/core: ${exportName}.`,
    );
  }
}
for (const exportName of expected) {
  if (exportName in internal) {
    throw new Error(
      `@pibbl/core/internal re-exported public root value ${exportName}.`,
    );
  }
}
if (actual.length !== expected.length) {
  throw new Error(
    `Expected ${expected.length} @pibbl/core runtime exports, received ${actual.length}.`,
  );
}

const requireFromRuntime = createRequire(import.meta.url);
const coreEntry = requireFromRuntime.resolve("@pibbl/core");
const internalEntry = requireFromRuntime.resolve("@pibbl/core/internal");
function schedulerModules(entry, visited = new Set()) {
  if (visited.has(entry)) return [];
  visited.add(entry);
  const source = readFileSync(entry, "utf8");
  const own = source.includes("function registerAdvanceParticipant") ? [entry] : [];
  const imports = [...source.matchAll(/from ["'](\.[^"'\n]+)["']/gu)];
  return own.concat(imports.flatMap(match => schedulerModules(resolve(dirname(entry), match[1]), visited)));
}
const coreSchedulers = schedulerModules(coreEntry);
const internalSchedulers = schedulerModules(internalEntry);
if (coreSchedulers.length !== 1 || internalSchedulers.length !== 1 || coreSchedulers[0] !== internalSchedulers[0]) {
  throw new Error("@pibbl/core/internal did not share the packed core scheduler identity.");
}

const runtimeCount = core.signal(2, { debugName: "runtime count" });
const runtimeReadonly = runtimeCount.asReadonly();
const runtimeComputed = core.computed(() => runtimeReadonly.get() * 3);
if (!core.isSignal(runtimeCount) || !core.isSignal(runtimeReadonly)) {
  throw new Error("Public signal values were not recognized by isSignal().");
}
if (core.untracked(() => runtimeComputed.get()) !== 6) {
  throw new Error("Public computed or untracked behavior was unavailable.");
}
runtimeCount.update((value) => value + 1);
if (runtimeComputed.get() !== 9) {
  throw new Error(
    "Public computed values did not update from their dependencies.",
  );
}
const runtimeCallback = core.signal(() => "ready");
runtimeCallback.set(() => "updated");
if (runtimeCallback.get()() !== "updated") {
  throw new Error("Function-valued signals were treated as updater callbacks.");
}
if (typeof internal.createBackendToken("consumer") !== "object") {
  throw new Error("@pibbl/core/internal did not create an opaque backend token.");
}

const expectedParticles = [
  "Particles2D",
  "defineParticleEffect2D",
  "particleChoice",
  "particleCurve",
  "particleGradient",
  "particleInteger",
  "particleParameter",
  "particleRange",
  "useFlowField2D",
  "useFlowSource2D",
  "useParticleSystem",
];
const actualParticles = Object.keys(particles).sort();
if (JSON.stringify(actualParticles) !== JSON.stringify(expectedParticles)) {
  throw new Error(
    `Unexpected @pibbl/core/particles exports: ${actualParticles.join(", ")}`,
  );
}
for (const exportName of expectedParticles) {
  if (typeof particles[exportName] !== "function") {
    throw new Error(`Expected @pibbl/core/particles ${exportName} to be callable.`);
  }
}
const expectedThreeAdapter = ["defineThreeLayer"];
const actualThreeAdapter = Object.keys(threeAdapter).sort();
if (
  JSON.stringify(actualThreeAdapter) !== JSON.stringify(expectedThreeAdapter)
) {
  throw new Error(
    `Unexpected @pibbl/three exports: ${actualThreeAdapter.join(", ")}`,
  );
}
if (typeof threeAdapter.defineThreeLayer !== "function") {
  throw new Error("Expected @pibbl/three defineThreeLayer to be callable.");
}
if (typeof THREE.Scene !== "function" || typeof OrbitControls !== "function") {
  throw new Error(
    "Three.js and its public OrbitControls addon must be available.",
  );
}
for (const threeExport of ["Scene", "Object3D", "WebGLRenderer"]) {
  if (threeExport in threeAdapter) {
    throw new Error(`@pibbl/three re-exported Three value ${threeExport}.`);
  }
}
const particleRange = particles.particleRange(1, 2);
if (
  particleRange.type !== "between" ||
  particleRange.min !== 1 ||
  particleRange.max !== 2 ||
  !Object.isFrozen(particleRange)
) {
  throw new Error(
    "Packed particle descriptors lost their immutable public shape.",
  );
}
const particleEffect2D = particles.defineParticleEffect2D({
  emitters: [
    {
      name: "spark",
      capacity: 4,
      emission: [{ type: "rate", particlesPerSecond: 1 }],
      shape: { type: "point" },
      initial: { lifetimeMilliseconds: 100 },
      renderer: { type: "circle" },
    },
  ],
});
if (particleEffect2D.dimension !== 2) {
  throw new Error(
    "Packed particle definitions lost their dimensional identity.",
  );
}

for (const [exportName, value] of Object.entries({
  jsx,
  jsxs,
  jsxDEV,
})) {
  if (typeof value !== "function") {
    throw new Error(`Expected @pibbl/core compiler export ${exportName}.`);
  }
}
if (
  ProductionFragment !== core.Fragment ||
  DevelopmentFragment !== core.Fragment
) {
  throw new Error("Compiler subpaths did not share the public Fragment value.");
}
for (const exportName of expected.filter(
  (exportName) => exportName !== "easing",
)) {
  if (typeof core[exportName] !== "function") {
    throw new Error(
      `Expected @pibbl/core ${exportName} to be a runtime function.`,
    );
  }
}
if (
  typeof core.easing !== "object" ||
  Object.isFrozen(core.easing) !== true ||
  typeof core.easing.linear !== "function"
) {
  throw new Error(
    "Expected @pibbl/core easing to be a frozen function collection.",
  );
}
for (const creatorName of [
  "createArcPath",
  "createCirclePath",
  "createEllipsePath",
  "createLinePath",
  "createPolygonPath",
  "createRectanglePath",
  "createRegularPolygonPath",
  "createStarPath",
  "createSvgPath",
  "createWedgePath",
]) {
  if (typeof core[creatorName] !== "function") {
    throw new Error(`Expected @pibbl/core ${creatorName} to be callable.`);
  }
}

const style = { width: 1, height: 1 };
const element = core.createElement(core.Rectangle, {
  key: "runtime-focus-probe",
  style,
});
const enhanced = core.createElement(core.FocusManagement, {
  children: core.createElement(core.KeyboardNavigation, {
    mode: "directional",
    children: element,
  }),
});
if (
  enhanced.type !== core.FocusManagement ||
  enhanced.props.children.type !== core.KeyboardNavigation ||
  enhanced.props.children.props.children !== element
) {
  throw new Error("Focus policy descriptors did not retain their exact child.");
}

for (const specifier of [
  "@pibbl/core/lib/pibbl",
  "@pibbl/core/lib/types",
  "@pibbl/core/lib/global-state",
  "@pibbl/core/src/index",
  ["@pibbl", "webgl"].join("/"),
  ["@pibbl", "particles", "webgl"].join("/"),
  ["@pibbl", "physics", "3d"].join("/"),
]) {
  try {
    await import(specifier);
    throw new Error(`Expected ${specifier} to be blocked by the export map`);
  } catch (error) {
    if (
      error?.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED" &&
      error?.code !== "ERR_MODULE_NOT_FOUND"
    ) {
      throw error;
    }
  }
}


const editableGeometry = new core.PathGeometry();
editableGeometry.moveTo(0, 0);
editableGeometry.lineTo(10, 10);
const editableCopy = editableGeometry.clone();
editableCopy.setSegment(1, { type: 'line', x: 20, y: 20 });
if (core.toSvgPathData(editableGeometry) !== 'M 0 0 L 10 10' ||
    core.toSvgPathData(editableCopy) !== 'M 0 0 L 20 20') {
  throw new Error('Packed editable path copies must remain independent.');
}
if (core.subdividePath(editableGeometry, { divisions: 2 }).segmentCount !== 3) {
  throw new Error('Packed geometry utilities are not operational.');
}

const warpProbe = new core.PathGeometry();
warpProbe.moveTo(0, 0); warpProbe.lineTo(1, 1);
for (const mode of ['bilinear', 'perspective']) {
  const warped = core.transformPath(warpProbe, core.quadTransform({ source: { x: 0, y: 0, width: 1, height: 1 }, destination: { topLeft: { x: 0, y: 0 }, topRight: { x: 10, y: 0 }, bottomLeft: { x: 0, y: 10 }, bottomRight: { x: 10, y: 5 } }, mode }), { tolerance: 0.01 });
  const end = warped.getSegment(warped.segmentCount - 1);
  if (end.type !== 'line' || end.x !== 10 || end.y !== 5 || warpProbe.segmentCount !== 2) {
    throw new Error(`Packed ${mode} warp failed endpoint/ownership evidence.`);
  }
}

const bendProbe = new core.PathGeometry(); bendProbe.moveTo(25, 7);
const bendGuide = new core.PathGeometry(); bendGuide.moveTo(30, 40); bendGuide.bezierCurveTo(30, 40, 30, 40, 130, 40);
const bendOptions = { source: { x: 0, y: 0, width: 100, height: 10 }, baseline: 0, tolerance: 0.01 };
const bentPoint = core.transformPath(bendProbe, core.pathBendTransform({ ...bendOptions, guide: bendGuide }), bendOptions).getSegment(0);
if (bentPoint.type !== 'move' || Math.hypot(bentPoint.x - 55, bentPoint.y - 47) > 0.01) {
  throw new Error('Packed Along Path must use arc length and preserve normal displacement.');
}
const arcPoint = core.transformPath(bendProbe, core.arcBendTransform({ ...bendOptions, arc: { cx: 10, cy: 20, radius: 50, startAngle: 0, sweep: Math.PI } }), { ...bendOptions }).getSegment(0);
if (arcPoint.type !== 'move' || Math.hypot(arcPoint.x - (10 + 43 * Math.cos(0.5)), arcPoint.y - (20 + 43 * Math.sin(0.5))) > 0.01 || core.toSvgPathData(bendProbe) !== 'M 25 7') {
  throw new Error('Packed Along Arc failed analytic geometry or input ownership.');
}

const htmlDescriptor = core.createElement(core.HtmlBox, {
  data: { text: 'inert construction' },
  mount() { throw new Error('HtmlBox construction must not mount DOM'); },
  style: { width: 100, height: 40 },
});
if (htmlDescriptor.type !== core.HtmlBox) throw new Error('HtmlBox descriptor lost its public identity');
const wangGeometry = core.flattenPathWang(editableGeometry, { tolerance: 0.25 });
const radialGeometry = core.simplifyPathRadial(wangGeometry, { tolerance: 0.5 });
if (!(wangGeometry instanceof core.PathGeometry) || !(radialGeometry instanceof core.PathGeometry)) {
  throw new Error('Alternate path helpers did not return public geometry.');
}

if (typeof physics2d.physicsObstacles2D !== "function" || "physicsBoxObstacles2D" in physics2d) {
  throw new Error("Expected the general committed-obstacle API without its superseded box-only name.");
}

const upper = new core.PathGeometry(); upper.moveTo(0,0); upper.lineTo(10,0);
const lower = new core.PathGeometry(); lower.moveTo(0,10); lower.lineTo(20,10);
const envelope = core.envelopeTransform({source:{x:0,y:0,width:1,height:1},top:upper,bottom:lower});
const composition = core.composeTransforms(envelope,core.affineTransform({a:2,d:2,e:3}));
const middle = composition.mapPoint({x:0.5,y:0.5});
if (middle.x !== 18 || middle.y !== 10) throw new Error('Packed envelope composition failed.');
const affineCopy = core.transformPath(warpProbe,core.affineTransform({e:3}),{tolerance:0.1});
if (affineCopy.getSegment(0).x !== 3) throw new Error('Packed affine transforms must work without DOMMatrix.');
const verticalA = new core.PathGeometry(); verticalA.moveTo(0,0); verticalA.lineTo(0,10);
const verticalB = new core.PathGeometry(); verticalB.moveTo(10,0); verticalB.lineTo(20,10);
const mesh = core.meshTransform({source:{x:0,y:0,width:1,height:1},columns:[0,1],rows:[0,1],horizontal:[[upper],[lower]],vertical:[[verticalA],[verticalB]]});
if (Math.abs(mesh.mapPoint({x:0.5,y:0.5}).x-7.5)>0.0001) throw new Error('Packed mesh mapping failed.');

for (const name of [
  'raycastAny2D', 'raycastClosest2D', 'raycastAll2D',
  'shapeCastAny2D', 'shapeCastClosest2D', 'shapeCastAll2D',
  'hasShapeOverlap2D', 'findShapeOverlap2D', 'findAllShapeOverlaps2D',
  'hasAabbMatch2D', 'findAabbMatch2D', 'findAllAabbMatches2D',
  'hasPointMatch2D', 'findPointMatch2D', 'findAllPointMatches2D',
]) {
  if (typeof physics2d[name] !== 'function') throw new Error(`Missing named query: ${name}`);
}
for (const name of ['raycast2D', 'shapeCast2D', 'overlapShape2D', 'queryAabb2D', 'queryPoint2D']) {
  if (name in physics2d) throw new Error(`Removed selector-driven query remains: ${name}`);
}
