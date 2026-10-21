// Pibbl-authored bounded probe against the separately supplied MIT-licensed Yoga source.
#include <yoga/Yoga.h>
#include <iostream>
int main() {
  const char* names[] = {"grow", "cap", "shrink"};
  std::cout << "[";
  for (int i = 0; i < 3; i++) {
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false);
    YGConfigSetPointScaleFactor(config, 0);
    YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(root, i == 2 ? 220 : 300);
    YGNodeStyleSetHeight(root, 100);
    YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow);
    YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
    YGNodeStyleSetGap(root, YGGutterAll, 12);
    for (int j = 0; j < 2; j++) {
      auto child = YGNodeNewWithConfig(config);
      YGNodeStyleSetFlexBasis(child, i == 2 ? 180 : 60);
      YGNodeStyleSetFlexGrow(child, i == 2 ? 0 : 1);
      YGNodeStyleSetFlexShrink(child, 1);
      YGNodeStyleSetMinWidth(child, i == 2 && j == 0 ? 120 : 0);
      if (i == 1 && j == 0) YGNodeStyleSetMaxWidth(child, 80);
      YGNodeStyleSetHeight(child, 80);
      YGNodeInsertChild(root, child, j);
    }
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionLTR);
    if (i) std::cout << ",";
    std::cout << "{\"name\":\"" << names[i] << "\",\"width\":" << (i == 2 ? 220 : 300) << ",\"boxes\":[";
    for (int j = 0; j < 2; j++) {
      auto child = YGNodeGetChild(root, j);
      if (j) std::cout << ",";
      std::cout << "{\"x\":" << YGNodeLayoutGetLeft(child) << ",\"y\":" << YGNodeLayoutGetTop(child) << ",\"width\":" << YGNodeLayoutGetWidth(child) << ",\"height\":" << YGNodeLayoutGetHeight(child) << "}";
    }
    std::cout << "]}";
    YGNodeFreeRecursive(root); YGConfigFree(config);
  }
  std::cout << "]\n";
}
