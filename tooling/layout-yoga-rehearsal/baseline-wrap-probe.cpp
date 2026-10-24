// Pinned Yoga 3.2.1 oracle for Slice 198: source-ordered row-wrap lines
// share first baselines only within their own line.
#include <yoga/Yoga.h>
#include <cstdio>

static float baseline(YGNodeConstRef node, float, float) {
  return *static_cast<const float*>(YGNodeGetContext(node));
}
static void print(const char* name, YGNodeRef node) {
  std::printf("%s %.0f %.0f %.0f %.0f\n", name,
    YGNodeLayoutGetLeft(node), YGNodeLayoutGetTop(node),
    YGNodeLayoutGetWidth(node), YGNodeLayoutGetHeight(node));
}
struct Direction { YGFlexDirection axis; YGDirection writing; const char* name; };
static void run(float d, Direction mode) {
  YGConfigRef config=YGConfigNew();YGConfigSetUseWebDefaults(config,false);YGConfigSetPointScaleFactor(config,0);YGConfigSetErrata(config,YGErrataNone);
  YGNodeRef root=YGNodeNewWithConfig(config);
  YGNodeStyleSetWidth(root,100); YGNodeStyleSetHeight(root,100);
  YGNodeStyleSetFlexDirection(root,mode.axis);
  YGNodeStyleSetFlexWrap(root,YGWrapWrap);
  YGNodeStyleSetAlignItems(root,YGAlignBaseline);
  YGNodeStyleSetAlignContent(root,YGAlignFlexStart);
  float offsets[]={12,30,8,d};
  const char* names[]={"A","B","C","D"};
  const float widths[]={60,40,60,40};
  const float heights[]={20,40,20,30};
  YGNodeRef leaves[4];
  for(int i=0;i<4;i++) {
    leaves[i]=YGNodeNewWithConfig(config); YGNodeSetContext(leaves[i],&offsets[i]);
    YGNodeSetBaselineFunc(leaves[i],baseline);
    YGNodeStyleSetWidth(leaves[i],widths[i]); YGNodeStyleSetHeight(leaves[i],heights[i]);
    YGNodeStyleSetFlexBasis(leaves[i],widths[i]); YGNodeStyleSetFlexGrow(leaves[i],0); YGNodeStyleSetFlexShrink(leaves[i],0);
    YGNodeInsertChild(root,leaves[i],i);
  }
  YGNodeCalculateLayout(root,100,100,mode.writing);
  std::printf("%s %s\n",mode.name,d==20?"initial":"d26"); for(int i=0;i<4;i++) print(names[i],leaves[i]);
  YGNodeFreeRecursive(root);YGConfigFree(config);
}

int main(){
  const Direction modes[]={{YGFlexDirectionRow,YGDirectionLTR,"row-ltr"},{YGFlexDirectionRow,YGDirectionRTL,"row-rtl"},{YGFlexDirectionRowReverse,YGDirectionLTR,"reverse-ltr"},{YGFlexDirectionRowReverse,YGDirectionRTL,"reverse-rtl"}};
  for (const auto& mode:modes){run(20,mode);run(26,mode);}
}
