#include <yoga/Yoga.h>
#include <cstdio>

static float baseline(YGNodeConstRef n,float,float){return *static_cast<const float*>(YGNodeGetContext(n));}
static void setLeaf(YGNodeRef n,float width,float height,float first){
  YGNodeSetContext(n,&first); // intentionally overwritten by caller below; no use
  YGNodeStyleSetWidth(n,width); YGNodeStyleSetHeight(n,height); YGNodeStyleSetFlexBasis(n,width);
  YGNodeStyleSetFlexGrow(n,0); YGNodeStyleSetFlexShrink(n,0); YGNodeStyleSetMinWidth(n,0); YGNodeStyleSetMinHeight(n,0);
}
static void print(YGNodeRef n){std::printf("(%.0f,%.0f %.0fx%.0f)",YGNodeLayoutGetLeft(n),YGNodeLayoutGetTop(n),YGNodeLayoutGetWidth(n),YGNodeLayoutGetHeight(n));}
static void run(const char* name,int autoMode,bool allAuto, YGWrap wrap){
  YGConfigRef c=YGConfigNew(); YGConfigSetUseWebDefaults(c,false);YGConfigSetPointScaleFactor(c,0);YGConfigSetErrata(c,YGErrataNone);
  YGNodeRef root=YGNodeNewWithConfig(c); YGNodeStyleSetWidth(root,100);YGNodeStyleSetHeight(root,120);YGNodeStyleSetFlexDirection(root,YGFlexDirectionRow);YGNodeStyleSetFlexWrap(root,wrap);YGNodeStyleSetAlignItems(root,YGAlignBaseline);YGNodeStyleSetAlignContent(root,YGAlignFlexStart); YGNodeStyleSetGap(root,YGGutterRow,8);
  float first[]={12,30,8,20}; float widths[]={60,40,60,40}; float heights[]={20,40,20,30};YGNodeRef nodes[4];
  for(int i=0;i<4;i++){
    nodes[i]=YGNodeNewWithConfig(c); setLeaf(nodes[i],widths[i],heights[i],first[i]); YGNodeSetContext(nodes[i],&first[i]);YGNodeSetBaselineFunc(nodes[i],baseline);
    if((i==0 && autoMode) || allAuto){ if(autoMode&1)YGNodeStyleSetMarginAuto(nodes[i],YGEdgeTop);if(autoMode&2)YGNodeStyleSetMarginAuto(nodes[i],YGEdgeBottom); }
    // Numeric opposite edge verifies line intrinsic extent/free-space.
    if(i==0 && autoMode==1) YGNodeStyleSetMargin(nodes[i],YGEdgeBottom,10);
    YGNodeInsertChild(root,nodes[i],i);
  }
  YGNodeCalculateLayout(root,100,120,YGDirectionLTR);
  std::printf("%s ",name);for(auto n:nodes){print(n);std::printf(" ");}std::printf("\n");
  YGNodeFreeRecursive(root);YGConfigFree(c);
}
int main(){
  run("wrap-top-auto+bottom10",1,false,YGWrapWrap);
  run("wrap-bottom-auto",2,false,YGWrapWrap);
  run("wrap-both-auto",3,false,YGWrapWrap);
  run("wrap-all-top-auto",1,true,YGWrapWrap);
  run("wrap-reverse-top-auto",1,false,YGWrapWrapReverse);
}
