#include <yoga/Yoga.h>
#include <cstdio>

static float baselineA(YGNodeConstRef, float, float) { return 12; }
static float baselineB(YGNodeConstRef, float, float) { return 30; }
static void run(const char* name, YGDirection direction) {
  YGConfigRef config=YGConfigNew();
  YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config,YGErrataNone);
  YGNodeRef root=YGNodeNewWithConfig(config), a=YGNodeNewWithConfig(config), b=YGNodeNewWithConfig(config);
  YGNodeStyleSetWidth(root,120);YGNodeStyleSetHeight(root,60);YGNodeStyleSetFlexDirection(root,YGFlexDirectionRow);YGNodeStyleSetFlexWrap(root,YGWrapNoWrap);YGNodeStyleSetAlignItems(root,YGAlignBaseline);
  YGNodeStyleSetWidth(a,40);YGNodeStyleSetHeight(a,20);YGNodeStyleSetFlexBasis(a,40);YGNodeStyleSetFlexGrow(a,0);YGNodeStyleSetFlexShrink(a,0);YGNodeStyleSetMinWidth(a,0);YGNodeStyleSetMinHeight(a,0);YGNodeSetBaselineFunc(a,baselineA);
  YGNodeStyleSetWidth(b,40);YGNodeStyleSetHeight(b,40);YGNodeStyleSetFlexBasis(b,40);YGNodeStyleSetFlexGrow(b,0);YGNodeStyleSetFlexShrink(b,0);YGNodeStyleSetMinWidth(b,0);YGNodeStyleSetMinHeight(b,0);YGNodeSetBaselineFunc(b,baselineB);
  YGNodeInsertChild(root,a,0);YGNodeInsertChild(root,b,1);
  YGNodeCalculateLayout(root,YGUndefined,YGUndefined,direction);
  std::printf("%s root=%g,%g A=%g,%g,%g,%g B=%g,%g,%g,%g\n",name,YGNodeLayoutGetWidth(root),YGNodeLayoutGetHeight(root),YGNodeLayoutGetLeft(a),YGNodeLayoutGetTop(a),YGNodeLayoutGetWidth(a),YGNodeLayoutGetHeight(a),YGNodeLayoutGetLeft(b),YGNodeLayoutGetTop(b),YGNodeLayoutGetWidth(b),YGNodeLayoutGetHeight(b));
  YGNodeFreeRecursive(root);YGConfigFree(config);
}
int main(){run("ltr",YGDirectionLTR);run("rtl",YGDirectionRTL);}
