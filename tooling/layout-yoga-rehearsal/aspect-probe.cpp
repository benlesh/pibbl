// Pibbl-authored semantic probe; compiled only against separately supplied pinned Yoga.
#include <yoga/Yoga.h>
#include <iostream>
static void edges(YGNodeRef n) {
  YGNodeStyleSetPadding(n,YGEdgeLeft,3); YGNodeStyleSetPadding(n,YGEdgeRight,5);
  YGNodeStyleSetPadding(n,YGEdgeTop,7); YGNodeStyleSetPadding(n,YGEdgeBottom,11);
  YGNodeStyleSetBorder(n,YGEdgeLeft,2); YGNodeStyleSetBorder(n,YGEdgeRight,4);
  YGNodeStyleSetBorder(n,YGEdgeTop,6); YGNodeStyleSetBorder(n,YGEdgeBottom,8);
}
static void printInsets(const char* label, YGNodeRef n) { std::cout << label << " x=" << YGNodeLayoutGetLeft(n) << " y=" << YGNodeLayoutGetTop(n) << " w=" << YGNodeLayoutGetWidth(n) << " h=" << YGNodeLayoutGetHeight(n) << "\n"; }
static void probeInsets(){ auto c=YGConfigNew(); YGConfigSetUseWebDefaults(c,false); YGConfigSetPointScaleFactor(c,0); YGConfigSetErrata(c,YGErrataNone);
 for (int axis=0;axis<2;axis++) for (int boxed=0;boxed<2;boxed++) { auto root=YGNodeNewWithConfig(c); YGNodeStyleSetWidth(root,300); YGNodeStyleSetHeight(root,300); YGNodeStyleSetFlexDirection(root,YGFlexDirectionRow); YGNodeStyleSetAlignItems(root,YGAlignFlexStart); auto n=YGNodeNewWithConfig(c); edges(n); YGNodeStyleSetBoxSizing(n, boxed?YGBoxSizingBorderBox:YGBoxSizingContentBox); if(axis==0) YGNodeStyleSetWidth(n, boxed?104:90); else YGNodeStyleSetHeight(n, boxed?62:30); YGNodeStyleSetAspectRatio(n,3); YGNodeStyleSetFlexShrink(n,0); YGNodeInsertChild(root,n,0); YGNodeCalculateLayout(root,YGUndefined,YGUndefined,YGDirectionLTR); printInsets(axis==0?(boxed?"border-box width104 ratio3":"content-box width90 ratio3"):(boxed?"border-box height62 ratio3":"content-box height30 ratio3"),n); YGNodeFreeRecursive(root); }
 YGConfigFree(c); }

#include <yoga/Yoga.h>
#include <iostream>
static YGConfigRef config() { auto c=YGConfigNew(); YGConfigSetUseWebDefaults(c,false); YGConfigSetPointScaleFactor(c,0); YGConfigSetErrata(c,YGErrataNone); return c; }
static void print(const char* name,YGNodeRef child) { std::cout<<name<<" x="<<YGNodeLayoutGetLeft(child)<<" y="<<YGNodeLayoutGetTop(child)<<" w="<<YGNodeLayoutGetWidth(child)<<" h="<<YGNodeLayoutGetHeight(child)<<"\n"; }
static YGNodeRef root(YGConfigRef c, float w=200,float h=120,bool start=false) { auto r=YGNodeNewWithConfig(c); YGNodeStyleSetWidth(r,w);YGNodeStyleSetHeight(r,h);YGNodeStyleSetFlexDirection(r,YGFlexDirectionRow);if(start)YGNodeStyleSetAlignItems(r,YGAlignFlexStart);return r; }
static YGNodeRef child(YGConfigRef c) { auto n=YGNodeNewWithConfig(c);YGNodeStyleSetAspectRatio(n,3);return n; }
int main(){probeInsets(); auto c=config();
{auto r=root(c);auto n=child(c);YGNodeStyleSetWidth(n,90);YGNodeInsertChild(r,n,0);YGNodeCalculateLayout(r,YGUndefined,YGUndefined,YGDirectionLTR);print("width90-default-stretch",n);YGNodeFreeRecursive(r);}
{auto r=root(c,200,120,true);auto n=child(c);YGNodeStyleSetWidth(n,90);YGNodeInsertChild(r,n,0);YGNodeCalculateLayout(r,YGUndefined,YGUndefined,YGDirectionLTR);print("width90-flex-start",n);YGNodeFreeRecursive(r);}
{auto r=root(c,200,120,true);auto n=child(c);YGNodeStyleSetFlexBasis(n,90);YGNodeInsertChild(r,n,0);YGNodeCalculateLayout(r,YGUndefined,YGUndefined,YGDirectionLTR);print("basis90-flex-start",n);YGNodeFreeRecursive(r);}
{auto r=root(c,200,120,true);auto n=child(c);YGNodeStyleSetWidth(n,90);YGNodeStyleSetMaxHeight(n,20);YGNodeInsertChild(r,n,0);YGNodeCalculateLayout(r,YGUndefined,YGUndefined,YGDirectionLTR);print("width90-maxHeight20",n);YGNodeFreeRecursive(r);}
{auto r=root(c,200,120,true);auto n=child(c);YGNodeStyleSetWidth(n,90);YGNodeStyleSetMinHeight(n,40);YGNodeInsertChild(r,n,0);YGNodeCalculateLayout(r,YGUndefined,YGUndefined,YGDirectionLTR);print("width90-minHeight40",n);YGNodeFreeRecursive(r);}
{auto r=root(c,200,120,true);auto n=child(c);YGNodeStyleSetWidth(n,90);YGNodeStyleSetHeight(n,50);YGNodeInsertChild(r,n,0);YGNodeCalculateLayout(r,YGUndefined,YGUndefined,YGDirectionLTR);print("width90-height50",n);YGNodeFreeRecursive(r);}
{auto r=root(c,100,120,true);for(int i=0;i<2;i++){auto n=child(c);YGNodeStyleSetWidth(n,90);YGNodeStyleSetFlexShrink(n,1);YGNodeInsertChild(r,n,i);}YGNodeCalculateLayout(r,YGUndefined,YGUndefined,YGDirectionLTR);print("two-width90-shrink-A",YGNodeGetChild(r,0));print("two-width90-shrink-B",YGNodeGetChild(r,1));YGNodeFreeRecursive(r);}
YGConfigFree(c);}
