export const WEBGL_MAX_LIGHTS = 8;
export const WEBGL_MAX_SHADOWS = 8;

export const WEBGL_LIGHT_KIND = Object.freeze({
  ambient: 0,
  hemisphere: 1,
  directional: 2,
  point: 3,
  spot: 4,
} as const);

const UNLIT_VERTEX_SOURCE = `#version 300 es
layout(location = 0) in vec3 a_position;
uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;

void main() {
  gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);
}
`;

const UNLIT_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
uniform vec4 u_display_base_color;
uniform vec3 u_linear_emissive;
out vec4 out_color;

vec3 srgb_to_linear(vec3 color) {
  bvec3 use_linear_segment = lessThanEqual(color, vec3(0.04045));
  vec3 linear_segment = color / 12.92;
  vec3 power_segment = pow((color + 0.055) / 1.055, vec3(2.4));
  return mix(power_segment, linear_segment, use_linear_segment);
}

vec3 linear_to_srgb(vec3 color) {
  bvec3 use_linear_segment = lessThanEqual(color, vec3(0.0031308));
  vec3 linear_segment = color * 12.92;
  vec3 power_segment = 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055;
  return mix(power_segment, linear_segment, use_linear_segment);
}

void main() {
  if (!any(greaterThan(u_linear_emissive, vec3(0.0)))) {
    out_color = u_display_base_color;
    return;
  }
  vec3 linear_surface =
    srgb_to_linear(u_display_base_color.rgb) + u_linear_emissive;
  out_color = vec4(
    linear_to_srgb(clamp(linear_surface, vec3(0.0), vec3(1.0))),
    u_display_base_color.a
  );
}
`;

const SHADOW_DEPTH_VERTEX_SOURCE = `#version 300 es
layout(location = 0) in vec3 a_position;
uniform mat4 u_model;
uniform mat4 u_shadow_projection_view;

void main() {
  gl_Position = u_shadow_projection_view * u_model * vec4(a_position, 1.0);
}
`;

const SHADOW_DEPTH_FRAGMENT_SOURCE = `#version 300 es
precision highp float;

void main() {
  gl_FragDepth = gl_FragCoord.z;
}
`;

const SHADOW_2D_SAMPLERS = Array.from(
  { length: WEBGL_MAX_SHADOWS },
  (_, index) => `uniform sampler2D u_shadow_map_2d_${index};`,
).join('\n');

const SHADOW_CUBE_SAMPLERS = Array.from(
  { length: WEBGL_MAX_SHADOWS },
  (_, index) => `uniform samplerCube u_shadow_map_cube_${index};`,
).join('\n');

const SHADOW_2D_BRANCHES = Array.from(
  { length: WEBGL_MAX_SHADOWS },
  (_, index) => `  if (index == ${index}) return texture(u_shadow_map_2d_${index}, coordinates).r;`,
).join('\n');

const SHADOW_CUBE_BRANCHES = Array.from(
  { length: WEBGL_MAX_SHADOWS },
  (_, index) => `  if (index == ${index}) return texture(u_shadow_map_cube_${index}, direction).r;`,
).join('\n');

const LAMBERT_VERTEX_SOURCE = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;
uniform mat3 u_normal_matrix;
out vec3 v_world_position;
out vec3 v_world_normal;

vec3 safe_normalize(vec3 value) {
  float maximum_component = max(
    max(abs(value.x), abs(value.y)),
    abs(value.z)
  );
  if (maximum_component == 0.0) return vec3(0.0);
  vec3 scaled = value / maximum_component;
  float length_squared = dot(scaled, scaled);
  if (length_squared == 0.0) return vec3(0.0);
  return scaled * inversesqrt(length_squared);
}

void main() {
  vec4 world_position = u_model * vec4(a_position, 1.0);
  vec3 local_normal = safe_normalize(a_normal);
  v_world_position = world_position.xyz;
  v_world_normal = safe_normalize(u_normal_matrix * local_normal);
  gl_Position = u_projection * u_view * world_position;
}
`;

const LAMBERT_FRAGMENT_SOURCE = `#version 300 es
precision highp float;
precision highp int;

const int MAX_LIGHTS = ${WEBGL_MAX_LIGHTS};
const int LIGHT_KIND_AMBIENT = ${WEBGL_LIGHT_KIND.ambient};
const int LIGHT_KIND_HEMISPHERE = ${WEBGL_LIGHT_KIND.hemisphere};
const int LIGHT_KIND_DIRECTIONAL = ${WEBGL_LIGHT_KIND.directional};
const int LIGHT_KIND_POINT = ${WEBGL_LIGHT_KIND.point};
const int LIGHT_KIND_SPOT = ${WEBGL_LIGHT_KIND.spot};

uniform vec3 u_linear_base_color;
uniform vec3 u_linear_emissive;
uniform float u_alpha;
uniform int u_light_count;
uniform int u_light_kind[MAX_LIGHTS];
uniform vec4 u_light_color_intensity[MAX_LIGHTS];
uniform vec4 u_light_position_range[MAX_LIGHTS];
uniform vec4 u_light_direction_inner_cosine[MAX_LIGHTS];
uniform vec4 u_light_ground_outer_cosine[MAX_LIGHTS];
uniform int u_shadow_enabled[MAX_LIGHTS];
uniform mat4 u_shadow_matrix[MAX_LIGHTS];
uniform vec4 u_shadow_parameters[MAX_LIGHTS];
uniform bool u_receive_shadow;
${SHADOW_2D_SAMPLERS}
${SHADOW_CUBE_SAMPLERS}

in vec3 v_world_position;
in vec3 v_world_normal;
out vec4 out_color;

vec3 safe_normalize(vec3 value) {
  float maximum_component = max(
    max(abs(value.x), abs(value.y)),
    abs(value.z)
  );
  if (maximum_component == 0.0) return vec3(0.0);
  vec3 scaled = value / maximum_component;
  float length_squared = dot(scaled, scaled);
  if (length_squared == 0.0) return vec3(0.0);
  return scaled * inversesqrt(length_squared);
}

vec3 linear_to_srgb(vec3 color) {
  bvec3 use_linear_segment = lessThanEqual(color, vec3(0.0031308));
  vec3 linear_segment = color * 12.92;
  vec3 power_segment = 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055;
  return mix(power_segment, linear_segment, use_linear_segment);
}

float sample_shadow_2d(int index, vec2 coordinates) {
${SHADOW_2D_BRANCHES}
  return 1.0;
}

float sample_shadow_cube(int index, vec3 direction) {
${SHADOW_CUBE_BRANCHES}
  return 1.0;
}

float compare_directional_shadow(
  int index,
  vec2 coordinates,
  float current_depth
) {
  float stored_depth = sample_shadow_2d(index, coordinates);
  return current_depth <= stored_depth ? 1.0 : 0.0;
}

float directional_shadow_visibility(int index) {
  vec4 clip = u_shadow_matrix[index] * vec4(v_world_position, 1.0);
  if (clip.w == 0.0) return 1.0;
  vec3 projected = clip.xyz / clip.w;
  vec2 coordinates = projected.xy * 0.5 + 0.5;
  float current_depth = projected.z * 0.5 + 0.5 -
    u_shadow_parameters[index].x;
  if (coordinates.x < 0.0 || coordinates.x > 1.0 ||
      coordinates.y < 0.0 || coordinates.y > 1.0 ||
      current_depth < 0.0 || current_depth > 1.0) return 1.0;

  float texel = u_shadow_parameters[index].y;
  int comparisons = int(u_shadow_parameters[index].z);
  if (comparisons <= 1) {
    return compare_directional_shadow(index, coordinates, current_depth);
  }
  if (comparisons <= 4) {
    float visibility = 0.0;
    visibility += compare_directional_shadow(
      index,
      coordinates + vec2(-0.5, -0.5) * texel,
      current_depth
    );
    visibility += compare_directional_shadow(
      index,
      coordinates + vec2(0.5, -0.5) * texel,
      current_depth
    );
    visibility += compare_directional_shadow(
      index,
      coordinates + vec2(-0.5, 0.5) * texel,
      current_depth
    );
    visibility += compare_directional_shadow(
      index,
      coordinates + vec2(0.5, 0.5) * texel,
      current_depth
    );
    return visibility * 0.25;
  }
  float visibility = 0.0;
  for (int y = -1; y <= 1; y += 1) {
    for (int x = -1; x <= 1; x += 1) {
      visibility += compare_directional_shadow(
        index,
        coordinates + vec2(float(x), float(y)) * texel,
        current_depth
      );
    }
  }
  return visibility / 9.0;
}

float local_shadow_visibility(int index, vec3 to_light_vector) {
  float stored_depth = sample_shadow_cube(index, -to_light_vector);
  return length(to_light_vector) - u_shadow_parameters[index].x <=
      stored_depth ? 1.0 : 0.0;
}

vec3 local_light_contribution(
  vec3 world_normal,
  vec4 color_intensity,
  vec4 position_range,
  vec4 direction_inner_cosine,
  vec4 ground_outer_cosine,
  bool is_spot
) {
  vec3 to_light_vector = position_range.xyz - v_world_position;
  if (all(equal(to_light_vector, vec3(0.0)))) return vec3(0.0);

  float distance_squared = dot(to_light_vector, to_light_vector);
  vec3 to_light = safe_normalize(to_light_vector);
  float diffuse = max(dot(world_normal, to_light), 0.0);
  float distance_attenuation = 1.0 / max(distance_squared, 0.0001);
  float range_attenuation = 1.0;
  if (position_range.w > 0.0) {
    float ratio = sqrt(distance_squared) / position_range.w;
    float ratio_squared = ratio * ratio;
    float cutoff = clamp(
      1.0 - ratio_squared * ratio_squared,
      0.0,
      1.0
    );
    range_attenuation = cutoff * cutoff;
  }

  float cone = 1.0;
  if (is_spot) {
    float cosine_theta = dot(-to_light, direction_inner_cosine.xyz);
    float inner_cosine = direction_inner_cosine.w;
    float outer_cosine = ground_outer_cosine.w;
    cone = inner_cosine == outer_cosine ?
      (cosine_theta >= inner_cosine ? 1.0 : 0.0) :
      smoothstep(outer_cosine, inner_cosine, cosine_theta);
  }

  return color_intensity.rgb * color_intensity.w * diffuse *
    distance_attenuation * range_attenuation * cone;
}

void main() {
  vec3 world_normal = safe_normalize(v_world_normal);
  vec3 lighting = vec3(0.0);

  for (int index = 0; index < MAX_LIGHTS; index += 1) {
    if (index >= u_light_count) break;
    int kind = u_light_kind[index];
    vec4 color_intensity = u_light_color_intensity[index];
    vec4 position_range = u_light_position_range[index];
    vec4 direction_inner_cosine =
      u_light_direction_inner_cosine[index];
    vec4 ground_outer_cosine = u_light_ground_outer_cosine[index];

    if (kind == LIGHT_KIND_AMBIENT) {
      lighting += color_intensity.rgb * color_intensity.w;
    } else if (kind == LIGHT_KIND_HEMISPHERE) {
      float mix_factor = clamp(
        dot(world_normal, direction_inner_cosine.xyz) * 0.5 + 0.5,
        0.0,
        1.0
      );
      lighting += mix(
        ground_outer_cosine.rgb,
        color_intensity.rgb,
        mix_factor
      ) * color_intensity.w;
    } else if (kind == LIGHT_KIND_DIRECTIONAL) {
      vec3 to_light = -direction_inner_cosine.xyz;
      float diffuse = max(dot(world_normal, to_light), 0.0);
      float visibility = 1.0;
      if (u_receive_shadow && u_shadow_enabled[index] == 1) {
        visibility = directional_shadow_visibility(index);
      }
      lighting += color_intensity.rgb * color_intensity.w * diffuse *
        visibility;
    } else if (kind == LIGHT_KIND_POINT) {
      vec3 contribution = local_light_contribution(
        world_normal,
        color_intensity,
        position_range,
        direction_inner_cosine,
        ground_outer_cosine,
        false
      );
      float visibility = 1.0;
      if (u_receive_shadow && u_shadow_enabled[index] == 2) {
        visibility = local_shadow_visibility(
          index,
          position_range.xyz - v_world_position
        );
      }
      lighting += contribution * visibility;
    } else if (kind == LIGHT_KIND_SPOT) {
      vec3 contribution = local_light_contribution(
        world_normal,
        color_intensity,
        position_range,
        direction_inner_cosine,
        ground_outer_cosine,
        true
      );
      float visibility = 1.0;
      if (u_receive_shadow && u_shadow_enabled[index] == 3) {
        visibility = directional_shadow_visibility(index);
      }
      lighting += contribution * visibility;
    }
  }

  vec3 linear_surface =
    u_linear_base_color * lighting + u_linear_emissive;
  out_color = vec4(
    linear_to_srgb(clamp(linear_surface, vec3(0.0), vec3(1.0))),
    u_alpha
  );
}
`;

export const WEBGL_BUILT_IN_PROGRAM_SOURCES = Object.freeze({
  unlit: Object.freeze({
    vertex: UNLIT_VERTEX_SOURCE,
    fragment: UNLIT_FRAGMENT_SOURCE,
  }),
  lambert: Object.freeze({
    vertex: LAMBERT_VERTEX_SOURCE,
    fragment: LAMBERT_FRAGMENT_SOURCE,
  }),
  'shadow-depth': Object.freeze({
    vertex: SHADOW_DEPTH_VERTEX_SOURCE,
    fragment: SHADOW_DEPTH_FRAGMENT_SOURCE,
  }),
});
