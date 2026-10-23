// Pibbl-authored bounded probe against the separately supplied MIT-licensed Yoga source.
#include <yoga/Yoga.h>
#include <iostream>
int main() {
  const char* names[] = {"grow", "cap", "shrink", "rectangle-shrink", "rectangle-percent-content-box", "column-grow", "column-cap", "column-shrink", "row-reverse-cap", "column-reverse-cap", "row-wrap", "row-wrap-reverse", "border-box-floor-bounds", "border-box-percentage", "border-box-asymmetric-row", "border-box-asymmetric-column"};
  std::cout << "[";
  for (int i = 0; i < 16; i++) {
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false);
    YGConfigSetPointScaleFactor(config, 0);
    YGConfigSetErrata(config, YGErrataNone);
    const bool column = (i >= 5 && i <= 7) || i == 9 || i == 15;
    const bool reverse = i == 8 || i == 9;
    const bool wrapped = i == 10 || i == 11;
    const bool boxed = i >= 12;
    const int count = wrapped ? 3 : 2;
    const auto width = i == 14 ? 200 : i == 12 ? 160 : i == 13 ? 200 : wrapped ? 150 : column ? 100 : i == 2 ? 220 : i == 3 ? 100 : i == 4 ? 200 : 300;
    const auto height = i == 15 ? 160 : i == 12 ? 80 : 100;
    const auto gap = i == 13 ? 0 : i < 3 || column || reverse || wrapped || boxed ? 12 : 0;
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(root, width);
    YGNodeStyleSetHeight(root, height);
    YGNodeStyleSetFlexDirection(root, column ? (reverse ? YGFlexDirectionColumnReverse : YGFlexDirectionColumn) : (reverse ? YGFlexDirectionRowReverse : YGFlexDirectionRow));
    YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
    YGNodeStyleSetAlignContent(root, YGAlignFlexStart);
    YGNodeStyleSetFlexWrap(root, i == 11 ? YGWrapWrapReverse : wrapped ? YGWrapWrap : YGWrapNoWrap);
    YGNodeStyleSetGap(root, YGGutterAll, gap);
    for (int j = 0; j < count; j++) {
      auto child = YGNodeNewWithConfig(config);
      YGNodeStyleSetFlexShrink(child, 1);
      if (i >= 14) {
        YGNodeStyleSetBoxSizing(child, YGBoxSizingBorderBox);
        YGNodeStyleSetPadding(child, YGEdgeLeft, 3); YGNodeStyleSetPadding(child, YGEdgeRight, 5);
        YGNodeStyleSetPadding(child, YGEdgeTop, 7); YGNodeStyleSetPadding(child, YGEdgeBottom, 11);
        YGNodeStyleSetBorder(child, YGEdgeLeft, 2); YGNodeStyleSetBorder(child, YGEdgeRight, 4);
        YGNodeStyleSetBorder(child, YGEdgeTop, 6); YGNodeStyleSetBorder(child, YGEdgeBottom, 8);
        YGNodeStyleSetFlexGrow(child, 0); YGNodeStyleSetFlexShrink(child, 0);
        YGNodeStyleSetFlexBasis(child, column ? 62 : 54);
        if (column) YGNodeStyleSetWidth(child, 54);
      } else if (boxed) {
        YGNodeStyleSetBoxSizing(child, YGBoxSizingBorderBox);
        YGNodeStyleSetPadding(child, YGEdgeAll, 10);
        YGNodeStyleSetFlexGrow(child, 0);
        YGNodeStyleSetMinWidth(child, 0);
        if (i == 12) {
          YGNodeStyleSetFlexShrink(child, 0);
          YGNodeStyleSetFlexBasis(child, j == 0 ? 8 : 80);
          YGNodeStyleSetMaxWidth(child, j == 0 ? 8 : 110);
          if (j == 1) YGNodeStyleSetMinWidth(child, 100);
        } else {
          YGNodeStyleSetFlexBasisPercent(child, 70);
          if (j == 0) { YGNodeStyleSetMinWidth(child, 110); YGNodeStyleSetMaxWidthPercent(child, 60); }
        }
      } else if (wrapped) {
        YGNodeStyleSetWidth(child, 60);
        YGNodeStyleSetFlexBasis(child, 60);
        YGNodeStyleSetFlexGrow(child, 0);
        YGNodeStyleSetMinWidth(child, 0);
      } else if (column) {
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
      if (i == 15) {}
      else if (i == 14) YGNodeStyleSetHeight(child, 62);
      else if (i == 13) YGNodeStyleSetHeightPercent(child, 60);
      else YGNodeStyleSetHeight(child, boxed ? 60 : wrapped ? 20 : 80);
      YGNodeInsertChild(root, child, j);
    }
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionLTR);
    if (i) std::cout << ",";
    std::cout << "{\"name\":\"" << names[i] << "\",\"width\":" << width << ",\"height\":" << height << ",\"gap\":" << gap << ",\"flexDirection\":\"" << (column ? (reverse ? "column-reverse" : "column") : (reverse ? "row-reverse" : "row")) << "\",\"flexWrap\":\"" << (i == 11 ? "wrap-reverse" : wrapped ? "wrap" : "nowrap") << "\",\"boxes\":[";
    for (int j = 0; j < count; j++) {
      auto child = YGNodeGetChild(root, j);
      if (j) std::cout << ",";
      std::cout << "{\"x\":" << YGNodeLayoutGetLeft(child) << ",\"y\":" << YGNodeLayoutGetTop(child) << ",\"width\":" << YGNodeLayoutGetWidth(child) << ",\"height\":" << YGNodeLayoutGetHeight(child) << "}";
    }
    std::cout << "]}";
    YGNodeFreeRecursive(root); YGConfigFree(config);
  }
  std::cout << "]\n";
}
