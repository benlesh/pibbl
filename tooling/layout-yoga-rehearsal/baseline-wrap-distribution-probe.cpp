// Pinned Yoga 3.2.1 reference: baseline-wrap cross-axis distribution and reversal.
#include <yoga/Yoga.h>
#include <cstdio>
#include <initializer_list>

static float baseline(YGNodeConstRef node, float, float) { return *static_cast<const float*>(YGNodeGetContext(node)); }
static void print(const char* wrap, const char* align, const char* name, YGNodeRef node) {
  std::printf("%s %-13s %s %.17g %.17g %.17g %.17g\n", wrap, align, name,
    YGNodeLayoutGetLeft(node), YGNodeLayoutGetTop(node), YGNodeLayoutGetWidth(node), YGNodeLayoutGetHeight(node));
}
struct Entry { const char* name; YGAlign align; };
int main() {
  const Entry aligns[]={{"flex-start",YGAlignFlexStart},{"flex-end",YGAlignFlexEnd},{"center",YGAlignCenter},{"space-between",YGAlignSpaceBetween},{"space-around",YGAlignSpaceAround},{"space-evenly",YGAlignSpaceEvenly},{"stretch",YGAlignStretch}};
  const float offsets[]={12,30,8,20}; const char* names[]={"A","B","C","D"};
  const float widths[]={60,40,60,40}; const float heights[]={20,40,20,30};
  for (const auto wrap : {YGWrapWrap,YGWrapWrapReverse}) for (const auto entry : aligns) {
    YGConfigRef config=YGConfigNew(); YGConfigSetUseWebDefaults(config,false); YGConfigSetPointScaleFactor(config,0); YGConfigSetErrata(config,YGErrataNone);
    YGNodeRef root=YGNodeNewWithConfig(config); YGNodeStyleSetWidth(root,110); YGNodeStyleSetHeight(root,120);
    YGNodeStyleSetFlexDirection(root,YGFlexDirectionRow); YGNodeStyleSetFlexWrap(root,wrap); YGNodeStyleSetAlignItems(root,YGAlignBaseline); YGNodeStyleSetAlignContent(root,entry.align);
    YGNodeStyleSetGap(root,YGGutterColumn,10); YGNodeStyleSetGap(root,YGGutterRow,8);
    YGNodeRef leaves[4];
    for (int index=0;index<4;index++) { leaves[index]=YGNodeNewWithConfig(config); YGNodeSetContext(leaves[index],const_cast<float*>(&offsets[index])); YGNodeSetBaselineFunc(leaves[index],baseline); YGNodeStyleSetWidth(leaves[index],widths[index]); YGNodeStyleSetHeight(leaves[index],heights[index]); YGNodeStyleSetFlexBasis(leaves[index],widths[index]); YGNodeStyleSetFlexGrow(leaves[index],0); YGNodeStyleSetFlexShrink(leaves[index],0); YGNodeInsertChild(root,leaves[index],index); }
    YGNodeCalculateLayout(root,110,120,YGDirectionLTR);
    for(int index=0;index<4;index++) print(wrap==YGWrapWrap?"wrap":"wrap-reverse",entry.name,names[index],leaves[index]);
    YGNodeFreeRecursive(root); YGConfigFree(config);
  }
}
