#include <yoga/Yoga.h>
#include <cstdio>
float firstA=12;
float aBaseline(YGNodeConstRef,float,float){return firstA;}
float bBaseline(YGNodeConstRef,float,float){return 30;}
YGNodeRef box(YGConfigRef c,float w,float h){auto n=YGNodeNewWithConfig(c);YGNodeStyleSetWidth(n,w);YGNodeStyleSetHeight(n,h);YGNodeStyleSetFlexDirection(n,YGFlexDirectionRow);YGNodeStyleSetAlignItems(n,YGAlignFlexStart);YGNodeStyleSetFlexShrink(n,0);return n;}
int main(){for(int nested=0;nested<2;nested++)for(int order=0;order<2;order++)for(int step=0;step<3;step++){
 auto c=YGConfigNew();YGConfigSetUseWebDefaults(c,false);YGConfigSetPointScaleFactor(c,0);YGConfigSetErrata(c,YGErrataNone);
 auto root=box(c,100,80);YGNodeStyleSetAlignItems(root,YGAlignBaseline);
 auto inner=box(c,40,20);YGNodeStyleSetPositionType(inner,YGPositionTypeStatic);YGNodeInsertChild(root,inner,0);
 auto owner=inner;if(nested){owner=box(c,40,20);YGNodeStyleSetPositionType(owner,YGPositionTypeStatic);YGNodeInsertChild(inner,owner,0);}
 auto a=box(c,40,20);YGNodeSetBaselineFunc(a,aBaseline);firstA=step?22:12;if(step==2)YGNodeStyleSetPosition(a,YGEdgeTop,10);
 auto badge=box(c,8,8);YGNodeStyleSetPositionType(badge,YGPositionTypeAbsolute);YGNodeStyleSetPosition(badge,YGEdgeLeft,0);YGNodeStyleSetPosition(badge,YGEdgeTop,0);
 YGNodeInsertChild(owner,order?badge:a,0);YGNodeInsertChild(owner,order?a:badge,1);
 auto b=box(c,40,40);YGNodeSetBaselineFunc(b,bBaseline);YGNodeInsertChild(root,b,1);YGNodeCalculateLayout(root,100,80,YGDirectionLTR);
 float y=YGNodeLayoutGetTop(inner)+(nested?YGNodeLayoutGetTop(owner):0);
 printf("nested=%d absoluteFirst=%d step=%d A=%g B=%g badge=%g\n",nested,order,step,y+YGNodeLayoutGetTop(a),YGNodeLayoutGetTop(b),y+YGNodeLayoutGetTop(badge));
 YGNodeFreeRecursive(root);YGConfigFree(c);
}}
