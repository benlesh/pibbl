#include <yoga/Yoga.h>
#include <cstdio>
#include <initializer_list>

namespace {
void setMain(YGNodeRef node, bool column, float value) {
  if (column) YGNodeStyleSetHeight(node, value); else YGNodeStyleSetWidth(node, value);
}
void setCross(YGNodeRef node, bool column, float value) {
  if (column) YGNodeStyleSetWidth(node, value); else YGNodeStyleSetHeight(node, value);
}
void setMinMain(YGNodeRef node, bool column, float value) {
  if (column) YGNodeStyleSetMinHeight(node, value); else YGNodeStyleSetMinWidth(node, value);
}
void setMaxMain(YGNodeRef node, bool column, float value) {
  if (column) YGNodeStyleSetMaxHeight(node, value); else YGNodeStyleSetMaxWidth(node, value);
}
void setAutoMainStart(YGNodeRef node, bool column) {
  YGNodeStyleSetMarginAuto(node, column ? YGEdgeTop : YGEdgeLeft);
}
void setAutoMainEnd(YGNodeRef node, bool column) {
  YGNodeStyleSetMarginAuto(node, column ? YGEdgeBottom : YGEdgeRight);
}
float main(YGNodeRef node, bool column) { return column ? YGNodeLayoutGetHeight(node) : YGNodeLayoutGetWidth(node); }
float mainStart(YGNodeRef node, bool column) { return column ? YGNodeLayoutGetTop(node) : YGNodeLayoutGetLeft(node); }
enum class OwnerBound { None, Max160, Min200 };
const char* boundName(OwnerBound value) {
  switch (value) { case OwnerBound::None: return "unbounded"; case OwnerBound::Max160: return "max160"; case OwnerBound::Min200: return "min200"; }
  return "invalid";
}
// The finite-parent mode uses an exact opposite-axis 200px parent so the auto
// owner receives a real at-most main envelope; it is intentionally not a root
// StretchFit calculation.
void run(bool column, bool finiteParent, OwnerBound bound, bool bothAuto) {
  auto config = YGConfigNew();
  YGConfigSetUseWebDefaults(config, false);
  YGConfigSetPointScaleFactor(config, 0);
  YGConfigSetErrata(config, YGErrataNone);
  auto root = YGNodeNewWithConfig(config);
  auto owner = YGNodeNewWithConfig(config);
  auto a = YGNodeNewWithConfig(config);
  auto b = YGNodeNewWithConfig(config);
  YGNodeStyleSetFlexDirection(root, column ? YGFlexDirectionRow : YGFlexDirectionColumn);
  YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
  if (finiteParent) {
    if (column) { YGNodeStyleSetWidth(root, 100); YGNodeStyleSetHeight(root, 200); }
    else { YGNodeStyleSetWidth(root, 200); YGNodeStyleSetHeight(root, 100); }
  }
  YGNodeStyleSetFlexDirection(owner, column ? YGFlexDirectionColumn : YGFlexDirectionRow);
  YGNodeStyleSetAlignItems(owner, YGAlignFlexStart);
  YGNodeStyleSetFlexGrow(owner, 0); YGNodeStyleSetFlexShrink(owner, 0);
  setCross(owner, column, 20);
  if (bound == OwnerBound::Max160) setMaxMain(owner, column, 160);
  if (bound == OwnerBound::Min200) setMinMain(owner, column, 200);
  for (auto child : { a, b }) {
    YGNodeStyleSetFlexGrow(child, 0); YGNodeStyleSetFlexShrink(child, 0);
    setCross(child, column, 20); setMinMain(child, column, 0);
  }
  setMain(a, column, 40); YGNodeStyleSetFlexBasis(a, 40);
  setAutoMainStart(a, column); if (bothAuto) setAutoMainEnd(a, column);
  setMain(b, column, 80); YGNodeStyleSetFlexBasis(b, 80);
  YGNodeInsertChild(owner, a, 0); YGNodeInsertChild(owner, b, 1); YGNodeInsertChild(root, owner, 0);
  YGNodeCalculateLayout(root, column ? (finiteParent ? 100 : YGUndefined) : (finiteParent ? 200 : YGUndefined), column ? (finiteParent ? 200 : YGUndefined) : (finiteParent ? 100 : YGUndefined), YGDirectionLTR);
  std::printf("intrinsic-auto-margin axis=%s parent=%s bound=%s margin=%s root=%.17g owner=%.17g A={start:%.17g,main:%.17g} B={start:%.17g,main:%.17g}\n",
    column ? "column" : "row", finiteParent ? "finite200" : "undefined", boundName(bound), bothAuto ? "both" : "start", main(root, column), main(owner, column), mainStart(a, column), main(a, column), mainStart(b, column), main(b, column));
  YGNodeFreeRecursive(root); YGConfigFree(config);
}

// Cross-axis auto margins are final placement only: the automatic main owner
// remains 120 (A40+B80), while the explicit 200 cross owner distributes free
// cross space after sizing. `opposite10` retains a numeric trailing margin.
enum class CrossProfile { Start, Both, Overflow, Opposite10 };
const char* crossName(CrossProfile value) {
  switch (value) { case CrossProfile::Start: return "start"; case CrossProfile::Both: return "both"; case CrossProfile::Overflow: return "overflow"; case CrossProfile::Opposite10: return "start-opposite10"; }
  return "invalid";
}
void runCrossAuto(bool column, CrossProfile profile) {
  auto config = YGConfigNew();
  YGConfigSetUseWebDefaults(config, false);
  YGConfigSetPointScaleFactor(config, 0);
  YGConfigSetErrata(config, YGErrataNone);
  auto root = YGNodeNewWithConfig(config);
  auto a = YGNodeNewWithConfig(config);
  auto b = YGNodeNewWithConfig(config);
  YGNodeStyleSetFlexDirection(root, column ? YGFlexDirectionColumn : YGFlexDirectionRow);
  YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
  // Main stays automatic; cross is fixed 200 except the overflow control.
  setCross(root, column, profile == CrossProfile::Overflow ? 20 : 200);
  for (auto child : { a, b }) { YGNodeStyleSetFlexGrow(child, 0); YGNodeStyleSetFlexShrink(child, 0); setMinMain(child, column, 0); }
  setMain(a, column, 40); YGNodeStyleSetFlexBasis(a, 40);
  setMain(b, column, 80); YGNodeStyleSetFlexBasis(b, 80);
  setCross(a, column, 40); setCross(b, column, 20);
  YGNodeStyleSetMarginAuto(a, column ? YGEdgeLeft : YGEdgeTop);
  if (profile == CrossProfile::Both) YGNodeStyleSetMarginAuto(a, column ? YGEdgeRight : YGEdgeBottom);
  if (profile == CrossProfile::Opposite10) {
    if (column) YGNodeStyleSetMargin(a, YGEdgeRight, 10); else YGNodeStyleSetMargin(a, YGEdgeBottom, 10);
  }
  YGNodeInsertChild(root, a, 0); YGNodeInsertChild(root, b, 1);
  YGNodeCalculateLayout(root, column ? (profile == CrossProfile::Overflow ? 20 : 200) : YGUndefined, column ? YGUndefined : (profile == CrossProfile::Overflow ? 20 : 200), YGDirectionLTR);
  const float aCrossStart = column ? YGNodeLayoutGetLeft(a) : YGNodeLayoutGetTop(a);
  const float bCrossStart = column ? YGNodeLayoutGetLeft(b) : YGNodeLayoutGetTop(b);
  std::printf("intrinsic-auto-cross-margin axis=%s profile=%s root={main:%.17g,cross:%.17g} A={main:%.17g,crossStart:%.17g,cross:%.17g} B={main:%.17g,crossStart:%.17g,cross:%.17g}\n",
    column ? "column" : "row", crossName(profile), main(root, column), column ? YGNodeLayoutGetWidth(root) : YGNodeLayoutGetHeight(root), main(a, column), aCrossStart, column ? YGNodeLayoutGetWidth(a) : YGNodeLayoutGetHeight(a), main(b, column), bCrossStart, column ? YGNodeLayoutGetWidth(b) : YGNodeLayoutGetHeight(b));
  YGNodeFreeRecursive(root); YGConfigFree(config);
}
enum class ShorthandProfile { AllAuto, PhysicalLeft0, LogicalStartAuto };
const char* shorthandName(ShorthandProfile value) {
  switch (value) {
    case ShorthandProfile::AllAuto: return "all-auto";
    case ShorthandProfile::PhysicalLeft0: return "all-auto-left0";
    case ShorthandProfile::LogicalStartAuto: return "all-auto-left0-start-auto";
  }
  return "invalid";
}
// This nested owner has its own 200px main minimum under an exact 200px
// parent. The A/B contribution remains 120; margin auto is resolved only by
// the final owner placement. Physical left and logical start are deliberately
// written after the shorthand to make precedence observable.
void runShorthand(bool column, YGDirection direction, ShorthandProfile profile) {
  auto config = YGConfigNew();
  YGConfigSetUseWebDefaults(config, false);
  YGConfigSetPointScaleFactor(config, 0);
  YGConfigSetErrata(config, YGErrataNone);
  auto root = YGNodeNewWithConfig(config);
  auto owner = YGNodeNewWithConfig(config);
  auto a = YGNodeNewWithConfig(config);
  auto b = YGNodeNewWithConfig(config);
  YGNodeStyleSetFlexDirection(root, column ? YGFlexDirectionRow : YGFlexDirectionColumn);
  YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
  if (column) { YGNodeStyleSetWidth(root, 200); YGNodeStyleSetHeight(root, 200); }
  else { YGNodeStyleSetWidth(root, 200); YGNodeStyleSetHeight(root, 200); }
  YGNodeStyleSetFlexDirection(owner, column ? YGFlexDirectionColumn : YGFlexDirectionRow);
  YGNodeStyleSetAlignItems(owner, YGAlignFlexStart);
  YGNodeStyleSetFlexGrow(owner, 0); YGNodeStyleSetFlexShrink(owner, 0);
  setMinMain(owner, column, 200); setCross(owner, column, 200);
  for (auto child : {a, b}) { YGNodeStyleSetFlexGrow(child, 0); YGNodeStyleSetFlexShrink(child, 0); setMinMain(child, column, 0); }
  setMain(a, column, 40); YGNodeStyleSetFlexBasis(a, 40); setCross(a, column, 40);
  setMain(b, column, 80); YGNodeStyleSetFlexBasis(b, 80); setCross(b, column, 20);
  YGNodeStyleSetMarginAuto(a, YGEdgeAll);
  if (profile == ShorthandProfile::PhysicalLeft0 || profile == ShorthandProfile::LogicalStartAuto) YGNodeStyleSetMargin(a, YGEdgeLeft, 0);
  if (profile == ShorthandProfile::LogicalStartAuto) YGNodeStyleSetMarginAuto(a, YGEdgeStart);
  YGNodeInsertChild(owner, a, 0); YGNodeInsertChild(owner, b, 1); YGNodeInsertChild(root, owner, 0);
  YGNodeCalculateLayout(root, 200, 200, direction);
  std::printf("intrinsic-auto-shorthand axis=%s direction=%s profile=%s owner={main:%.17g,cross:%.17g} A={left:%.17g,top:%.17g,main:%.17g,cross:%.17g} B={left:%.17g,top:%.17g,main:%.17g,cross:%.17g}\n",
    column ? "column" : "row", direction == YGDirectionRTL ? "rtl" : "ltr", shorthandName(profile), main(owner, column), column ? YGNodeLayoutGetWidth(owner) : YGNodeLayoutGetHeight(owner), YGNodeLayoutGetLeft(a), YGNodeLayoutGetTop(a), main(a, column), column ? YGNodeLayoutGetWidth(a) : YGNodeLayoutGetHeight(a), YGNodeLayoutGetLeft(b), YGNodeLayoutGetTop(b), main(b, column), column ? YGNodeLayoutGetWidth(b) : YGNodeLayoutGetHeight(b));
  YGNodeFreeRecursive(root); YGConfigFree(config);
}
struct ColumnProviderCall { int count = 0; float width = 0; float height = 0; YGMeasureMode widthMode = YGMeasureModeUndefined; YGMeasureMode heightMode = YGMeasureModeUndefined; } columnProviderCall;
const char* measureMode(YGMeasureMode value) {
  return value == YGMeasureModeExactly ? "exact" : value == YGMeasureModeAtMost ? "at-most" : "undefined";
}
float columnProviderNatural = 40;
YGSize measureColumnProvider(YGNodeConstRef, float width, YGMeasureMode widthMode, float height, YGMeasureMode heightMode) {
  columnProviderCall = {columnProviderCall.count + 1, width, height, widthMode, heightMode};
  return { columnProviderNatural, 40 };
}
// Direct measured A has an explicit main height40 and automatic cross width in
// a finite 200×120 LTR column. This records Yoga's actual callback envelope,
// which may differ from Pibbl's explicit unbounded-width provider contract.
void runColumnProvider(float natural) {
  auto config = YGConfigNew();
  YGConfigSetUseWebDefaults(config, false);
  YGConfigSetPointScaleFactor(config, 0);
  YGConfigSetErrata(config, YGErrataNone);
  auto root = YGNodeNewWithConfig(config);
  auto a = YGNodeNewWithConfig(config);
  auto b = YGNodeNewWithConfig(config);
  YGNodeStyleSetFlexDirection(root, YGFlexDirectionColumn);
  YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
  YGNodeStyleSetWidth(root, 200); YGNodeStyleSetHeight(root, 120);
  for (auto child : {a, b}) { YGNodeStyleSetFlexGrow(child, 0); YGNodeStyleSetFlexShrink(child, 0); YGNodeStyleSetMinWidth(child, 0); YGNodeStyleSetMinHeight(child, 0); }
  YGNodeStyleSetHeight(a, 40); YGNodeStyleSetFlexBasisAuto(a); YGNodeStyleSetMarginAuto(a, YGEdgeLeft); YGNodeSetMeasureFunc(a, measureColumnProvider);
  YGNodeStyleSetWidth(b, 20); YGNodeStyleSetHeight(b, 80); YGNodeStyleSetFlexBasis(b, 80);
  columnProviderNatural = natural; columnProviderCall = {};
  YGNodeInsertChild(root, a, 0); YGNodeInsertChild(root, b, 1);
  YGNodeCalculateLayout(root, 200, 120, YGDirectionLTR);
  std::printf("intrinsic-auto-column-provider natural=%.17g root={width:%.17g,height:%.17g} A={left:%.17g,top:%.17g,width:%.17g,height:%.17g} B={left:%.17g,top:%.17g,width:%.17g,height:%.17g} query={count:%d,width:%.17g,widthMode:%s,height:%.17g,heightMode:%s}\n",
    natural, YGNodeLayoutGetWidth(root), YGNodeLayoutGetHeight(root), YGNodeLayoutGetLeft(a), YGNodeLayoutGetTop(a), YGNodeLayoutGetWidth(a), YGNodeLayoutGetHeight(a), YGNodeLayoutGetLeft(b), YGNodeLayoutGetTop(b), YGNodeLayoutGetWidth(b), YGNodeLayoutGetHeight(b), columnProviderCall.count, columnProviderCall.width, measureMode(columnProviderCall.widthMode), columnProviderCall.height, measureMode(columnProviderCall.heightMode));
  YGNodeFreeRecursive(root); YGConfigFree(config);
}
}
int main() {
  for (bool column : { false, true }) for (bool bothAuto : { false, true }) {
    run(column, true, OwnerBound::None, bothAuto);
    run(column, true, OwnerBound::Max160, bothAuto);
    run(column, true, OwnerBound::Min200, bothAuto);
    run(column, false, OwnerBound::None, bothAuto);
    run(column, false, OwnerBound::Max160, bothAuto);
    run(column, false, OwnerBound::Min200, bothAuto);
  }
  for (bool column : { false, true }) for (auto profile : { CrossProfile::Start, CrossProfile::Both, CrossProfile::Overflow, CrossProfile::Opposite10 }) runCrossAuto(column, profile);
  for (bool column : { false, true }) for (auto direction : { YGDirectionLTR, YGDirectionRTL }) for (auto profile : { ShorthandProfile::AllAuto, ShorthandProfile::PhysicalLeft0, ShorthandProfile::LogicalStartAuto }) runShorthand(column, direction, profile);
  runColumnProvider(40); runColumnProvider(80); runColumnProvider(240);
}
