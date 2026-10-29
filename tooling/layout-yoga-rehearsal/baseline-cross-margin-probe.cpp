// Pinned Yoga 3.2.1 reference for numeric cross margins with baseline alignment.
#include <yoga/Yoga.h>
#include <cstdio>

static float baseline(YGNodeConstRef node, float, float) {
  return *static_cast<const float*>(YGNodeGetContext(node));
}
static YGNodeRef leaf(YGConfigRef config, float width, float height, float first, float top, float bottom) {
  auto node=YGNodeNewWithConfig(config); auto* offset=new float(first);
  YGNodeSetContext(node, offset); YGNodeSetBaselineFunc(node, baseline);
  YGNodeStyleSetWidth(node,width); YGNodeStyleSetHeight(node,height); YGNodeStyleSetFlexBasis(node,width);
  YGNodeStyleSetFlexGrow(node,0); YGNodeStyleSetFlexShrink(node,0);
  YGNodeStyleSetMargin(node,YGEdgeTop,top); YGNodeStyleSetMargin(node,YGEdgeBottom,bottom);
  return node;
}
static void dispose(YGNodeRef node) { delete static_cast<float*>(YGNodeGetContext(node)); YGNodeFree(node); }
static void print(const char* profile, const char* name, YGNodeRef node) {
  std::printf("%s %s x=%.17g y=%.17g w=%.17g h=%.17g\n",profile,name,YGNodeLayoutGetLeft(node),YGNodeLayoutGetTop(node),YGNodeLayoutGetWidth(node),YGNodeLayoutGetHeight(node));
}
int main() {
  auto config=YGConfigNew(); YGConfigSetUseWebDefaults(config,false); YGConfigSetPointScaleFactor(config,0); YGConfigSetErrata(config,YGErrataNone);
  { // nowrap: A uses both cross margins; B sets the shared ascent.
    auto root=YGNodeNewWithConfig(config); YGNodeStyleSetWidth(root,120); YGNodeStyleSetHeight(root,80); YGNodeStyleSetFlexDirection(root,YGFlexDirectionRow); YGNodeStyleSetAlignItems(root,YGAlignBaseline);
    auto a=leaf(config,40,20,12,10,4), b=leaf(config,40,40,30,0,0); YGNodeInsertChild(root,a,0); YGNodeInsertChild(root,b,1); YGNodeCalculateLayout(root,120,80,YGDirectionLTR);
    print("nowrap", "A",a); print("nowrap","B",b); dispose(a);dispose(b);YGNodeFree(root);
  }
  { // wrap: numeric margins contribute independently to each line's extent.
    auto root=YGNodeNewWithConfig(config); YGNodeStyleSetWidth(root,100); YGNodeStyleSetHeight(root,120); YGNodeStyleSetFlexDirection(root,YGFlexDirectionRow); YGNodeStyleSetFlexWrap(root,YGWrapWrap); YGNodeStyleSetAlignItems(root,YGAlignBaseline); YGNodeStyleSetAlignContent(root,YGAlignFlexStart);
    auto a=leaf(config,60,20,12,10,4), b=leaf(config,40,40,30,0,0), c=leaf(config,60,20,8,2,6), d=leaf(config,40,30,20,0,0);
    YGNodeRef nodes[]={a,b,c,d}; for(int i=0;i<4;i++) YGNodeInsertChild(root,nodes[i],i); YGNodeCalculateLayout(root,100,120,YGDirectionLTR);
    print("wrap","A",a);print("wrap","B",b);print("wrap","C",c);print("wrap","D",d);for(auto n:nodes)dispose(n);YGNodeFree(root);
  }
  YGConfigFree(config);
}
