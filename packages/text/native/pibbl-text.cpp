#include <hb.h>
#include <hb-ot.h>
#include <emscripten/emscripten.h>
#include <cstdint>
#include <memory>
#include <unordered_map>
#include <vector>
#include <limits>
#include <malloc.h>
#include <new>

// Private deterministic fault injection; disabled unless the test entry arms it.
static int32_t fail_draw_after = -1;
static uint32_t fail_setup = 0;
static bool profiling = false;
static double profile_times[3] = {};

// Handles are monotonically allocated and never reused during this module lifetime.
struct ShapeConfiguration {
  hb_segment_properties_t properties;
  std::vector<hb_feature_t> features;
  bool matches(const hb_segment_properties_t& other, const hb_feature_t* data, uint32_t count) const {
    if (!hb_segment_properties_equal(&properties, &other) || features.size() != count) return false;
    for (uint32_t i = 0; i < count; ++i)
      if (features[i].tag != data[i].tag || features[i].value != data[i].value ||
          features[i].start != data[i].start || features[i].end != data[i].end) return false;
    return true;
  }
};
struct Font {
  hb_font_t* value;
  std::vector<ShapeConfiguration> configurations;
  bool invalidated = false;
  explicit Font(hb_font_t* value) : value(value) { configurations.reserve(64); }
  ~Font() { hb_font_destroy(value); }
  bool prepare(hb_buffer_t* buffer, const hb_feature_t* features, uint32_t count) {
    hb_segment_properties_t properties;
    hb_buffer_get_segment_properties(buffer, &properties);
    if (!invalidated) for (const auto& configuration : configurations)
      if (configuration.matches(properties, features, count)) return true;
    ShapeConfiguration next { properties, {} };
    if (count) next.features.assign(features, features + count);
    if (invalidated || configurations.size() == 64) {
      // HarfBuzz's face-owned plan cache is an unbounded linked list. Renew
      // the internal face after 64 distinct configurations to bound retention
      // and lookup work, preserving the public font and sharing its blob bytes.
      // This wrapper supports one fixed default face/variation configuration.
      using BlobOwner = std::unique_ptr<hb_blob_t, decltype(&hb_blob_destroy)>;
      using FaceOwner = std::unique_ptr<hb_face_t, decltype(&hb_face_destroy)>;
      using FontOwner = std::unique_ptr<hb_font_t, decltype(&hb_font_destroy)>;
      const auto old_face = hb_font_get_face(value);
      BlobOwner blob(hb_face_reference_blob(old_face), hb_blob_destroy);
      if (!hb_blob_get_length(blob.get())) return false;
      FaceOwner face(hb_face_create(blob.get(), hb_face_get_index(old_face)), hb_face_destroy);
      if (!hb_face_get_glyph_count(face.get())) return false;
      FontOwner replacement(hb_font_create(face.get()), hb_font_destroy);
      if (replacement.get() == hb_font_get_empty()) return false;
      int x_scale, y_scale;
      hb_font_get_scale(value, &x_scale, &y_scale);
      hb_ot_font_set_funcs(replacement.get());
      hb_font_set_scale(replacement.get(), x_scale, y_scale);
      auto previous = value;
      value = replacement.release();
      hb_font_destroy(previous);
      configurations.clear();
      invalidated = false;
    }
    configurations.push_back(std::move(next));
    return true;
  }
};
struct Result {
  std::vector<uint8_t> commands;
  std::vector<double> coordinates;
  // glyph ID, UTF-16 cluster, first segment, segment count
  std::vector<uint32_t> glyphs;
  // x/y origin and x/y advance, in font units (Y up)
  std::vector<double> positions;
  double pen_x = 0, pen_y = 0, x = 0, y = 0;
  uint32_t limit = 1000000;
  bool overflow = false;
  bool allocation_failed = false;
  int64_t budget = 1 << 24;
  void append(uint8_t command, std::initializer_list<double> values) noexcept {
    if (allocation_failed || overflow) return;
    if (commands.size() >= limit) { overflow = true; budget = 0; return; }
    try {
    if (fail_draw_after >= 0 && fail_draw_after-- == 0) throw std::bad_alloc();
    commands.push_back(command);
    size_t i = 0;
    for (double v : values) coordinates.push_back(v + ((i++ & 1) ? y : x));
    } catch (...) {
      // Never unwind through HarfBuzz: its glyph scratch lease must be returned.
      allocation_failed = true; budget = 0;
    }
  }
};
static std::unordered_map<uint32_t, std::unique_ptr<Font>> fonts;
static std::unordered_map<uint32_t, std::unique_ptr<Result>> results;
static uint32_t next_handle = 1;
static uint32_t last_error = 0;
using BufferOwner = std::unique_ptr<hb_buffer_t, decltype(&hb_buffer_destroy)>;
using DrawOwner = std::unique_ptr<hb_draw_funcs_t, decltype(&hb_draw_funcs_destroy)>;
static uint32_t issue_handle() {
  if (next_handle == std::numeric_limits<uint32_t>::max()) return 0;
  return next_handle++;
}
static void move_to(hb_draw_funcs_t*, void* data, hb_draw_state_t*, float x, float y, void*) { static_cast<Result*>(data)->append(0, {x,y}); }
static void line_to(hb_draw_funcs_t*, void* data, hb_draw_state_t*, float x, float y, void*) { static_cast<Result*>(data)->append(1, {x,y}); }
static void quad_to(hb_draw_funcs_t*, void* data, hb_draw_state_t*, float a, float b, float x, float y, void*) { static_cast<Result*>(data)->append(2, {a,b,x,y}); }
static void cubic_to(hb_draw_funcs_t*, void* data, hb_draw_state_t*, float a, float b, float c, float d, float x, float y, void*) { static_cast<Result*>(data)->append(3, {a,b,c,d,x,y}); }
static void close_path(hb_draw_funcs_t*, void* data, hb_draw_state_t*, void*) { static_cast<Result*>(data)->append(4, {}); }
static int64_t* remaining_budget(hb_draw_funcs_t*, void* data, void*) { return &static_cast<Result*>(data)->budget; }
extern "C" {
EMSCRIPTEN_KEEPALIVE uint32_t pibbl_protocol() { return PIBBL_TEXT_PROTOCOL; }
EMSCRIPTEN_KEEPALIVE uint32_t pibbl_font_create(const char* bytes, uint32_t length) try {
  last_error = 0;
  using BlobOwner = std::unique_ptr<hb_blob_t, decltype(&hb_blob_destroy)>;
  using FaceOwner = std::unique_ptr<hb_face_t, decltype(&hb_face_destroy)>;
  using FontOwner = std::unique_ptr<hb_font_t, decltype(&hb_font_destroy)>;
  BlobOwner blob(hb_blob_create(bytes, length, HB_MEMORY_MODE_DUPLICATE, nullptr, nullptr), hb_blob_destroy);
  if (hb_blob_get_length(blob.get()) != length) { last_error = 3; return 0; }
  FaceOwner face(hb_face_create(blob.get(), 0), hb_face_destroy);
  if (!hb_face_get_glyph_count(face.get())) return 0;
  FontOwner font(hb_font_create(face.get()), hb_font_destroy);
  if (font.get() == hb_font_get_empty()) { last_error = 3; return 0; }
  const auto upem = hb_face_get_upem(face.get());
  hb_ot_font_set_funcs(font.get());
  hb_font_set_scale(font.get(), upem, upem);
  const auto handle = issue_handle();
  if (!handle) return 0;
  // Transfer only after allocating the wrapper. A failed map insertion then
  // destroys that wrapper and its font; earlier failures retain the local owner.
  auto owned = std::make_unique<Font>(font.get());
  font.release();
  fonts.emplace(handle, std::move(owned));
  return handle;
} catch (...) { last_error = 3; return 0; }
EMSCRIPTEN_KEEPALIVE void pibbl_font_release(uint32_t handle) { fonts.erase(handle); }
EMSCRIPTEN_KEEPALIVE uint32_t pibbl_font_upem(uint32_t handle) {
  auto it = fonts.find(handle); return it == fonts.end() ? 0 : hb_face_get_upem(hb_font_get_face(it->second->value));
}
EMSCRIPTEN_KEEPALIVE uint32_t pibbl_shape(uint32_t handle, const uint16_t* text, uint32_t length, uint32_t limit,
    uint32_t direction, uint32_t script, const char* language, const hb_feature_t* features, uint32_t feature_count, uint32_t allow_notdef) try {
  last_error = 0;
  double phase_start = profiling ? emscripten_get_now() : 0;
  auto it = fonts.find(handle); if (it == fonts.end() || length > 100000 || feature_count > 64 || direction > 2 || allow_notdef > 1 || !limit || limit > 1000000) return 0;
  const auto failed_setup = fail_setup; fail_setup = 0;
  BufferOwner buffer_owner(failed_setup == 1 ? hb_buffer_get_empty() : hb_buffer_create(), hb_buffer_destroy);
  auto buffer = buffer_owner.get();
  if (buffer == hb_buffer_get_empty()) { last_error = 3; return 0; }
  hb_buffer_add_utf16(buffer, text, length, 0, length);
  if (direction) hb_buffer_set_direction(buffer, direction == 1 ? HB_DIRECTION_LTR : HB_DIRECTION_RTL);
  if (script) hb_buffer_set_script(buffer, hb_script_from_iso15924_tag(script));
  if (language) hb_buffer_set_language(buffer, hb_language_from_string(language, -1));
  hb_buffer_guess_segment_properties(buffer);
  if (!it->second->prepare(buffer, features, feature_count)) { last_error = 3; return 0; }
  if (profiling) { profile_times[0] = emscripten_get_now() - phase_start; phase_start = emscripten_get_now(); }
  if (!hb_shape_full(it->second->value, buffer, features, feature_count, nullptr)) {
    it->second->invalidated = true; last_error = 3; return 0;
  }
  if (profiling) { profile_times[1] = emscripten_get_now() - phase_start; phase_start = emscripten_get_now(); }
  unsigned count = 0;
  const auto info = hb_buffer_get_glyph_infos(buffer, &count);
  const auto pos = hb_buffer_get_glyph_positions(buffer, nullptr);
  if (!hb_buffer_allocation_successful(buffer) || count > 200000) { last_error = 3; return 0; }
  auto result = std::make_unique<Result>(); result->limit = limit;
  DrawOwner draw_owner(failed_setup == 2 ? hb_draw_funcs_get_empty() : hb_draw_funcs_create(), hb_draw_funcs_destroy);
  auto draw = draw_owner.get();
  if (draw == hb_draw_funcs_get_empty()) { last_error = 3; return 0; }
  hb_draw_funcs_set_move_to_func(draw, move_to, nullptr, nullptr);
  hb_draw_funcs_set_line_to_func(draw, line_to, nullptr, nullptr);
  hb_draw_funcs_set_quadratic_to_func(draw, quad_to, nullptr, nullptr);
  hb_draw_funcs_set_cubic_to_func(draw, cubic_to, nullptr, nullptr);
  hb_draw_funcs_set_close_path_func(draw, close_path, nullptr, nullptr);
  hb_draw_funcs_set_get_budget_remaining_func(draw, remaining_budget, nullptr, nullptr);
  bool missing = false;
  for (unsigned i = 0; i < count; i++) {
    if (info[i].codepoint == 0 && !allow_notdef) { missing = true; break; }
    const uint32_t start = result->commands.size();
    result->x = result->pen_x + pos[i].x_offset;
    result->y = result->pen_y + pos[i].y_offset;
    const bool drawn = hb_font_draw_glyph_or_fail(it->second->value, info[i].codepoint, draw, result.get());
    if (result->allocation_failed) { last_error = 3; return 0; }
    if (result->overflow || result->budget <= 0) { last_error = 2; return 0; }
    if (!drawn) { last_error = 4; return 0; }
    result->glyphs.insert(result->glyphs.end(), {info[i].codepoint, info[i].cluster, start, static_cast<uint32_t>(result->commands.size()) - start});
    result->positions.insert(result->positions.end(), {result->x, result->y, static_cast<double>(pos[i].x_advance), static_cast<double>(pos[i].y_advance)});
    result->pen_x += pos[i].x_advance; result->pen_y += pos[i].y_advance;
    if (result->overflow) break;
  }
  if (missing || result->overflow) { last_error = missing ? 1 : 2; return 0; }
  const auto id = issue_handle(); if (!id) return 0;
  results.emplace(id, std::move(result));
  if (profiling) profile_times[2] = emscripten_get_now() - phase_start;
  return id;
} catch (...) { last_error = 3; return 0; }
EMSCRIPTEN_KEEPALIVE void pibbl_profile_enabled(uint32_t enabled) { profiling = enabled != 0; if (profiling) for (double &time : profile_times) time = 0; }
EMSCRIPTEN_KEEPALIVE double pibbl_profile_time(uint32_t phase) { return phase < 3 ? profile_times[phase] : 0; }
EMSCRIPTEN_KEEPALIVE uint32_t pibbl_error() { return last_error; }
EMSCRIPTEN_KEEPALIVE void pibbl_result_release(uint32_t handle) { results.erase(handle); }
EMSCRIPTEN_KEEPALIVE uintptr_t pibbl_result_data(uint32_t handle, uint32_t field) {
  auto it = results.find(handle); if (it == results.end()) return 0;
  auto& r = *it->second;
  switch (field) { case 0: return reinterpret_cast<uintptr_t>(r.commands.data()); case 1: return reinterpret_cast<uintptr_t>(r.coordinates.data()); case 2: return reinterpret_cast<uintptr_t>(r.glyphs.data()); case 3: return reinterpret_cast<uintptr_t>(r.positions.data()); default: return 0; }
}
EMSCRIPTEN_KEEPALIVE uint32_t pibbl_result_length(uint32_t handle, uint32_t field) {
  auto it = results.find(handle); if (it == results.end()) return 0;
  auto& r = *it->second;
  switch (field) { case 0: return r.commands.size(); case 1: return r.coordinates.size(); case 2: return r.glyphs.size(); case 3: return r.positions.size(); default: return 0; }
}
EMSCRIPTEN_KEEPALIVE double pibbl_result_advance(uint32_t handle, uint32_t axis) {
  auto it = results.find(handle); if (it == results.end()) return 0;
  return axis ? it->second->pen_y : it->second->pen_x;
}
EMSCRIPTEN_KEEPALIVE void pibbl_test_fail_setup(uint32_t phase) { fail_setup = phase; }
EMSCRIPTEN_KEEPALIVE void pibbl_test_fail_draw_after(int32_t count) { fail_draw_after = count; }
EMSCRIPTEN_KEEPALIVE uint32_t pibbl_heap_used() { return mallinfo().uordblks; }
EMSCRIPTEN_KEEPALIVE uint32_t pibbl_live_fonts() { return fonts.size(); }
EMSCRIPTEN_KEEPALIVE uint32_t pibbl_live_results() { return results.size(); }
}
