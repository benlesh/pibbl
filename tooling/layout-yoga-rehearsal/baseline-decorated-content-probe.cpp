// Pinned Yoga 3.2.1: equivalent outer boxes and outer-relative baselines.
// Pibbl queries A content40x20/first12; its top inset16 lifts that first to28.
// Yoga callbacks receive outer dimensions, so this control supplies57x48/first28.
#include <yoga/Yoga.h>
#include <cstdio>
struct Data { const char* name; float first; };
static float baseline(YGNodeConstRef node, float width, float height) {
  auto* d=static_cast<const Data*>(YGNodeGetContext(node));
  std::printf("callback %s width=%.17g height=%.17g first=%.17g\n", d->name,width,height,d->first);
  return d->first;
}
static YGNodeRef leaf(YGConfigRef c, const char* name, float width, float height, float first, bool decorated) {
  auto n=YGNodeNewWithConfig(c); auto* d=new Data{name,first}; YGNodeSetContext(n,d); YGNodeSetBaselineFunc(n,baseline);
  YGNodeStyleSetWidth(n,width); YGNodeStyleSetHeight(n,height); YGNodeStyleSetFlexBasis(n,width); YGNodeStyleSetFlexGrow(n,0); YGNodeStyleSetFlexShrink(n,0);
  if (decorated) {
    YGNodeStyleSetPadding(n,YGEdgeLeft,5); YGNodeStyleSetPadding(n,YGEdgeRight,7); YGNodeStyleSetPadding(n,YGEdgeTop,10); YGNodeStyleSetPadding(n,YGEdgeBottom,4);
    YGNodeStyleSetBorder(n,YGEdgeLeft,3); YGNodeStyleSetBorder(n,YGEdgeRight,2); YGNodeStyleSetBorder(n,YGEdgeTop,6); YGNodeStyleSetBorder(n,YGEdgeBottom,8);
  }
  return n;
}
static void drop(YGNodeRef n) { delete static_cast<Data*>(YGNodeGetContext(n)); YGNodeFree(n); }
static void print(const char* name, YGNodeRef n) { std::printf("box %s x=%.17g y=%.17g w=%.17g h=%.17g\n",name,YGNodeLayoutGetLeft(n),YGNodeLayoutGetTop(n),YGNodeLayoutGetWidth(n),YGNodeLayoutGetHeight(n)); }
int main(){
  auto c=YGConfigNew(); YGConfigSetUseWebDefaults(c,false); YGConfigSetPointScaleFactor(c,0); YGConfigSetErrata(c,YGErrataNone);
  auto root=YGNodeNewWithConfig(c); YGNodeStyleSetWidth(root,100); YGNodeStyleSetHeight(root,100); YGNodeStyleSetFlexDirection(root,YGFlexDirectionRow); YGNodeStyleSetAlignItems(root,YGAlignBaseline); YGNodeStyleSetFlexWrap(root,YGWrapWrap); YGNodeStyleSetAlignContent(root,YGAlignFlexStart);
  auto a=leaf(c,"A",57,48,28,true), b=leaf(c,"B",40,40,30,false), child=leaf(c,"C",60,20,8,false); YGNodeInsertChild(root,a,0); YGNodeInsertChild(root,b,1); YGNodeInsertChild(root,child,2);
  YGNodeCalculateLayout(root,100,100,YGDirectionLTR); print("root",root); print("A",a); print("B",b); print("C",child);
  drop(a); drop(b); drop(child); YGNodeFree(root); YGConfigFree(c);
}
