// Pibbl-authored empty-content aspect probe against pinned MIT-licensed Yoga3.2.1.
#include <yoga/Yoga.h>
#include <iostream>
static void print(const char* name,YGNodeRef n){std::cout<<name<<"={x:"<<YGNodeLayoutGetLeft(n)<<",y:"<<YGNodeLayoutGetTop(n)<<",w:"<<YGNodeLayoutGetWidth(n)<<",h:"<<YGNodeLayoutGetHeight(n)<<"}";}
static void run(bool column,bool zero,bool decorated,bool maxCross){
 auto c=YGConfigNew();YGConfigSetUseWebDefaults(c,false);YGConfigSetPointScaleFactor(c,0);YGConfigSetErrata(c,YGErrataNone);
 auto r=YGNodeNewWithConfig(c);YGNodeStyleSetFlexDirection(r,column?YGFlexDirectionColumn:YGFlexDirectionRow);YGNodeStyleSetAlignItems(r,YGAlignFlexStart); if(column){YGNodeStyleSetWidth(r,220);YGNodeStyleSetHeight(r,80);}else{YGNodeStyleSetWidth(r,80);YGNodeStyleSetHeight(r,220);}
 auto a=YGNodeNewWithConfig(c);YGNodeStyleSetFlexBasis(a,90);YGNodeStyleSetFlexShrink(a,1);YGNodeStyleSetAspectRatio(a,3); if(zero){if(column)YGNodeStyleSetMinHeight(a,0);else YGNodeStyleSetMinWidth(a,0);} if(decorated){YGNodeStyleSetPadding(a,YGEdgeLeft,8);YGNodeStyleSetPadding(a,YGEdgeRight,12);YGNodeStyleSetPadding(a,YGEdgeTop,4);YGNodeStyleSetPadding(a,YGEdgeBottom,6);YGNodeStyleSetBorder(a,YGEdgeLeft,2);YGNodeStyleSetBorder(a,YGEdgeRight,2);YGNodeStyleSetBorder(a,YGEdgeTop,1);YGNodeStyleSetBorder(a,YGEdgeBottom,1);}if(maxCross){if(column)YGNodeStyleSetMaxWidth(a,150);else YGNodeStyleSetMaxHeight(a,30);}
 auto b=YGNodeNewWithConfig(c);YGNodeStyleSetFlexShrink(b,0); if(column){YGNodeStyleSetWidth(b,20);YGNodeStyleSetHeight(b,20);}else{YGNodeStyleSetWidth(b,20);YGNodeStyleSetHeight(b,20);}YGNodeInsertChild(r,a,0);YGNodeInsertChild(r,b,1);YGNodeCalculateLayout(r,YGUndefined,YGUndefined,YGDirectionLTR);
 std::cout<<"{axis:"<<(column?"column":"row")<<",min:"<<(zero?"zero":"absent")<<",decorated:"<<(decorated?"yes":"no")<<",maxCross:"<<(maxCross?"yes":"no")<<",";print("A",a);std::cout<<",";print("B",b);std::cout<<"}\n"; YGNodeFreeRecursive(r);YGConfigFree(c);
}
int main(){for(int axis=0;axis<2;axis++)for(int zero=0;zero<2;zero++)for(int decor=0;decor<2;decor++)for(int max=0;max<2;max++)run(axis,zero,decor,max);}
