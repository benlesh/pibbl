#include <yoga/Yoga.h>
#include <cstdio>

static float baselineA(YGNodeConstRef, float, float) { return 12; }
static float baselineB(YGNodeConstRef, float, float) { return 30; }
static void run(const char* name, int marginMode) {
  YGConfigRef config=YGConfigNew();
  YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config,YGErrataNone);
  YGNodeRef root=YGNodeNewWithConfig(config), a=YGNodeNewWithConfig(config), b=YGNodeNewWithConfig(config);
  YGNodeStyleSetWidth(root,160);YGNodeStyleSetHeight(root,80);YGNodeStyleSetFlexDirection(root,YGFlexDirectionRow);YGNodeStyleSetFlexWrap(root,YGWrapNoWrap);YGNodeStyleSetAlignItems(root,YGAlignBaseline);
  YGNodeStyleSetWidth(a,40);YGNodeStyleSetHeight(a,20);YGNodeStyleSetFlexBasis(a,40);YGNodeStyleSetFlexGrow(a,0);YGNodeStyleSetFlexShrink(a,0);YGNodeStyleSetMinWidth(a,0);YGNodeStyleSetMinHeight(a,0);YGNodeSetBaselineFunc(a,baselineA);
  YGNodeStyleSetWidth(b,40);YGNodeStyleSetHeight(b,40);YGNodeStyleSetFlexBasis(b,40);YGNodeStyleSetFlexGrow(b,0);YGNodeStyleSetFlexShrink(b,0);YGNodeStyleSetMinWidth(b,0);YGNodeStyleSetMinHeight(b,0);YGNodeSetBaselineFunc(b,baselineB);
  if(marginMode==1) YGNodeStyleSetMarginAuto(a,YGEdgeTop);
  if(marginMode==2) YGNodeStyleSetMarginAuto(a,YGEdgeLeft);
  YGNodeInsertChild(root,a,0);YGNodeInsertChild(root,b,1);
  YGNodeCalculateLayout(root,YGUndefined,YGUndefined,YGDirectionLTR);
  std::printf("%s root=%g,%g A=%g,%g,%g,%g B=%g,%g,%g,%g\n",name,YGNodeLayoutGetWidth(root),YGNodeLayoutGetHeight(root),YGNodeLayoutGetLeft(a),YGNodeLayoutGetTop(a),YGNodeLayoutGetWidth(a),YGNodeLayoutGetHeight(a),YGNodeLayoutGetLeft(b),YGNodeLayoutGetTop(b),YGNodeLayoutGetWidth(b),YGNodeLayoutGetHeight(b));
  YGNodeFreeRecursive(root);YGConfigFree(config);
}
int main(){run("zero",0);run("top-auto",1);run("left-auto",2);}
