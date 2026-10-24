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
// Synthetic wrapped generic Text for the proposed Pibbl column profile.
// This is a geometric callback provenance probe, not a font-parity claim.
struct ColumnTextCall { int count = 0; float width = 0; float height = 0; YGMeasureMode widthMode = YGMeasureModeUndefined; YGMeasureMode heightMode = YGMeasureModeUndefined; } columnTextCall;
float columnTextAdvance = 60;
bool columnTextLongWord = false;
YGSize measureColumnText(YGNodeConstRef, float width, YGMeasureMode widthMode, float height, YGMeasureMode heightMode) {
  columnTextCall = {columnTextCall.count + 1, width, height, widthMode, heightMode};
  const float used = !columnTextLongWord && widthMode == YGMeasureModeAtMost ? (columnTextAdvance < width ? columnTextAdvance : width) : columnTextAdvance;
  return { used, 40 };
}
const char* textMarginName(int profile) { return profile == 0 ? "none" : profile == 1 ? "left-auto" : "both-auto"; }
void runColumnText(float ownerWidth, float advance, int marginProfile, bool longWord) {
  auto config = YGConfigNew();
  YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
  auto root = YGNodeNewWithConfig(config); auto text = YGNodeNewWithConfig(config); auto b = YGNodeNewWithConfig(config);
  YGNodeStyleSetFlexDirection(root, YGFlexDirectionColumn); YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
  YGNodeStyleSetWidth(root, ownerWidth); YGNodeStyleSetHeight(root, 120);
  YGNodeStyleSetHeight(text, 40); YGNodeStyleSetFlexBasisAuto(text); YGNodeStyleSetFlexGrow(text, 0); YGNodeStyleSetFlexShrink(text, 0);
  YGNodeStyleSetMinWidth(text, 0); YGNodeStyleSetMinHeight(text, 0);
  if (marginProfile >= 1) YGNodeStyleSetMarginAuto(text, YGEdgeLeft); if (marginProfile == 2) YGNodeStyleSetMarginAuto(text, YGEdgeRight);
  YGNodeSetMeasureFunc(text, measureColumnText);
  YGNodeStyleSetWidth(b, 20); YGNodeStyleSetHeight(b, 80); YGNodeStyleSetFlexBasis(b, 80); YGNodeStyleSetFlexGrow(b, 0); YGNodeStyleSetFlexShrink(b, 0); YGNodeStyleSetMinWidth(b, 0); YGNodeStyleSetMinHeight(b, 0);
  columnTextAdvance = advance; columnTextLongWord = longWord; columnTextCall = {};
  YGNodeInsertChild(root, text, 0); YGNodeInsertChild(root, b, 1); YGNodeCalculateLayout(root, ownerWidth, 120, YGDirectionLTR);
  std::printf("intrinsic-auto-column-text owner=%.17g advance=%.17g margin=%s longWord=%s root={width:%.17g,height:%.17g} Text={left:%.17g,top:%.17g,width:%.17g,height:%.17g} B={left:%.17g,top:%.17g,width:%.17g,height:%.17g} query={count:%d,width:%.17g,widthMode:%s,height:%.17g,heightMode:%s}\n", ownerWidth, advance, textMarginName(marginProfile), longWord ? "true" : "false", YGNodeLayoutGetWidth(root), YGNodeLayoutGetHeight(root), YGNodeLayoutGetLeft(text), YGNodeLayoutGetTop(text), YGNodeLayoutGetWidth(text), YGNodeLayoutGetHeight(text), YGNodeLayoutGetLeft(b), YGNodeLayoutGetTop(b), YGNodeLayoutGetWidth(b), YGNodeLayoutGetHeight(b), columnTextCall.count, columnTextCall.width, measureMode(columnTextCall.widthMode), columnTextCall.height, measureMode(columnTextCall.heightMode));
  YGNodeFreeRecursive(root); YGConfigFree(config);
}

// A direct known row Flex with automatic width is a non-provider counterpart
// to the paired provider column profile. Its children are fixed numeric leaves.
void runKnownColumn(float firstWidth) {
  auto config = YGConfigNew();
  YGConfigSetUseWebDefaults(config, false);
  YGConfigSetPointScaleFactor(config, 0);
  YGConfigSetErrata(config, YGErrataNone);
  auto root = YGNodeNewWithConfig(config);
  auto known = YGNodeNewWithConfig(config);
  auto a = YGNodeNewWithConfig(config);
  auto b = YGNodeNewWithConfig(config);
  auto following = YGNodeNewWithConfig(config);
  YGNodeStyleSetFlexDirection(root, YGFlexDirectionColumn);
  YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
  YGNodeStyleSetWidth(root, 200); YGNodeStyleSetHeight(root, 120);
  YGNodeStyleSetFlexDirection(known, YGFlexDirectionRow);
  YGNodeStyleSetAlignItems(known, YGAlignFlexStart);
  YGNodeStyleSetHeight(known, 40); YGNodeStyleSetMinHeight(known, 0);
  YGNodeStyleSetFlexBasisAuto(known); YGNodeStyleSetFlexGrow(known, 0); YGNodeStyleSetFlexShrink(known, 0);
  YGNodeStyleSetMarginAuto(known, YGEdgeLeft);
  for (auto child : {a, b, following}) { YGNodeStyleSetFlexGrow(child, 0); YGNodeStyleSetFlexShrink(child, 0); YGNodeStyleSetMinWidth(child, 0); YGNodeStyleSetMinHeight(child, 0); }
  YGNodeStyleSetWidth(a, firstWidth); YGNodeStyleSetHeight(a, 40); YGNodeStyleSetFlexBasis(a, firstWidth);
  YGNodeStyleSetWidth(b, 20); YGNodeStyleSetHeight(b, 20); YGNodeStyleSetFlexBasis(b, 20);
  YGNodeStyleSetWidth(following, 20); YGNodeStyleSetHeight(following, 80); YGNodeStyleSetFlexBasis(following, 80);
  YGNodeInsertChild(known, a, 0); YGNodeInsertChild(known, b, 1); YGNodeInsertChild(root, known, 0); YGNodeInsertChild(root, following, 1);
  YGNodeCalculateLayout(root, 200, 120, YGDirectionLTR);
  std::printf("intrinsic-auto-column-known first=%.17g root={width:%.17g,height:%.17g} known={left:%.17g,top:%.17g,width:%.17g,height:%.17g} A={left:%.17g,top:%.17g,width:%.17g,height:%.17g} B={left:%.17g,top:%.17g,width:%.17g,height:%.17g} following={left:%.17g,top:%.17g,width:%.17g,height:%.17g}\n",
    firstWidth, YGNodeLayoutGetWidth(root), YGNodeLayoutGetHeight(root), YGNodeLayoutGetLeft(known), YGNodeLayoutGetTop(known), YGNodeLayoutGetWidth(known), YGNodeLayoutGetHeight(known), YGNodeLayoutGetLeft(a), YGNodeLayoutGetTop(a), YGNodeLayoutGetWidth(a), YGNodeLayoutGetHeight(a), YGNodeLayoutGetLeft(b), YGNodeLayoutGetTop(b), YGNodeLayoutGetWidth(b), YGNodeLayoutGetHeight(b), YGNodeLayoutGetLeft(following), YGNodeLayoutGetTop(following), YGNodeLayoutGetWidth(following), YGNodeLayoutGetHeight(following));
  YGNodeFreeRecursive(root); YGConfigFree(config);
}


// Synthetic wrapped row Text. The callback is deliberately geometric: it
// models a natural 84px run and a 10px/20px final height transition without
// asserting platform font parity. Yoga receives an at-most width envelope;
// Pibbl passes its natural run and word floor through native line formation,
// then queries the settled target width. Yoga's envelope is recorded separately.
struct RowWrappedTextCall { int count = 0; float width = 0; float height = 0; YGMeasureMode widthMode = YGMeasureModeUndefined; YGMeasureMode heightMode = YGMeasureModeUndefined; } rowWrappedTextCall;
YGSize measureRowWrappedText(YGNodeConstRef, float width, YGMeasureMode widthMode, float height, YGMeasureMode heightMode) {
  rowWrappedTextCall = {rowWrappedTextCall.count + 1, width, height, widthMode, heightMode};
  const float natural = 84;
  const float used = widthMode == YGMeasureModeAtMost ? (natural < width ? natural : width) : natural;
  return { used, used < natural ? 20.0f : 10.0f };
}
void runRowWrappedText(float ownerWidth, bool autoTop) {
  auto config = YGConfigNew();
  YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
  auto root = YGNodeNewWithConfig(config), text = YGNodeNewWithConfig(config), peer = YGNodeNewWithConfig(config), following = YGNodeNewWithConfig(config);
  YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow); YGNodeStyleSetFlexWrap(root, YGWrapWrap);
  YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetAlignContent(root, YGAlignFlexStart);
  YGNodeStyleSetWidth(root, ownerWidth); YGNodeStyleSetHeight(root, 140); YGNodeStyleSetGap(root, YGGutterAll, 10);
  for (auto child : {text, peer, following}) { YGNodeStyleSetFlexGrow(child, 0); YGNodeStyleSetFlexShrink(child, 1); YGNodeStyleSetMinWidth(child, 0); YGNodeStyleSetMinHeight(child, 0); }
  YGNodeStyleSetMinWidth(text, 24); if (autoTop) YGNodeStyleSetMarginAuto(text, YGEdgeTop); YGNodeSetMeasureFunc(text, measureRowWrappedText);
  YGNodeStyleSetWidth(peer, 60); YGNodeStyleSetHeight(peer, 40); YGNodeStyleSetFlexBasis(peer, 60);
  YGNodeStyleSetWidth(following, 80); YGNodeStyleSetHeight(following, 20); YGNodeStyleSetFlexBasis(following, 80);
  rowWrappedTextCall = {};
  YGNodeInsertChild(root, text, 0); YGNodeInsertChild(root, peer, 1); YGNodeInsertChild(root, following, 2);
  YGNodeCalculateLayout(root, ownerWidth, 140, YGDirectionLTR);
  std::printf("intrinsic-auto-row-wrapped-text owner=%.17g autoTop=%s model=synthetic-not-font-parity root={width:%.17g,height:%.17g} Text={left:%.17g,top:%.17g,width:%.17g,height:%.17g} B={left:%.17g,top:%.17g,width:%.17g,height:%.17g} C={left:%.17g,top:%.17g,width:%.17g,height:%.17g} query={count:%d,width:%.17g,widthMode:%s,height:%.17g,heightMode:%s}\n",
    ownerWidth, autoTop ? "true" : "false", YGNodeLayoutGetWidth(root), YGNodeLayoutGetHeight(root), YGNodeLayoutGetLeft(text), YGNodeLayoutGetTop(text), YGNodeLayoutGetWidth(text), YGNodeLayoutGetHeight(text), YGNodeLayoutGetLeft(peer), YGNodeLayoutGetTop(peer), YGNodeLayoutGetWidth(peer), YGNodeLayoutGetHeight(peer), YGNodeLayoutGetLeft(following), YGNodeLayoutGetTop(following), YGNodeLayoutGetWidth(following), YGNodeLayoutGetHeight(following), rowWrappedTextCall.count, rowWrappedTextCall.width, measureMode(rowWrappedTextCall.widthMode), rowWrappedTextCall.height, measureMode(rowWrappedTextCall.heightMode));
  YGNodeFreeRecursive(root); YGConfigFree(config);
}

// These cases cover the finite cross sizes newly admitted by Slice 180. They
// deliberately compare margin-top:0 to auto: sizing must be identical and
// only the final cross placement may move.
enum class ResolvedCrossProfile { Aspect, PercentSize, PercentMin };
const char* resolvedCrossName(ResolvedCrossProfile value) {
  switch (value) {
    case ResolvedCrossProfile::Aspect: return "aspect";
    case ResolvedCrossProfile::PercentSize: return "height-50pct";
    case ResolvedCrossProfile::PercentMin: return "min-height-50pct";
  }
  return "invalid";
}
void runResolvedCross(float ownerHeight, ResolvedCrossProfile profile, bool autoTop) {
  auto config = YGConfigNew();
  YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
  auto root = YGNodeNewWithConfig(config); auto a = YGNodeNewWithConfig(config);
  YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow); YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
  YGNodeStyleSetWidth(root, 100); YGNodeStyleSetHeight(root, ownerHeight);
  YGNodeStyleSetWidth(a, 40); YGNodeStyleSetFlexBasis(a, 40); YGNodeStyleSetFlexGrow(a, 0); YGNodeStyleSetFlexShrink(a, 0);
  YGNodeStyleSetMinWidth(a, 0); YGNodeStyleSetMinHeight(a, 0);
  if (profile == ResolvedCrossProfile::Aspect) YGNodeStyleSetAspectRatio(a, 2);
  if (profile == ResolvedCrossProfile::PercentSize) YGNodeStyleSetHeightPercent(a, 50);
  if (profile == ResolvedCrossProfile::PercentMin) { YGNodeStyleSetHeight(a, 20); YGNodeStyleSetMinHeightPercent(a, 50); }
  if (autoTop) YGNodeStyleSetMarginAuto(a, YGEdgeTop); else YGNodeStyleSetMargin(a, YGEdgeTop, 0);
  YGNodeInsertChild(root, a, 0); YGNodeCalculateLayout(root, 100, ownerHeight, YGDirectionLTR);
  std::printf("intrinsic-auto-resolved-cross ownerHeight=%.17g profile=%s marginTop=%s root={width:%.17g,height:%.17g} A={left:%.17g,top:%.17g,width:%.17g,height:%.17g}\n",
    ownerHeight, resolvedCrossName(profile), autoTop ? "auto" : "0", YGNodeLayoutGetWidth(root), YGNodeLayoutGetHeight(root), YGNodeLayoutGetLeft(a), YGNodeLayoutGetTop(a), YGNodeLayoutGetWidth(a), YGNodeLayoutGetHeight(a));
  YGNodeFreeRecursive(root); YGConfigFree(config);
}


// Slice 181: direct measured Text-width geometry in the remaining finite
// column direction variants. The callback is deliberately synthetic, so this
// reports Yoga's query envelope and physical placement without font parity.
struct ColumnDirectionTextCall { int count = 0; float width = 0; float height = 0; YGMeasureMode widthMode = YGMeasureModeUndefined; YGMeasureMode heightMode = YGMeasureModeUndefined; } columnDirectionTextCall;
YGSize measureColumnDirectionText(YGNodeConstRef, float width, YGMeasureMode widthMode, float height, YGMeasureMode heightMode) {
  columnDirectionTextCall = {columnDirectionTextCall.count + 1, width, height, widthMode, heightMode};
  return {30, 40};
}
const char* directionName(YGFlexDirection direction) {
  return direction == YGFlexDirectionColumnReverse ? "column-reverse" : "column";
}
void runColumnDirectionText(YGFlexDirection direction, YGDirection layoutDirection, bool autoLeft) {
  auto config = YGConfigNew();
  YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
  auto root = YGNodeNewWithConfig(config); auto text = YGNodeNewWithConfig(config); auto peer = YGNodeNewWithConfig(config);
  YGNodeStyleSetFlexDirection(root, direction); YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
  YGNodeStyleSetWidth(root, 200); YGNodeStyleSetHeight(root, 120);
  YGNodeStyleSetHeight(text, 40); YGNodeStyleSetFlexBasisAuto(text); YGNodeStyleSetFlexGrow(text, 0); YGNodeStyleSetFlexShrink(text, 0);
  YGNodeStyleSetMinWidth(text, 0); YGNodeStyleSetMinHeight(text, 0);
  if (autoLeft) YGNodeStyleSetMarginAuto(text, YGEdgeLeft); else YGNodeStyleSetMargin(text, YGEdgeLeft, 0);
  YGNodeSetMeasureFunc(text, measureColumnDirectionText);
  YGNodeStyleSetWidth(peer, 20); YGNodeStyleSetHeight(peer, 80); YGNodeStyleSetFlexBasis(peer, 80);
  YGNodeStyleSetFlexGrow(peer, 0); YGNodeStyleSetFlexShrink(peer, 0); YGNodeStyleSetMinWidth(peer, 0); YGNodeStyleSetMinHeight(peer, 0);
  columnDirectionTextCall = {};
  YGNodeInsertChild(root, text, 0); YGNodeInsertChild(root, peer, 1);
  YGNodeCalculateLayout(root, 200, 120, layoutDirection);
  std::printf("intrinsic-auto-column-direction-text direction=%s layoutDirection=%s marginLeft=%s model=synthetic-not-font-parity root={width:%.17g,height:%.17g} Text={left:%.17g,top:%.17g,width:%.17g,height:%.17g} B={left:%.17g,top:%.17g,width:%.17g,height:%.17g} query={count:%d,width:%.17g,widthMode:%s,height:%.17g,heightMode:%s}\n",
    directionName(direction), layoutDirection == YGDirectionRTL ? "rtl" : "ltr", autoLeft ? "auto" : "0", YGNodeLayoutGetWidth(root), YGNodeLayoutGetHeight(root), YGNodeLayoutGetLeft(text), YGNodeLayoutGetTop(text), YGNodeLayoutGetWidth(text), YGNodeLayoutGetHeight(text), YGNodeLayoutGetLeft(peer), YGNodeLayoutGetTop(peer), YGNodeLayoutGetWidth(peer), YGNodeLayoutGetHeight(peer), columnDirectionTextCall.count, columnDirectionTextCall.width, measureMode(columnDirectionTextCall.widthMode), columnDirectionTextCall.height, measureMode(columnDirectionTextCall.heightMode));
  YGNodeFreeRecursive(root); YGConfigFree(config);
}


// Slice 182 records finite generic-Text geometry with flexible main sizing.
// The callback is intentionally synthetic. Its query envelope is provenance,
// not a claim that platform font metrics agree with Yoga.
struct SharedTextCall { int count = 0; float width = 0; float height = 0; YGMeasureMode widthMode = YGMeasureModeUndefined; YGMeasureMode heightMode = YGMeasureModeUndefined; } sharedTextCall;
YGSize measureSharedText(YGNodeConstRef, float width, YGMeasureMode widthMode, float height, YGMeasureMode heightMode) {
  sharedTextCall = {sharedTextCall.count + 1, width, height, widthMode, heightMode};
  const float used = widthMode != YGMeasureModeUndefined && width < 84 ? width : 84;
  return {used, used < 84 ? 40.0f : 20.0f};
}
enum class RowFlexibleProfile { Grow, Shrink, Min, Max };
const char* rowFlexibleName(RowFlexibleProfile profile) {
  switch (profile) { case RowFlexibleProfile::Grow: return "grow"; case RowFlexibleProfile::Shrink: return "shrink"; case RowFlexibleProfile::Min: return "min70"; case RowFlexibleProfile::Max: return "max60"; }
  return "invalid";
}
void runRowFlexibleText(RowFlexibleProfile profile, bool autoTop) {
  auto config = YGConfigNew();
  YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
  const float ownerWidth = profile == RowFlexibleProfile::Grow || profile == RowFlexibleProfile::Max ? 180 : 100;
  auto root = YGNodeNewWithConfig(config), text = YGNodeNewWithConfig(config), peer = YGNodeNewWithConfig(config);
  YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow); YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetWidth(root, ownerWidth); YGNodeStyleSetHeight(root, 80);
  YGNodeStyleSetFlexGrow(text, profile == RowFlexibleProfile::Grow || profile == RowFlexibleProfile::Max ? 1 : 0); YGNodeStyleSetFlexShrink(text, profile == RowFlexibleProfile::Grow ? 0 : 1); YGNodeStyleSetMinWidth(text, profile == RowFlexibleProfile::Min ? 70 : 0); if (profile == RowFlexibleProfile::Max) YGNodeStyleSetMaxWidth(text, 60); if (autoTop) YGNodeStyleSetMarginAuto(text, YGEdgeTop); else YGNodeStyleSetMargin(text, YGEdgeTop, 0); YGNodeSetMeasureFunc(text, measureSharedText);
  YGNodeStyleSetWidth(peer, 60); YGNodeStyleSetHeight(peer, 40); YGNodeStyleSetFlexBasis(peer, 60); YGNodeStyleSetFlexGrow(peer, 0); YGNodeStyleSetFlexShrink(peer, 0); YGNodeStyleSetMinWidth(peer, 0); YGNodeStyleSetMinHeight(peer, 0);
  sharedTextCall = {}; YGNodeInsertChild(root, text, 0); YGNodeInsertChild(root, peer, 1); YGNodeCalculateLayout(root, ownerWidth, 80, YGDirectionLTR);
  std::printf("intrinsic-auto-row-flexible-text profile=%s marginTop=%s model=synthetic-not-font-parity root={width:%.17g,height:%.17g} Text={left:%.17g,top:%.17g,width:%.17g,height:%.17g} B={left:%.17g,top:%.17g,width:%.17g,height:%.17g} query={count:%d,width:%.17g,widthMode:%s,height:%.17g,heightMode:%s}\n", rowFlexibleName(profile), autoTop ? "auto" : "0", YGNodeLayoutGetWidth(root), YGNodeLayoutGetHeight(root), YGNodeLayoutGetLeft(text), YGNodeLayoutGetTop(text), YGNodeLayoutGetWidth(text), YGNodeLayoutGetHeight(text), YGNodeLayoutGetLeft(peer), YGNodeLayoutGetTop(peer), YGNodeLayoutGetWidth(peer), YGNodeLayoutGetHeight(peer), sharedTextCall.count, sharedTextCall.width, measureMode(sharedTextCall.widthMode), sharedTextCall.height, measureMode(sharedTextCall.heightMode));
  YGNodeFreeRecursive(root); YGConfigFree(config);
}
void runColumnBasisAutoHeight(bool autoLeft) {
  auto config = YGConfigNew();
  YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
  auto root = YGNodeNewWithConfig(config), text = YGNodeNewWithConfig(config), peer = YGNodeNewWithConfig(config);
  YGNodeStyleSetFlexDirection(root, YGFlexDirectionColumn); YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetWidth(root, 200); YGNodeStyleSetHeight(root, 120);
  YGNodeStyleSetFlexBasis(text, 40); YGNodeStyleSetFlexGrow(text, 0); YGNodeStyleSetFlexShrink(text, 0); YGNodeStyleSetMinWidth(text, 0); YGNodeStyleSetMinHeight(text, 0); if (autoLeft) YGNodeStyleSetMarginAuto(text, YGEdgeLeft); else YGNodeStyleSetMargin(text, YGEdgeLeft, 0); YGNodeSetMeasureFunc(text, measureSharedText);
  YGNodeStyleSetWidth(peer, 20); YGNodeStyleSetHeight(peer, 80); YGNodeStyleSetFlexBasis(peer, 80); YGNodeStyleSetFlexGrow(peer, 0); YGNodeStyleSetFlexShrink(peer, 0); YGNodeStyleSetMinWidth(peer, 0); YGNodeStyleSetMinHeight(peer, 0);
  sharedTextCall = {}; YGNodeInsertChild(root, text, 0); YGNodeInsertChild(root, peer, 1); YGNodeCalculateLayout(root, 200, 120, YGDirectionLTR);
  std::printf("intrinsic-auto-column-basis-auto-height marginLeft=%s model=synthetic-not-font-parity root={width:%.17g,height:%.17g} Text={left:%.17g,top:%.17g,width:%.17g,height:%.17g} B={left:%.17g,top:%.17g,width:%.17g,height:%.17g} query={count:%d,width:%.17g,widthMode:%s,height:%.17g,heightMode:%s}\n", autoLeft ? "auto" : "0", YGNodeLayoutGetWidth(root), YGNodeLayoutGetHeight(root), YGNodeLayoutGetLeft(text), YGNodeLayoutGetTop(text), YGNodeLayoutGetWidth(text), YGNodeLayoutGetHeight(text), YGNodeLayoutGetLeft(peer), YGNodeLayoutGetTop(peer), YGNodeLayoutGetWidth(peer), YGNodeLayoutGetHeight(peer), sharedTextCall.count, sharedTextCall.width, measureMode(sharedTextCall.widthMode), sharedTextCall.height, measureMode(sharedTextCall.heightMode));
  YGNodeFreeRecursive(root); YGConfigFree(config);
}
void runWrappedReverseRtlText(bool autoTop) {
  auto config = YGConfigNew();
  YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
  auto root = YGNodeNewWithConfig(config), text = YGNodeNewWithConfig(config), peer = YGNodeNewWithConfig(config), following = YGNodeNewWithConfig(config);
  YGNodeStyleSetFlexDirection(root, YGFlexDirectionRowReverse); YGNodeStyleSetFlexWrap(root, YGWrapWrapReverse); YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetAlignContent(root, YGAlignFlexStart); YGNodeStyleSetWidth(root, 100); YGNodeStyleSetHeight(root, 120); YGNodeStyleSetGap(root, YGGutterAll, 10);
  YGNodeStyleSetFlexGrow(text, 0); YGNodeStyleSetFlexShrink(text, 1); YGNodeStyleSetMinWidth(text, 24); YGNodeStyleSetMinHeight(text, 0); if (autoTop) YGNodeStyleSetMarginAuto(text, YGEdgeTop); else YGNodeStyleSetMargin(text, YGEdgeTop, 0); YGNodeSetMeasureFunc(text, measureSharedText);
  for (auto child : {peer, following}) { YGNodeStyleSetFlexGrow(child, 0); YGNodeStyleSetFlexShrink(child, 0); YGNodeStyleSetMinWidth(child, 0); YGNodeStyleSetMinHeight(child, 0); }
  YGNodeStyleSetWidth(peer, 60); YGNodeStyleSetHeight(peer, 40); YGNodeStyleSetFlexBasis(peer, 60); YGNodeStyleSetWidth(following, 80); YGNodeStyleSetHeight(following, 20); YGNodeStyleSetFlexBasis(following, 80);
  sharedTextCall = {}; YGNodeInsertChild(root, text, 0); YGNodeInsertChild(root, peer, 1); YGNodeInsertChild(root, following, 2); YGNodeCalculateLayout(root, 100, 120, YGDirectionRTL);
  std::printf("intrinsic-auto-row-wrap-reverse-rtl-text marginTop=%s model=synthetic-not-font-parity root={width:%.17g,height:%.17g} Text={left:%.17g,top:%.17g,width:%.17g,height:%.17g} B={left:%.17g,top:%.17g,width:%.17g,height:%.17g} C={left:%.17g,top:%.17g,width:%.17g,height:%.17g} query={count:%d,width:%.17g,widthMode:%s,height:%.17g,heightMode:%s}\n", autoTop ? "auto" : "0", YGNodeLayoutGetWidth(root), YGNodeLayoutGetHeight(root), YGNodeLayoutGetLeft(text), YGNodeLayoutGetTop(text), YGNodeLayoutGetWidth(text), YGNodeLayoutGetHeight(text), YGNodeLayoutGetLeft(peer), YGNodeLayoutGetTop(peer), YGNodeLayoutGetWidth(peer), YGNodeLayoutGetHeight(peer), YGNodeLayoutGetLeft(following), YGNodeLayoutGetTop(following), YGNodeLayoutGetWidth(following), YGNodeLayoutGetHeight(following), sharedTextCall.count, sharedTextCall.width, measureMode(sharedTextCall.widthMode), sharedTextCall.height, measureMode(sharedTextCall.heightMode));
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
  runKnownColumn(40); runKnownColumn(80); runKnownColumn(220);
  runColumnText(200, 60, 0, false); runColumnText(200, 60, 1, false); runColumnText(200, 60, 2, false);
  runColumnText(160, 60, 1, false); runColumnText(200, 260, 1, false); runColumnText(160, 260, 1, false);
  runColumnText(200, 260, 1, true);
  for (auto width : {180.0f, 100.0f, 70.0f, 16.0f}) for (auto autoTop : {false, true}) runRowWrappedText(width, autoTop);
  for (auto direction : { YGFlexDirectionColumn, YGFlexDirectionColumnReverse }) for (auto layoutDirection : { YGDirectionLTR, YGDirectionRTL }) for (auto autoLeft : {false, true}) runColumnDirectionText(direction, layoutDirection, autoLeft);
  for (auto ownerHeight : {100.0f, 80.0f}) for (auto profile : { ResolvedCrossProfile::Aspect, ResolvedCrossProfile::PercentSize, ResolvedCrossProfile::PercentMin }) for (auto autoTop : {false, true}) runResolvedCross(ownerHeight, profile, autoTop);
  for (auto profile : { RowFlexibleProfile::Grow, RowFlexibleProfile::Shrink, RowFlexibleProfile::Min, RowFlexibleProfile::Max }) for (auto autoTop : {false, true}) runRowFlexibleText(profile, autoTop);
  for (auto autoLeft : {false, true}) runColumnBasisAutoHeight(autoLeft);
  for (auto autoTop : {false, true}) runWrappedReverseRtlText(autoTop);
}
