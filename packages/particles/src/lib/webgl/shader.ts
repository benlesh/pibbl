import {
  ParameterTimingMask,
  type CompiledColor,
  type CompiledEmitter3D,
  type CompiledParameterLayout,
  type CompiledParameterReference,
  type CompiledScalar,
  type CompiledVector2,
  type CompiledVector3,
} from "../compiler.js";

export interface ParticleLookupTableIndices {
  readonly color?: number;
  readonly size?: number;
  readonly rotation?: number;
  readonly opacity?: number;
}

export interface BuildParticleShaderInput {
  readonly emitter: CompiledEmitter3D;
  readonly parameterLayout: CompiledParameterLayout;
  readonly fixedParameters: Readonly<Float64Array>;
  readonly lookupTableIndices: ParticleLookupTableIndices;
}

export interface CompiledParticleShader {
  readonly vertexSource: string;
  readonly fragmentSource: string;
  readonly frameUniformCount: number;
}

const FRAME_PARAMETER_OFFSET = 5;

function numberLiteral(value: number): string {
  if (!Number.isFinite(value)) {
    throw new RangeError("WebGL particle shader constants must be finite.");
  }
  const text = String(Object.is(value, -0) ? 0 : value);
  return /[.eE]/.test(text) ? text : `${text}.0`;
}

function uintLiteral(value: number): string {
  return `${value >>> 0}u`;
}

function sample(channel: number): string {
  return `particle_sample(seed, emitter_hash, ordinal, ${uintLiteral(channel)})`;
}

function parameterComponent(
  scalar: CompiledParameterReference,
  component: number,
  fixed: Readonly<Float64Array>,
): string {
  const offset = scalar.offset + component;
  return scalar.timingMask === ParameterTimingMask.Render
    ? `u_frame_uniforms[${FRAME_PARAMETER_OFFSET + offset}]`
    : numberLiteral(fixed[offset]!);
}

function scalarExpression(
  scalar: CompiledScalar,
  fixed: Readonly<Float64Array>,
): string {
  switch (scalar.kind) {
    case "constant":
      return numberLiteral(scalar.value);
    case "between":
      return `mix(${numberLiteral(scalar.min)}, ${numberLiteral(scalar.max)}, ${sample(scalar.channel)})`;
    case "integer":
      return `floor(mix(${numberLiteral(scalar.min)}, ${numberLiteral(scalar.max + 1)}, ${sample(scalar.channel)}))`;
    case "parameter":
      return parameterComponent(scalar, 0, fixed);
    case "choice": {
      const target = `(${sample(scalar.channel)} * ${numberLiteral(scalar.choice.totalWeight)})`;
      let expression = numberLiteral(
        scalar.choice.values[scalar.choice.values.length - 1]!,
      );
      for (let index = scalar.choice.values.length - 2; index >= 0; index -= 1) {
        expression = `(${target} < ${numberLiteral(scalar.choice.cumulativeWeights[index]!)} ? ${numberLiteral(scalar.choice.values[index]!)} : ${expression})`;
      }
      return expression;
    }
  }
}

function vectorExpression(
  vector: CompiledVector2 | CompiledVector3,
  dimension: 2 | 3,
  fixed: Readonly<Float64Array>,
): string {
  if (!Array.isArray(vector)) {
    const parameter = vector as CompiledParameterReference;
    const values = Array.from({ length: dimension }, (_, component) =>
      parameterComponent(parameter, component, fixed),
    );
    return `vec${dimension}(${values.join(", ")})`;
  }
  return `vec${dimension}(${vector
    .map((scalar) => scalarExpression(scalar, fixed))
    .join(", ")})`;
}

function colorExpression(
  color: CompiledColor,
  fixed: Readonly<Float64Array>,
): string {
  if (color.kind === "constant") {
    return `vec4(${color.color.map(numberLiteral).join(", ")})`;
  }
  if (color.kind === "parameter") {
    return `vec4(${Array.from({ length: 4 }, (_, component) =>
      parameterComponent(color, component, fixed),
    ).join(", ")})`;
  }
  const target = `(${sample(color.channel)} * ${numberLiteral(color.totalWeight)})`;
  const colorLiteral = (value: readonly number[]) =>
    `vec4(${value.map(numberLiteral).join(", ")})`;
  let expression = colorLiteral(color.samples[color.samples.length - 1]!);
  for (let index = color.samples.length - 2; index >= 0; index -= 1) {
    expression = `(${target} < ${numberLiteral(color.cumulativeWeights[index]!)} ? ${colorLiteral(color.samples[index]!)} : ${expression})`;
  }
  return expression;
}

function shapeExpression(emitter: CompiledEmitter3D): string {
  const [channelX, channelY, channelZ] = emitter.shapeChannels;
  const x = sample(channelX);
  const y = sample(channelY);
  const z = sample(channelZ);
  const shape = emitter.shape;
  switch (shape.type) {
    case "point": {
      const position = shape.position ?? [0, 0, 0];
      return `vec3(${position.map(numberLiteral).join(", ")})`;
    }
    case "line":
      return `mix(vec3(${shape.from.map(numberLiteral).join(", ")}), vec3(${shape.to.map(numberLiteral).join(", ")}), ${x})`;
    case "box": {
      const half = shape.size.map((value) => value / 2);
      if (shape.sample === "surface") {
        return `particle_box_surface(vec3(${half.map(numberLiteral).join(", ")}), vec3(${x}, ${y}, ${z}))`;
      }
      return `(vec3(${x}, ${y}, ${z}) * 2.0 - 1.0) * vec3(${half.map(numberLiteral).join(", ")})`;
    }
    case "sphere": {
      const inner = shape.radius * (1 - (shape.thickness ?? 1));
      const radius =
        shape.sample === "surface"
          ? numberLiteral(shape.radius)
          : `mix(${numberLiteral(inner)}, ${numberLiteral(shape.radius)}, pow(${z}, 0.3333333333))`;
      return `particle_sphere(${x}, ${y}) * ${radius}`;
    }
    case "ring":
      return `vec3(particle_ring(${x}, ${y}, ${numberLiteral(shape.innerRadius)}, ${numberLiteral(shape.outerRadius)}), 0.0)`;
    case "cone": {
      const direction = `normalize(vec3(${shape.direction.map(numberLiteral).join(", ")}))`;
      return `particle_cone_position(${direction}, ${numberLiteral(shape.spreadDegrees)}, ${numberLiteral(shape.length)}, ${x}, ${y}, ${z}, ${shape.sample === "surface" ? "true" : "false"})`;
    }
  }
}

function velocityExpression(
  emitter: CompiledEmitter3D,
  fixed: Readonly<Float64Array>,
): string {
  const velocity = emitter.initial.velocity;
  if (velocity.type === "vector") {
    return vectorExpression(velocity.value, 3, fixed);
  }
  return `particle_cone_velocity(${vectorExpression(velocity.direction, 3, fixed)}, ${scalarExpression(velocity.speed, fixed)}, ${scalarExpression(velocity.spreadDegrees, fixed)}, ${sample(velocity.polarChannel)}, ${sample(velocity.azimuthChannel)})`;
}

function motionStatements(
  emitter: CompiledEmitter3D,
  fixed: Readonly<Float64Array>,
): string {
  const statements: string[] = [];
  for (const motion of emitter.motion) {
    switch (motion.type) {
      case "acceleration":
      case "gravity":
        statements.push(
          `position += 0.5 * ${vectorExpression(motion.value, 3, fixed)} * age_seconds * age_seconds;`,
        );
        break;
      case "drift":
        statements.push(
          `position += ${vectorExpression(motion.value, 3, fixed)} * age_seconds;`,
        );
        break;
      case "drag":
        statements.push(
          `position -= initial_velocity * age_seconds; position += initial_velocity * particle_drag_distance(${scalarExpression(motion.amount, fixed)}, age_seconds);`,
        );
        break;
      case "radialAcceleration":
        statements.push(
          `position += 0.5 * normalize(position - vec3(${motion.center.map(numberLiteral).join(", ")})) * ${scalarExpression(motion.amount, fixed)} * age_seconds * age_seconds;`,
        );
        break;
      case "orbit":
        statements.push(
          `position = particle_orbit(position, vec3(${motion.center.map(numberLiteral).join(", ")}), ${vectorExpression(motion.axis, 3, fixed)}, radians(${scalarExpression(motion.degreesPerSecond, fixed)}) * age_seconds);`,
        );
        break;
      case "sway":
        statements.push(
          `position += normalize(${vectorExpression(motion.direction, 3, fixed)}) * ${scalarExpression(motion.amplitude, fixed)} * sin(6.28318530718 * ${scalarExpression(motion.frequency, fixed)} * age_seconds + ${sample(motion.frequency.channel)} * 6.28318530718);`,
        );
        break;
      case "angularVelocity":
        break;
    }
  }
  return statements.join("\n  ");
}

function birthFunction(emitter: CompiledEmitter3D): string {
  const sources = [
    ...emitter.emission.rates.map((rate) => ({ kind: "rate" as const, rate })),
    ...emitter.emission.bursts.map((burst) => ({
      kind: "burst" as const,
      burst,
    })),
  ];
  if (sources.length === 0) {
    return "ParticleBirth particle_birth(int slot, float effect_ms, uint seed, uint emitter_hash) { return ParticleBirth(false, 0.0, 0u); }";
  }
  const branches = sources.map((source, sourceIndex) => {
    const prefix = sourceIndex === 0 ? "if" : "else if";
    if (source.kind === "rate") {
      const rate = source.rate;
      const durationCheck =
        rate.durationMilliseconds === null
          ? ""
          : ` || birth_ms > ${numberLiteral(rate.startMilliseconds + rate.durationMilliseconds)}`;
      return `${prefix} (source == ${sourceIndex}) {
    float interval_ms = ${numberLiteral(rate.intervalMilliseconds)};
    int latest = int(floor((effect_ms - ${numberLiteral(rate.startMilliseconds)}) / interval_ms)) - local_slot;
    if (latest < 0) return ParticleBirth(false, 0.0, 0u);
    float birth_ms = ${numberLiteral(rate.startMilliseconds)} + float(latest + 1) * interval_ms;
    uint ordinal = uint(latest * ${sources.length} + ${sourceIndex});
    bool accepted = particle_sample(seed, emitter_hash, ordinal, ${uintLiteral(rate.probabilityChannel)}) < ${numberLiteral(rate.probability)};
    if (!accepted${durationCheck}) return ParticleBirth(false, birth_ms, ordinal);
    return ParticleBirth(true, birth_ms, ordinal);
  }`;
    }
    const burst = source.burst;
    return `${prefix} (source == ${sourceIndex}) {
    uint ordinal = uint(local_slot * ${sources.length} + ${sourceIndex});
    int count = int(floor(mix(${numberLiteral(burst.minimumCount)}, ${numberLiteral(burst.maximumCount + 1)}, particle_sample(seed, emitter_hash, ordinal, ${uintLiteral(burst.countChannel)}))));
    bool accepted = local_slot < count && effect_ms >= ${numberLiteral(burst.atMilliseconds)} && particle_sample(seed, emitter_hash, ordinal, ${uintLiteral(burst.probabilityChannel)}) < ${numberLiteral(burst.probability)};
    return ParticleBirth(accepted, ${numberLiteral(burst.atMilliseconds)}, ordinal);
  }`;
  });
  return `ParticleBirth particle_birth(int slot, float effect_ms, uint seed, uint emitter_hash) {
  int source = slot % ${sources.length};
  int local_slot = slot / ${sources.length};
  ${branches.join("\n  ")}
  return ParticleBirth(false, 0.0, 0u);
}`;
}

function lookupDeclarations(indices: ParticleLookupTableIndices): string {
  return Object.values(indices)
    .filter((value): value is number => value !== undefined)
    .sort((left, right) => left - right)
    .map((index) => `uniform sampler2D u_lookup_${index};`)
    .join("\n");
}

function lookupSample(index: number, component: string): string {
  return `texelFetch(u_lookup_${index}, ivec2(int(round(clamp(normalized_age, 0.0, 1.0) * 256.0)), 0), 0).${component}`;
}

/** Compiles CRC's closed particle records into deterministic GLSL ES 3.00. */
export function buildParticleShader(
  input: BuildParticleShaderInput,
): CompiledParticleShader {
  const { emitter, fixedParameters, lookupTableIndices } = input;
  const uniformCount = Math.max(
    FRAME_PARAMETER_OFFSET + input.parameterLayout.defaults.length,
    FRAME_PARAMETER_OFFSET,
  );
  const billboard = emitter.renderer.type === "billboard";
  const sizeExpression = vectorExpression(emitter.initial.size, 2, fixedParameters);
  const rotationExpression = scalarExpression(
    emitter.initial.rotation,
    fixedParameters,
  );
  const color = colorExpression(emitter.initial.color, fixedParameters);
  const opacity = scalarExpression(emitter.initial.opacity, fixedParameters);
  const sizeCurve =
    lookupTableIndices.size === undefined
      ? "vec2(1.0)"
      : emitter.appearance.size?.dimension === 2
        ? lookupSample(lookupTableIndices.size, "rg")
        : `vec2(${lookupSample(lookupTableIndices.size, "r")})`;
  const rotationCurve =
    lookupTableIndices.rotation === undefined
      ? "0.0"
      : lookupSample(lookupTableIndices.rotation, "r");
  const colorCurve =
    lookupTableIndices.color === undefined
      ? "vec4(1.0)"
      : lookupSample(lookupTableIndices.color, "rgba");
  const opacityCurve =
    lookupTableIndices.opacity === undefined
      ? "1.0"
      : lookupSample(lookupTableIndices.opacity, "r");
  const rendererVertex = billboard
    ? `float rotation = radians(${rotationExpression} + ${rotationCurve});
  vec2 corner = mat2(cos(rotation), -sin(rotation), sin(rotation), cos(rotation)) * a_corner;
  vec2 final_size = ${sizeExpression} * ${sizeCurve};
  vec3 billboard_position = position + vec3(corner * final_size, 0.0);
  gl_Position = u_projection_view * u_model * vec4(billboard_position, 1.0);
  v_uv = a_corner + 0.5;`
    : `gl_Position = u_projection_view * u_model * vec4(position, 1.0);
  gl_PointSize = max(0.0, max((${sizeExpression} * ${sizeCurve}).x, (${sizeExpression} * ${sizeCurve}).y));
  v_uv = vec2(0.5);`;

  const vertexSource = `#version 300 es
precision highp float;
precision highp int;
${billboard ? "layout(location = 0) in vec2 a_corner;" : ""}
uniform mat4 u_projection_view;
uniform mat4 u_model;
uniform float u_effective_opacity;
uniform float u_frame_uniforms[${uniformCount}];
${lookupDeclarations(lookupTableIndices)}
out vec4 v_color;
out vec2 v_uv;
flat out float v_alive;
struct ParticleBirth { bool accepted; float milliseconds; uint ordinal; };
uint particle_mix32(uint value) {
  value ^= value >> 16; value *= 0x7feb352du;
  value ^= value >> 15; value *= 0x846ca68bu;
  return value ^ (value >> 16);
}
uint particle_sample_hash(uint seed, uint emitter_hash, uint ordinal, uint channel) {
  uint value = particle_mix32(seed ^ emitter_hash);
  value = particle_mix32(value ^ particle_mix32(ordinal));
  return particle_mix32(value ^ channel * 0x9e3779b1u);
}
float particle_sample(uint seed, uint emitter_hash, uint ordinal, uint channel) {
  return float(particle_sample_hash(seed, emitter_hash, ordinal, channel)) / 4294967296.0;
}
vec3 particle_sphere(float u, float v) {
  float z = 1.0 - 2.0 * u; float radius = sqrt(max(0.0, 1.0 - z * z));
  float angle = 6.28318530718 * v; return vec3(radius * cos(angle), z, radius * sin(angle));
}
vec2 particle_ring(float u, float v, float inner_radius, float outer_radius) {
  float radius = sqrt(mix(inner_radius * inner_radius, outer_radius * outer_radius, u));
  float angle = 6.28318530718 * v; return vec2(cos(angle), sin(angle)) * radius;
}
vec3 particle_box_surface(vec3 half_size, vec3 random_value) {
  int face = min(5, int(floor(random_value.x * 6.0)));
  vec2 point = random_value.yz * 2.0 - 1.0;
  if (face == 0) return vec3(-half_size.x, point.x * half_size.y, point.y * half_size.z);
  if (face == 1) return vec3( half_size.x, point.x * half_size.y, point.y * half_size.z);
  if (face == 2) return vec3(point.x * half_size.x, -half_size.y, point.y * half_size.z);
  if (face == 3) return vec3(point.x * half_size.x,  half_size.y, point.y * half_size.z);
  if (face == 4) return vec3(point.x * half_size.x, point.y * half_size.y, -half_size.z);
  return vec3(point.x * half_size.x, point.y * half_size.y, half_size.z);
}
vec3 particle_basis_tangent(vec3 direction) {
  return normalize(cross(abs(direction.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), direction));
}
vec3 particle_cone_velocity(vec3 direction, float speed, float spread_degrees, float u, float v) {
  vec3 axis = normalize(direction); vec3 tangent = particle_basis_tangent(axis); vec3 bitangent = cross(axis, tangent);
  float cosine = mix(1.0, cos(radians(spread_degrees)), u); float sine = sqrt(max(0.0, 1.0 - cosine * cosine));
  float angle = 6.28318530718 * v; return (axis * cosine + (tangent * cos(angle) + bitangent * sin(angle)) * sine) * speed;
}
vec3 particle_cone_position(vec3 direction, float spread_degrees, float length, float u, float v, float w, bool surface) {
  float distance_value = surface ? length : length * pow(w, 0.3333333333);
  return particle_cone_velocity(direction, distance_value, spread_degrees, u, v);
}
float particle_drag_distance(float amount, float age) {
  return amount <= 0.000001 ? age : (1.0 - exp(-amount * age)) / amount;
}
vec3 particle_orbit(vec3 point, vec3 center, vec3 axis, float angle) {
  vec3 relative = point - center; vec3 unit_axis = normalize(axis);
  return center + relative * cos(angle) + cross(unit_axis, relative) * sin(angle) + unit_axis * dot(unit_axis, relative) * (1.0 - cos(angle));
}
${birthFunction(emitter)}
void main() {
  uint seed = uint(max(0.0, u_frame_uniforms[1])) | (uint(max(0.0, u_frame_uniforms[2])) << 16);
  uint emitter_hash = ${uintLiteral(emitter.emitterHash)};
  ParticleBirth birth = particle_birth(gl_InstanceID, u_frame_uniforms[4], seed, emitter_hash);
  float age_ms = u_frame_uniforms[0] - birth.milliseconds;
  uint ordinal = birth.ordinal;
  float lifetime_ms = ${scalarExpression(emitter.initial.lifetime, fixedParameters)};
  bool particle_alive = birth.accepted && u_frame_uniforms[3] > 0.0 && age_ms >= 0.0 && age_ms < lifetime_ms;
  v_alive = particle_alive ? 1.0 : 0.0;
  if (!particle_alive) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; v_color = vec4(0.0); v_uv = vec2(0.5); return;
  }
  float age_seconds = age_ms / 1000.0;
  float normalized_age = clamp(age_ms / lifetime_ms, 0.0, 1.0);
  vec3 position = ${shapeExpression(emitter)};
  vec3 initial_velocity = ${velocityExpression(emitter, fixedParameters)};
  position += initial_velocity * age_seconds;
  ${motionStatements(emitter, fixedParameters)}
  v_color = ${color} * ${colorCurve};
  v_color.a *= ${opacity} * ${opacityCurve};
  ${rendererVertex}
}`;

  const useSprite = billboard && emitter.renderer.source !== undefined;
  const fragmentSource = `#version 300 es
precision highp float;
uniform float u_effective_opacity;
${useSprite ? "uniform sampler2D u_sprite;" : ""}
in vec4 v_color;
in vec2 v_uv;
flat in float v_alive;
out vec4 out_color;
void main() {
  if (v_alive < 0.5) discard;
  vec2 uv = ${billboard ? "v_uv" : "gl_PointCoord"};
  vec4 sample_color = ${useSprite ? "texture(u_sprite, uv)" : "vec4(1.0, 1.0, 1.0, smoothstep(0.5, 0.35, distance(uv, vec2(0.5))))"};
  vec4 color = v_color * sample_color;
  color.a *= u_effective_opacity;
  ${emitter.renderer.blend === "cutout" ? "if (color.a < 0.5) discard;" : ""}
  out_color = color;
}`;

  return Object.freeze({ vertexSource, fragmentSource, frameUniformCount: uniformCount });
}
