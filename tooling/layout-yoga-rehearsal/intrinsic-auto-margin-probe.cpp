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
}
