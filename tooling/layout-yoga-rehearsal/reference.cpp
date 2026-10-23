// Pibbl-authored bounded probe against the separately supplied MIT-licensed Yoga source.
#include <yoga/Yoga.h>
#include <iostream>
struct NumericStyle { double basis, grow, shrink, minimum, maximum; };
static NumericStyle numericStyle(int i, int j) {
  const double basis = i == 17 || i == 19 || i == 22 || i == 24 ? 80 : i == 18 ? 100 : i == 23 ? 20 : 0;
  const double grow = i == 16 ? (j == 0 ? .5 : 1.5) : i == 18 ? 1 : i == 20 ? (j == 0 ? 1e30 : 2e30) : i == 21 || i == 23 ? .25 : 0;
  const double shrink = i == 17 ? (j == 0 ? .5 : 1.5) : i == 19 ? (j == 0 ? 1 : 3) : i == 22 || i == 24 ? .25 : 0;
  return {basis, grow, shrink, j == 0 ? (i == 24 ? 90. : i == 19 ? 70. : 0.) : 0., j == 0 ? (i == 23 ? 10. : i == 18 ? 110. : 1000000.) : 1000000.};
}
int main() {
  const char* names[] = {"grow", "cap", "shrink", "rectangle-shrink", "rectangle-percent-content-box", "column-grow", "column-cap", "column-shrink", "row-reverse-cap", "column-reverse-cap", "row-wrap", "row-wrap-reverse", "border-box-floor-bounds", "border-box-percentage", "border-box-asymmetric-row", "border-box-asymmetric-column", "zero-fractional-grow", "fractional-shrink", "grow-freeze-release", "shrink-freeze-release", "large-finite-differential", "subunit-zero-grow", "subunit-shrink-policy", "initial-freeze-grow-policy", "initial-freeze-shrink-policy"};
  std::cout << "[";
  for (int i = 0; i < 25; i++) {
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false);
    YGConfigSetPointScaleFactor(config, 0);
    YGConfigSetErrata(config, YGErrataNone);
    const bool column = (i >= 5 && i <= 7) || i == 9 || i == 15;
    const bool reverse = i == 8 || i == 9;
    const bool wrapped = i == 10 || i == 11;
    const bool boxed = i >= 12 && i <= 15;
    const int count = wrapped ? 3 : 2;
    const auto width = i >= 16 ? (i == 18 || i == 20 ? 312 : 112) : i == 14 ? 200 : i == 12 ? 160 : i == 13 ? 200 : wrapped ? 150 : column ? 100 : i == 2 ? 220 : i == 3 ? 100 : i == 4 ? 200 : 300;
    const auto height = i == 15 ? 160 : i == 12 ? 80 : 100;
    const auto gap = i >= 16 ? 12 : i == 13 ? 0 : i < 3 || column || reverse || wrapped || boxed ? 12 : 0;
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
      if (i >= 16) {
        const auto style = numericStyle(i,j);
        YGNodeStyleSetWidth(child, style.basis); YGNodeStyleSetFlexBasis(child, style.basis);
        YGNodeStyleSetFlexGrow(child, style.grow); YGNodeStyleSetFlexShrink(child, style.shrink);
        YGNodeStyleSetMinWidth(child, style.minimum); YGNodeStyleSetMaxWidth(child, style.maximum);
      } else if (i >= 14) {
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
    std::cout << "]";
    if (i >= 16) {
      std::cout << ",\"itemStyles\":[";
      for (int j = 0; j < 2; j++) {
        const auto style = numericStyle(i,j);
        if (j) std::cout << ",";
        std::cout << "{\"width\":" << style.basis << ",\"height\":80,\"flexBasis\":" << style.basis << ",\"flexGrow\":" << style.grow << ",\"flexShrink\":" << style.shrink << ",\"minWidth\":" << style.minimum << ",\"maxWidth\":" << style.maximum << "}";
      }
      std::cout << "]";
    }
    if (i == 22) std::cout << ",\"classification\":\"preserved-css-partial-shrink\",\"pibblBoxes\":[{\"x\":0,\"y\":0,\"width\":65,\"height\":80},{\"x\":77,\"y\":0,\"width\":65,\"height\":80}]";
    if (i == 22) std::cout << ",\"comparisonLabel\":\"CSS partial shrink: Yoga50/50 vs Pibbl65/65\"";
    if (i == 23) std::cout << ",\"classification\":\"css-initial-freeze-grow\",\"comparisonLabel\":\"CSS freeze grow: Yoga43.3333 vs Pibbl37.5\",\"pibblBoxes\":[{\"x\":0,\"y\":0,\"width\":10,\"height\":80},{\"x\":22,\"y\":0,\"width\":37.5,\"height\":80}]";
    if (i == 24) std::cout << ",\"classification\":\"css-initial-freeze-shrink\",\"comparisonLabel\":\"CSS freeze shrink: Yoga10 vs Pibbl62.5\",\"pibblBoxes\":[{\"x\":0,\"y\":0,\"width\":90,\"height\":80},{\"x\":102,\"y\":0,\"width\":62.5,\"height\":80}]";
    std::cout << "}";
    YGNodeFreeRecursive(root); YGConfigFree(config);
  }
  std::cout << "]\n";
}
