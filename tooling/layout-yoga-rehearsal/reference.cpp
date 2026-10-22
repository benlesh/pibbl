// Pibbl-authored bounded probe against the separately supplied MIT-licensed Yoga source.
#include <yoga/Yoga.h>
#include <iostream>
int main() {
  const char* names[] = {"grow", "cap", "shrink", "rectangle-shrink", "rectangle-percent-content-box", "column-grow", "column-cap", "column-shrink", "row-reverse-cap", "column-reverse-cap"};
  std::cout << "[";
  for (int i = 0; i < 10; i++) {
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false);
    YGConfigSetPointScaleFactor(config, 0);
    YGConfigSetErrata(config, YGErrataNone);
    const bool column = i >= 5 && i != 8;
    const bool reverse = i >= 8;
    const auto width = column ? 100 : i == 2 ? 220 : i == 3 ? 100 : i == 4 ? 200 : 300;
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(root, width);
    YGNodeStyleSetHeight(root, 100);
    YGNodeStyleSetFlexDirection(root, column ? (reverse ? YGFlexDirectionColumnReverse : YGFlexDirectionColumn) : (reverse ? YGFlexDirectionRowReverse : YGFlexDirectionRow));
    YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
    YGNodeStyleSetGap(root, YGGutterAll, i < 3 || column || reverse ? 12 : 0);
    for (int j = 0; j < 2; j++) {
      auto child = YGNodeNewWithConfig(config);
      YGNodeStyleSetFlexShrink(child, 1);
      if (column) {
        YGNodeStyleSetWidth(child, 80);
        YGNodeStyleSetFlexBasis(child, i == 7 ? 80 : 20);
        YGNodeStyleSetFlexGrow(child, i == 7 ? 0 : 1);
        YGNodeStyleSetMinHeight(child, i == 7 && j == 0 ? 60 : 0);
        if ((i == 6 || i == 9) && j == 0) YGNodeStyleSetMaxHeight(child, 30);
      } else if (i < 3 || i == 8) {
        YGNodeStyleSetFlexBasis(child, i == 2 ? 180 : 60);
        YGNodeStyleSetFlexGrow(child, i == 2 ? 0 : 1);
        YGNodeStyleSetMinWidth(child, i == 2 && j == 0 ? 120 : 0);
        if ((i == 1 || i == 8) && j == 0) YGNodeStyleSetMaxWidth(child, 80);
      } else {
        YGNodeStyleSetWidth(child, 80);
        if (i == 4) {
          YGNodeStyleSetBoxSizing(child, YGBoxSizingContentBox);
          YGNodeStyleSetFlexBasisPercent(child, 70);
          YGNodeStyleSetPadding(child, YGEdgeAll, 10);
          if (j == 0) YGNodeStyleSetMinWidth(child, 90);
        }
      }
      YGNodeStyleSetHeight(child, 80);
      YGNodeInsertChild(root, child, j);
    }
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionLTR);
    if (i) std::cout << ",";
    std::cout << "{\"name\":\"" << names[i] << "\",\"width\":" << width << ",\"height\":100,\"flexDirection\":\"" << (column ? (reverse ? "column-reverse" : "column") : (reverse ? "row-reverse" : "row")) << "\",\"boxes\":[";
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
