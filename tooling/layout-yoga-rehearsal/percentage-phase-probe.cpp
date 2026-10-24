#include <yoga/Yoga.h>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <initializer_list>

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
  }
}
