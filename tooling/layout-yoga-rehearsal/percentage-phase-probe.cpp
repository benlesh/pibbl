#include <yoga/Yoga.h>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <initializer_list>
#include <cstdint>

namespace {
bool currentColumn = false;
float currentNaturalMain = 80;
struct Call { int calls = 0; float w = NAN; float h = NAN; YGMeasureMode wm = YGMeasureModeUndefined; YGMeasureMode hm = YGMeasureModeUndefined; } calls;
const char* mode(YGMeasureMode value) { return value == YGMeasureModeExactly ? "exact" : value == YGMeasureModeAtMost ? "at-most" : "undefined"; }
YGSize measure(YGNodeConstRef, float w, YGMeasureMode wm, float h, YGMeasureMode hm) {
  calls.calls++; calls.w=w; calls.h=h; calls.wm=wm; calls.hm=hm;
  return currentColumn ? YGSize{20,currentNaturalMain} : YGSize{currentNaturalMain,20};
}
enum Owner { Exact, RootMax, External, Unbounded, RootMin, RootMinMax };
const char* ownerName(Owner v) { switch(v) { case Exact:return "style-exact160";case RootMax:return "style-max160";case External:return "external-exact160";case Unbounded:return "unbounded";case RootMin:return "style-min160";case RootMinMax:return "style-minmax160"; } return "?"; }
void configure(YGNodeRef root, bool column, Owner owner) {
  YGNodeStyleSetFlexDirection(root, column ? YGFlexDirectionColumn : YGFlexDirectionRow);
  YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
  if (owner == Exact) { if(column) YGNodeStyleSetHeight(root,160); else YGNodeStyleSetWidth(root,160); }
  if (owner == RootMax || owner == RootMinMax) { if(column) YGNodeStyleSetMaxHeight(root,160); else YGNodeStyleSetMaxWidth(root,160); }
  if (owner == RootMin || owner == RootMinMax) { if(column) YGNodeStyleSetMinHeight(root,160); else YGNodeStyleSetMinWidth(root,160); }
}
void setMain(YGNodeRef node, bool column, float value) { if(column) YGNodeStyleSetHeight(node,value); else YGNodeStyleSetWidth(node,value); }
void setCross(YGNodeRef node, bool column, float value) { if(column) YGNodeStyleSetWidth(node,value); else YGNodeStyleSetHeight(node,value); }
void setBasis(YGNodeRef node, bool column, float value) { (void)column; YGNodeStyleSetFlexBasis(node,value); }
void setMinPct(YGNodeRef node,bool column,float p) { if(column)YGNodeStyleSetMinHeightPercent(node,p);else YGNodeStyleSetMinWidthPercent(node,p); }
void setMaxPct(YGNodeRef node,bool column,float p) { if(column)YGNodeStyleSetMaxHeightPercent(node,p);else YGNodeStyleSetMaxWidthPercent(node,p); }
struct NestedCall { float w; YGMeasureMode wm; float h; YGMeasureMode hm; };
static NestedCall nestedCalls[8];
static int nestedCallCount;
YGSize measureNestedLeaf(YGNodeConstRef, float w, YGMeasureMode wm, float h, YGMeasureMode hm) {
  nestedCalls[nestedCallCount++] = { w, wm, h, hm };
  return currentColumn ? YGSize{20, 40} : YGSize{40, 20};
}
void runNestedKnownPercentOwner(bool column, const char* owner, float availableMain) {
  currentColumn = column;
  auto config = YGConfigNew();
  YGConfigSetUseWebDefaults(config, false);
  YGConfigSetPointScaleFactor(config, 0);
  YGConfigSetErrata(config, YGErrataNone);
  auto outer = YGNodeNewWithConfig(config);
  auto inner = YGNodeNewWithConfig(config);
  auto leaf = YGNodeNewWithConfig(config);
  const auto direction = column ? YGFlexDirectionColumn : YGFlexDirectionRow;
  YGNodeStyleSetFlexDirection(outer, direction);
  YGNodeStyleSetAlignItems(outer, YGAlignFlexStart);
  setCross(outer, column, 20);
  YGNodeStyleSetFlexDirection(inner, direction);
  YGNodeStyleSetAlignItems(inner, YGAlignFlexStart);
  YGNodeStyleSetFlexGrow(inner, 0);
  YGNodeStyleSetFlexShrink(inner, 0);
  setCross(inner, column, 20);
  YGNodeStyleSetFlexGrow(leaf, 0);
  YGNodeStyleSetFlexShrink(leaf, 0);
  setCross(leaf, column, 20);
  setMinPct(leaf, column, 200);
  YGNodeSetMeasureFunc(leaf, measureNestedLeaf);
  YGNodeInsertChild(inner, leaf, 0);
  YGNodeInsertChild(outer, inner, 0);
  nestedCallCount = 0;
  YGNodeCalculateLayout(outer, column ? YGUndefined : availableMain,
    column ? availableMain : YGUndefined, YGDirectionLTR);
  const float outerMain = column ? YGNodeLayoutGetHeight(outer) : YGNodeLayoutGetWidth(outer);
  const float innerMain = column ? YGNodeLayoutGetHeight(inner) : YGNodeLayoutGetWidth(inner);
  const float leafMain = column ? YGNodeLayoutGetHeight(leaf) : YGNodeLayoutGetWidth(leaf);
  std::printf("nested-known-percent-owner axis=%s owner=%s availableMain=%.17g outer=%.17g inner=%.17g leaf=%.17g calls=%d\n",
    column ? "column" : "row", owner, availableMain, outerMain, innerMain, leafMain, nestedCallCount);
  for (int index = 0; index < nestedCallCount; index++) {
    const auto& call = nestedCalls[index];
    std::printf("  nested-query[%d]={width:%.17g,%s,height:%.17g,%s}\n", index,
      call.w, mode(call.wm), call.h, mode(call.hm));
  }
  YGNodeFreeRecursive(outer);
  YGConfigFree(config);
}

struct KnownOwnerCall { int leaf; float w; YGMeasureMode wm; float h; YGMeasureMode hm; };
static KnownOwnerCall knownOwnerCalls[16];
static int knownOwnerCallCount;
YGSize measureKnownOwnerLeaf(YGNodeConstRef node, float w, YGMeasureMode wm, float h, YGMeasureMode hm) {
  const auto leaf = static_cast<int>(reinterpret_cast<intptr_t>(YGNodeGetContext(node)));
  knownOwnerCalls[knownOwnerCallCount++] = { leaf, w, wm, h, hm };
  return currentColumn ? YGSize{20, 40} : YGSize{40, 20};
}
void configureKnownOwner(YGNodeRef node, bool column) {
  YGNodeStyleSetFlexDirection(node, column ? YGFlexDirectionColumn : YGFlexDirectionRow);
  YGNodeStyleSetAlignItems(node, YGAlignFlexStart);
  YGNodeStyleSetFlexGrow(node, 0);
  YGNodeStyleSetFlexShrink(node, 0);
  setCross(node, column, 20);
}
// `branches=1` is outer -> middle -> inner -> leaf. `branches=2` replaces the
// last inner owner with two source-order siblings. This remains a probe only;
// it has no reference.json or public-paint parity implication.
void runKnownOwnerTree(bool column, int branches, const char* availability, float available) {
  currentColumn = column;
  auto config = YGConfigNew();
  YGConfigSetUseWebDefaults(config, false);
  YGConfigSetPointScaleFactor(config, 0);
  YGConfigSetErrata(config, YGErrataNone);
  auto outer = YGNodeNewWithConfig(config);
  auto middle = YGNodeNewWithConfig(config);
  YGNodeRef inners[2] = {nullptr, nullptr};
  YGNodeRef leaves[2] = {nullptr, nullptr};
  configureKnownOwner(outer, column);
  configureKnownOwner(middle, column);
  for (int index = 0; index < branches; index++) {
    inners[index] = YGNodeNewWithConfig(config);
    leaves[index] = YGNodeNewWithConfig(config);
    configureKnownOwner(inners[index], column);
    YGNodeStyleSetFlexGrow(leaves[index], 0);
    YGNodeStyleSetFlexShrink(leaves[index], 0);
    setCross(leaves[index], column, 20);
    setMinPct(leaves[index], column, 200);
    YGNodeSetContext(leaves[index], reinterpret_cast<void*>(static_cast<intptr_t>(index)));
    YGNodeSetMeasureFunc(leaves[index], measureKnownOwnerLeaf);
    YGNodeInsertChild(inners[index], leaves[index], 0);
    YGNodeInsertChild(middle, inners[index], index);
  }
  YGNodeInsertChild(outer, middle, 0);
  knownOwnerCallCount = 0;
  YGNodeCalculateLayout(outer, column ? YGUndefined : available, column ? available : YGUndefined, YGDirectionLTR);
  std::printf("known-owner-tree axis=%s branches=%d availability=%s main={outer:%.17g,middle:%.17g",
    column ? "column" : "row", branches, availability,
    column ? YGNodeLayoutGetHeight(outer) : YGNodeLayoutGetWidth(outer),
    column ? YGNodeLayoutGetHeight(middle) : YGNodeLayoutGetWidth(middle));
  for (int index = 0; index < branches; index++) {
    const float inner = column ? YGNodeLayoutGetHeight(inners[index]) : YGNodeLayoutGetWidth(inners[index]);
    const float leaf = column ? YGNodeLayoutGetHeight(leaves[index]) : YGNodeLayoutGetWidth(leaves[index]);
    std::printf(",inner%d:%.17g,leaf%d:%.17g", index, inner, index, leaf);
  }
  std::printf("} calls=%d\n", knownOwnerCallCount);
  for (int index = 0; index < knownOwnerCallCount; index++) {
    const auto& call = knownOwnerCalls[index];
    std::printf("  known-owner-query[%d]=leaf%d{width:%.17g,%s,height:%.17g,%s}\n", index,
      call.leaf, call.w, mode(call.wm), call.h, mode(call.hm));
  }
  YGNodeFreeRecursive(outer);
  YGConfigFree(config);
}

void setOwnPercentBounds(YGNodeRef node, bool column, int profile) {
  if (profile == 0) setMinPct(node, column, 75);
  else if (profile == 1) { setMinPct(node, column, 50); setMaxPct(node, column, 75); }
  else setMaxPct(node, column, 75);
}
const char* ownPercentProfile(int profile) { return profile == 0 ? "min75" : profile == 1 ? "min50-max75" : "max75"; }
void configureOwnPercentChildren(YGNodeRef owner, YGNodeRef leaf, YGNodeRef sibling, bool column) {
  YGNodeStyleSetFlexDirection(owner, column ? YGFlexDirectionColumn : YGFlexDirectionRow);
  YGNodeStyleSetAlignItems(owner, YGAlignFlexStart);
  YGNodeStyleSetFlexGrow(owner, 0); YGNodeStyleSetFlexShrink(owner, 0); setCross(owner, column, 20);
  YGNodeStyleSetFlexGrow(leaf, 0); YGNodeStyleSetFlexShrink(leaf, 0); setCross(leaf, column, 20);
  if (column) YGNodeStyleSetMinHeight(leaf, 0); else YGNodeStyleSetMinWidth(leaf, 0);
  setMaxPct(leaf, column, 25); YGNodeSetMeasureFunc(leaf, measure);
  YGNodeStyleSetFlexGrow(sibling, 0); YGNodeStyleSetFlexShrink(sibling, 0); setCross(sibling, column, 20); setMain(sibling, column, 80); setBasis(sibling, column, 80);
  if (column) YGNodeStyleSetMinHeight(sibling, 0); else YGNodeStyleSetMinWidth(sibling, 0);
  YGNodeInsertChild(owner, leaf, 0); YGNodeInsertChild(owner, sibling, 1);
}
// Exact physical 200 parent on the opposite axis produces the public finite
// at-most child envelope. This is intentionally distinct from a root StretchFit call.
void runOppositeAxisOwnPercentOwner(bool column, int profile) {
  currentColumn = column; currentNaturalMain = 80; calls = {};
  auto config = YGConfigNew();
  YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
  auto outer = YGNodeNewWithConfig(config), owner = YGNodeNewWithConfig(config), leaf = YGNodeNewWithConfig(config), sibling = YGNodeNewWithConfig(config);
  YGNodeStyleSetFlexDirection(outer, column ? YGFlexDirectionRow : YGFlexDirectionColumn);
  YGNodeStyleSetAlignItems(outer, YGAlignFlexStart);
  if (column) { YGNodeStyleSetWidth(outer, 100); YGNodeStyleSetHeight(outer, 200); }
  else { YGNodeStyleSetWidth(outer, 200); YGNodeStyleSetHeight(outer, 100); }
  configureOwnPercentChildren(owner, leaf, sibling, column); setOwnPercentBounds(owner, column, profile);
  YGNodeInsertChild(outer, owner, 0);
  YGNodeCalculateLayout(outer, column ? 100 : 200, column ? 200 : 100, YGDirectionLTR);
  const float ownerMain = column ? YGNodeLayoutGetHeight(owner) : YGNodeLayoutGetWidth(owner);
  const float leafMain = column ? YGNodeLayoutGetHeight(leaf) : YGNodeLayoutGetWidth(leaf);
  const float siblingMain = column ? YGNodeLayoutGetHeight(sibling) : YGNodeLayoutGetWidth(sibling);
  std::printf("own-percent-opposite-parent axis=%s profile=%s owner=%.17g leaf=%.17g sibling=%.17g calls=%d", column ? "column" : "row", ownPercentProfile(profile), ownerMain, leafMain, siblingMain, calls.calls);
  if (calls.calls) std::printf(" query={main:%.17g,%s,cross:%.17g,%s}", column ? calls.h : calls.w, mode(column ? calls.hm : calls.wm), column ? calls.w : calls.h, mode(column ? calls.wm : calls.hm));
  std::puts("");
  YGNodeFreeRecursive(outer); YGConfigFree(config);
}
// Undefined root calls establish unresolved-own-bound query policy separately;
// they are not the finite parent/mounted evidence above.
void runUndefinedOwnPercentOwner(bool column, int profile) {
  currentColumn = column; currentNaturalMain = 80; calls = {};
  auto config = YGConfigNew();
  YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
  auto owner = YGNodeNewWithConfig(config), leaf = YGNodeNewWithConfig(config), sibling = YGNodeNewWithConfig(config);
  configureOwnPercentChildren(owner, leaf, sibling, column); setOwnPercentBounds(owner, column, profile);
  YGNodeCalculateLayout(owner, column ? YGUndefined : YGUndefined, column ? YGUndefined : YGUndefined, YGDirectionLTR);
  const float ownerMain = column ? YGNodeLayoutGetHeight(owner) : YGNodeLayoutGetWidth(owner);
  const float leafMain = column ? YGNodeLayoutGetHeight(leaf) : YGNodeLayoutGetWidth(leaf);
  const float siblingMain = column ? YGNodeLayoutGetHeight(sibling) : YGNodeLayoutGetWidth(sibling);
  std::printf("own-percent-root-query axis=%s profile=%s owner=%.17g leaf=%.17g sibling=%.17g calls=%d", column ? "column" : "row", ownPercentProfile(profile), ownerMain, leafMain, siblingMain, calls.calls);
  if (calls.calls) std::printf(" query={main:%.17g,%s,cross:%.17g,%s}", column ? calls.h : calls.w, mode(column ? calls.hm : calls.wm), column ? calls.w : calls.h, mode(column ? calls.wm : calls.hm));
  std::puts("");
  YGNodeFreeRecursive(owner); YGConfigFree(config);
}

// Same-axis owner contribution cases expose the line phase consumed by a
// following outer sibling. The outer is exact-main 200; C is source-order
// after the automatic owner, so its start is the observable contribution.
struct ContributionCall { float w; YGMeasureMode wm; float h; YGMeasureMode hm; };
static ContributionCall contributionCalls[4];
static int contributionCallCount;
YGSize measureContributionLeaf(YGNodeConstRef, float w, YGMeasureMode wm, float h, YGMeasureMode hm) {
  contributionCalls[contributionCallCount++] = { w, wm, h, hm };
  return currentColumn ? YGSize{20, 80} : YGSize{80, 20};
}
void runSameAxisContribution(bool column, bool percentMax) {
  currentColumn = column; currentNaturalMain = 80; contributionCallCount = 0;
  auto config = YGConfigNew();
  YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
  auto outer = YGNodeNewWithConfig(config), owner = YGNodeNewWithConfig(config);
  auto leaf = YGNodeNewWithConfig(config), b = YGNodeNewWithConfig(config), c = YGNodeNewWithConfig(config);
  const auto direction = column ? YGFlexDirectionColumn : YGFlexDirectionRow;
  YGNodeStyleSetFlexDirection(outer, direction); YGNodeStyleSetAlignItems(outer, YGAlignFlexStart);
  setMain(outer, column, 200); setCross(outer, column, 20);
  configureOwnPercentChildren(owner, leaf, b, column);
  YGNodeSetMeasureFunc(leaf, measureContributionLeaf);
  if (column) YGNodeStyleSetMinHeight(owner, 100); else YGNodeStyleSetMinWidth(owner, 100);
  if (percentMax) setMaxPct(owner, column, 75); else if (column) YGNodeStyleSetMaxHeight(owner, 160); else YGNodeStyleSetMaxWidth(owner, 160);
  YGNodeStyleSetFlexGrow(c, 0); YGNodeStyleSetFlexShrink(c, 0);
  setMain(c, column, 20); setBasis(c, column, 20); setCross(c, column, 20);
  if (column) YGNodeStyleSetMinHeight(c, 0); else YGNodeStyleSetMinWidth(c, 0);
  YGNodeInsertChild(outer, owner, 0); YGNodeInsertChild(outer, c, 1);
  YGNodeCalculateLayout(outer, column ? 20 : 200, column ? 200 : 20, YGDirectionLTR);
  const float ownerMain = column ? YGNodeLayoutGetHeight(owner) : YGNodeLayoutGetWidth(owner);
  const float leafMain = column ? YGNodeLayoutGetHeight(leaf) : YGNodeLayoutGetWidth(leaf);
  const float siblingMain = column ? YGNodeLayoutGetHeight(b) : YGNodeLayoutGetWidth(b);
  const float cStart = column ? YGNodeLayoutGetTop(c) : YGNodeLayoutGetLeft(c);
  std::printf("same-axis-contribution axis=%s profile=%s outer=%.17g owner=%.17g leaf=%.17g b=%.17g cStart=%.17g calls=%d",
    column ? "column" : "row", percentMax ? "min100-max75percent" : "min100-max160", column ? YGNodeLayoutGetHeight(outer) : YGNodeLayoutGetWidth(outer), ownerMain, leafMain, siblingMain, cStart, contributionCallCount);
  for (int index = 0; index < contributionCallCount; index++) {
    const auto& call = contributionCalls[index];
    std::printf(" query%d={main:%.17g,%s,cross:%.17g,%s}", index,
      column ? call.h : call.w, mode(column ? call.hm : call.wm),
      column ? call.w : call.h, mode(column ? call.wm : call.hm));
  }
  std::puts("");
  YGNodeFreeRecursive(outer); YGConfigFree(config);
}

void run(bool column, Owner owner, bool floor, bool measured, float supplied = YGUndefined, float naturalMain = 80) {
  currentColumn = column; currentNaturalMain = naturalMain;
  auto config=YGConfigNew(); YGConfigSetUseWebDefaults(config,false); YGConfigSetPointScaleFactor(config,0); YGConfigSetErrata(config,YGErrataNone);
  auto root=YGNodeNewWithConfig(config); configure(root,column,owner);
  auto a=YGNodeNewWithConfig(config); auto b=YGNodeNewWithConfig(config);
  setCross(a,column,20); setCross(b,column,20);
  YGNodeStyleSetFlexGrow(a,0); YGNodeStyleSetFlexShrink(a,0); YGNodeStyleSetFlexGrow(b,0); YGNodeStyleSetFlexShrink(b,0);
  if(measured) { calls = {}; YGNodeSetMeasureFunc(a,measure); }
  else { setMain(a,column,floor?20:80); setBasis(a,column,floor?20:80); }
  if(floor) setMinPct(a,column,50); else { if(!measured) { if(column)YGNodeStyleSetMinHeight(a,0);else YGNodeStyleSetMinWidth(a,0); } setMaxPct(a,column,25); }
  setMain(b,column,80); setBasis(b,column,80); if(column)YGNodeStyleSetMinHeight(b,0);else YGNodeStyleSetMinWidth(b,0);
  YGNodeInsertChild(root,a,0); YGNodeInsertChild(root,b,1);
  const float available = owner == External ? 160 : supplied;
  YGNodeCalculateLayout(root, column ? YGUndefined : available, column ? available : YGUndefined, YGDirectionLTR);
  const float rootMain = column ? YGNodeLayoutGetHeight(root):YGNodeLayoutGetWidth(root);
  const float aMain = column ? YGNodeLayoutGetHeight(a):YGNodeLayoutGetWidth(a);
  const float bMain = column ? YGNodeLayoutGetHeight(b):YGNodeLayoutGetWidth(b);
  std::printf("axis=%s owner=%s bound=%s kind=%s external=%.17g root=%.17g a=%.17g b=%.17g",column?"column":"row",ownerName(owner),floor?"floor50":"cap25",measured?"measure":"fixed",available,rootMain,aMain,bMain);
  if(measured) std::printf(" natural=%.17g calls=%d qmain=%.17g qcross=%.17g modes=%s/%s",naturalMain,calls.calls,column?calls.h:calls.w,column?calls.w:calls.h,mode(column?calls.hm:calls.wm),mode(column?calls.wm:calls.hm));
  std::puts("");
  YGNodeFreeRecursive(root);YGConfigFree(config);
}
}
int main() {
  for (bool column : {false,true}) {
    for (auto owner : {Exact,RootMax,External,Unbounded,RootMin,RootMinMax}) {
      run(column,owner,false,false); run(column,owner,true,false);
      run(column,owner,false,true); run(column,owner,true,true);
    }
    for (float supplied : {80.f,160.f,200.f}) {
      run(column,RootMax,false,false,supplied); run(column,RootMax,true,false,supplied);
      run(column,RootMax,false,true,supplied); run(column,RootMax,true,true,supplied);
      run(column,RootMax,true,true,supplied,20);
    }
    // Natural-20 floors are distinct from the natural-80 cap/floor matrix above.
    for (auto owner : {RootMax,Unbounded,RootMin,RootMinMax}) run(column,owner,true,true,YGUndefined,20);
    runNestedKnownPercentOwner(column, "undefined", YGUndefined);
    runNestedKnownPercentOwner(column, "finite-40", 40);
    runNestedKnownPercentOwner(column, "finite-100", 100);
    runNestedKnownPercentOwner(column, "finite-200", 200);
    // Undefined descendant geometry is native-only; public pure queries return root size.
    for (int branches = 1; branches <= 2; branches++) {
      runKnownOwnerTree(column, branches, "undefined", YGUndefined);
      runKnownOwnerTree(column, branches, "finite-100", 100);
    }
    for (int profile = 0; profile < 3; profile++) {
      runOppositeAxisOwnPercentOwner(column, profile);
      runUndefinedOwnPercentOwner(column, profile);
    }
    runSameAxisContribution(column, false);
    runSameAxisContribution(column, true);
  }
}
