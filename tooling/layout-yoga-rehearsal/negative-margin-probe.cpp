#include <yoga/Yoga.h>
#include <cstdio>

static YGConfigRef config() {
  auto c=YGConfigNew(); YGConfigSetUseWebDefaults(c,false); YGConfigSetPointScaleFactor(c,0); YGConfigSetErrata(c,YGErrataNone); return c;
}
static YGNodeRef leaf(YGConfigRef c,float w,float h,float basis,float grow,float shrink,float ml,float mr,float mt=0,float mb=0) {
  auto n=YGNodeNewWithConfig(c); YGNodeStyleSetWidth(n,w);YGNodeStyleSetHeight(n,h);YGNodeStyleSetFlexBasis(n,basis);YGNodeStyleSetFlexGrow(n,grow);YGNodeStyleSetFlexShrink(n,shrink);YGNodeStyleSetMinWidth(n,0);YGNodeStyleSetMinHeight(n,0);YGNodeStyleSetMargin(n,YGEdgeLeft,ml);YGNodeStyleSetMargin(n,YGEdgeRight,mr);YGNodeStyleSetMargin(n,YGEdgeTop,mt);YGNodeStyleSetMargin(n,YGEdgeBottom,mb);return n;
}
static void box(const char*n,YGNodeRef x){std::printf("%s=(%.17g,%.17g %.17gx%.17g)",n,YGNodeLayoutGetLeft(x),YGNodeLayoutGetTop(x),YGNodeLayoutGetWidth(x),YGNodeLayoutGetHeight(x));}
static void rootbase(YGNodeRef root,float w,float h,YGAlign align=YGAlignFlexStart){YGNodeStyleSetWidth(root,w);YGNodeStyleSetHeight(root,h);YGNodeStyleSetFlexDirection(root,YGFlexDirectionRow);YGNodeStyleSetAlignItems(root,align);}
int main(){
 auto c=config();
 {auto r=YGNodeNewWithConfig(c);rootbase(r,120,60);auto a=leaf(c,40,20,40,0,0,-30,-30),b=leaf(c,80,20,80,0,0,0,0);YGNodeInsertChild(r,a,0);YGNodeInsertChild(r,b,1);YGNodeCalculateLayout(r,YGUndefined,YGUndefined,YGDirectionLTR);std::printf("opposing-negative ");box("A",a);std::printf(" ");box("B",b);std::printf("\n");YGNodeFreeRecursive(r);}
 {auto r=YGNodeNewWithConfig(c);rootbase(r,100,60);auto a=leaf(c,80,20,80,0,0,-10,-10),b=leaf(c,80,20,80,0,0,0,0);YGNodeInsertChild(r,a,0);YGNodeInsertChild(r,b,1);YGNodeCalculateLayout(r,YGUndefined,YGUndefined,YGDirectionLTR);std::printf("unshrinkable-overflow ");box("A",a);std::printf(" ");box("B",b);std::printf("\n");YGNodeFreeRecursive(r);}
 {auto r=YGNodeNewWithConfig(c);rootbase(r,200,60);auto a=leaf(c,100,20,100,1,1,-20,-10),b=leaf(c,80,20,80,1,1,0,0);YGNodeStyleSetMaxWidth(a,120);YGNodeInsertChild(r,a,0);YGNodeInsertChild(r,b,1);YGNodeCalculateLayout(r,YGUndefined,YGUndefined,YGDirectionLTR);std::printf("grow-max-negative ");box("A",a);std::printf(" ");box("B",b);std::printf("\n");YGNodeFreeRecursive(r);}
 {auto r=YGNodeNewWithConfig(c);rootbase(r,100,60);auto a=leaf(c,100,20,100,0,1,-10,-10),b=leaf(c,80,20,80,0,1,0,0);YGNodeStyleSetMinWidth(a,50);YGNodeInsertChild(r,a,0);YGNodeInsertChild(r,b,1);YGNodeCalculateLayout(r,YGUndefined,YGUndefined,YGDirectionLTR);std::printf("shrink-min-negative ");box("A",a);std::printf(" ");box("B",b);std::printf("\n");YGNodeFreeRecursive(r);}
 {auto r=YGNodeNewWithConfig(c);rootbase(r,100,100,YGAlignCenter);YGNodeStyleSetFlexWrap(r,YGWrapWrap);auto a=leaf(c,60,40,60,0,0,0,0,-20,-10),b=leaf(c,40,20,40,0,0,0,0),d=leaf(c,60,20,60,0,0,0,0);YGNodeInsertChild(r,a,0);YGNodeInsertChild(r,b,1);YGNodeInsertChild(r,d,2);YGNodeCalculateLayout(r,YGUndefined,YGUndefined,YGDirectionLTR);std::printf("wrapped-cross-center ");box("A",a);std::printf(" ");box("B",b);std::printf(" ");box("D",d);std::printf("\n");YGNodeFreeRecursive(r);}
 YGConfigFree(c);
}
