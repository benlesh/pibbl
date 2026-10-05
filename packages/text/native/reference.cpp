// Fixture generator: direct native HarfBuzz, with no Pibbl wrapper or geometry code.
#include <hb.h>
#include <hb-ot.h>
#include <fstream>
#include <iostream>
#include <iterator>
#include <memory>
#include <string>
#include <vector>
int main(int argc, char** argv) {
  if (argc != 4) return 2;
  std::unique_ptr<hb_blob_t, decltype(&hb_blob_destroy)> blob(hb_blob_create_from_file_or_fail(argv[1]), hb_blob_destroy);
  if (!blob) return 3;
  std::unique_ptr<hb_face_t, decltype(&hb_face_destroy)> face(hb_face_create(blob.get(), 0), hb_face_destroy);
  std::unique_ptr<hb_font_t, decltype(&hb_font_destroy)> font(hb_font_create(face.get()), hb_font_destroy);
  std::unique_ptr<hb_buffer_t, decltype(&hb_buffer_destroy)> buffer(hb_buffer_create(), hb_buffer_destroy);
  const auto upem = hb_face_get_upem(face.get());
  hb_ot_font_set_funcs(font.get()); hb_font_set_scale(font.get(), upem, upem);
  std::ifstream input(argv[2], std::ios::binary);
  std::vector<unsigned char> bytes((std::istreambuf_iterator<char>(input)), {});
  if (!input.eof() && input.fail()) return 4;
  std::vector<uint16_t> text;
  for (size_t i = 0; i + 1 < bytes.size(); i += 2) text.push_back(bytes[i] | (bytes[i+1] << 8));
  hb_buffer_add_utf16(buffer.get(), text.data(), text.size(), 0, text.size());
  hb_buffer_guess_segment_properties(buffer.get());
  std::vector<hb_feature_t> features;
  std::string settings(argv[3]); size_t start = 0;
  while (start < settings.size()) {
    auto end = settings.find(',', start); if (end == std::string::npos) end = settings.size();
    hb_feature_t feature;
    if (!hb_feature_from_string(settings.data() + start, end - start, &feature)) return 5;
    features.push_back(feature); start = end + 1;
  }
  hb_shape(font.get(), buffer.get(), features.data(), features.size());
  if (!hb_buffer_allocation_successful(buffer.get())) return 6;
  unsigned count = 0;
  auto info = hb_buffer_get_glyph_infos(buffer.get(), &count);
  auto positions = hb_buffer_get_glyph_positions(buffer.get(), nullptr);
  std::cout << "{\"upem\":" << upem << ",\"glyphs\":[";
  for (unsigned i = 0; i < count; i++) {
    if (i) std::cout << ',';
    auto& p = positions[i];
    std::cout << '[' << info[i].codepoint << ',' << info[i].cluster << ',' << p.x_advance << ',' << p.y_advance << ',' << p.x_offset << ',' << p.y_offset << ']';
  }
  std::cout << "]}\n";
}
