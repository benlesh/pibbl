// Pibbl-authored bounded probe against the separately supplied MIT-licensed Yoga source.
#include <yoga/Yoga.h>
#include <iostream>
struct NumericStyle { double basis, grow, shrink, minimum, maximum; };
static NumericStyle numericStyle(int i, int j) {
  const double basis = i == 17 || i == 19 || i == 22 || i == 24 ? 80 : i == 18 ? 100 : i == 23 ? 20 : 0;
  const double grow = i == 16 ? (j == 0 ? .5 : 1.5) : i == 18 ? 1 : i == 20 ? (j == 0 ? 1e30 : 2e30) : i == 21 || i == 23 ? .25 : 0;
  const double shrink = i == 17 ? (j == 0 ? .5 : 1.5) : i == 19 ? (j == 0 ? 1 : 3) : i == 22 || i == 24 ? .25 : 0;
  return {basis, grow, shrink, j == 0 ? (i == 24 ? 90. : i == 19 ? 70. : 0.) : 0., j == 0 ? (i == 23 ? 10. : i == 18 ? 110. : 1000000.) : 1000000.};
}
static void distributionCases() {
  const char* mainNames[] = {"flex-start","flex-end","center","space-between","space-around","space-evenly"};
  const YGJustify mainValues[] = {YGJustifyFlexStart,YGJustifyFlexEnd,YGJustifyCenter,YGJustifySpaceBetween,YGJustifySpaceAround,YGJustifySpaceEvenly};
  const char* crossNames[] = {"flex-start","flex-end","center","space-between","space-around","space-evenly","stretch"};
  const YGAlign crossValues[] = {YGAlignFlexStart,YGAlignFlexEnd,YGAlignCenter,YGAlignSpaceBetween,YGAlignSpaceAround,YGAlignSpaceEvenly,YGAlignStretch};
  for (int axis=0;axis<4;axis++) for (int family=0;family<4;family++) {
    const bool reverse=axis>=2;
    if(reverse && family>=2)continue;
    const int policies=family==0?6:family==3?1:7;
    for(int policy=0;policy<policies;policy++) {
      if(reverse && policy!=4 && policy!=5)continue;
      const bool column=axis%2==1, negative=family==0, crossNegative=family==1, single=family==2, automatic=family==3;
      const int mainSize=100, crossSize=crossNegative?30:100, count=single?1:2;
      auto config=YGConfigNew(); YGConfigSetUseWebDefaults(config,false); YGConfigSetPointScaleFactor(config,0); YGConfigSetErrata(config,YGErrataNone);
      auto root=YGNodeNewWithConfig(config); YGNodeStyleSetWidth(root,column?crossSize:mainSize); YGNodeStyleSetHeight(root,column?mainSize:crossSize);
      YGNodeStyleSetFlexDirection(root,column?(reverse&&!crossNegative?YGFlexDirectionColumnReverse:YGFlexDirectionColumn):(reverse&&!crossNegative?YGFlexDirectionRowReverse:YGFlexDirectionRow));
      YGNodeStyleSetFlexWrap(root,crossNegative||single?(reverse?YGWrapWrapReverse:YGWrapWrap):YGWrapNoWrap);
      YGNodeStyleSetJustifyContent(root,negative?mainValues[policy]:YGJustifyFlexStart);
      YGNodeStyleSetAlignContent(root,crossNegative||single?crossValues[policy]:YGAlignFlexStart);
      YGNodeStyleSetAlignItems(root,automatic?YGAlignStretch:YGAlignFlexStart);
      YGNodeStyleSetGap(root,YGGutterAll,single||automatic?0:12);
      for(int j=0;j<count;j++) {
        auto child=YGNodeNewWithConfig(config); YGNodeStyleSetFlexBasis(child,negative||crossNegative?80:20); YGNodeStyleSetFlexShrink(child,0);
        YGNodeStyleSetMinWidth(child,0);YGNodeStyleSetMinHeight(child,0);
        if(column) { YGNodeStyleSetHeight(child,negative||crossNegative?80:20); if(!automatic)YGNodeStyleSetWidth(child,20);else if(j==0)YGNodeStyleSetMaxWidth(child,30); }
        else { YGNodeStyleSetWidth(child,negative||crossNegative?80:20); if(!automatic)YGNodeStyleSetHeight(child,20);else if(j==0)YGNodeStyleSetMaxHeight(child,30); }
        YGNodeInsertChild(root,child,j);
      }
      YGNodeCalculateLayout(root,YGUndefined,YGUndefined,YGDirectionLTR);
      std::cout<<",{\"name\":\"distribution-"<<(negative?"negative-":crossNegative?"cross-negative-":single?"single-":"auto-")<<(column?"column":"row")<<(reverse?"-reverse":"");
      if(!automatic)std::cout<<"-"<<(negative?mainNames[policy]:crossNames[policy]);
      std::cout<<"\",\"width\":"<<(column?crossSize:mainSize)<<",\"height\":"<<(column?mainSize:crossSize)<<",\"gap\":"<<(single||automatic?0:12)<<",\"flexDirection\":\""<<(column?(reverse&&!crossNegative?"column-reverse":"column"):(reverse&&!crossNegative?"row-reverse":"row"))<<"\",\"flexWrap\":\""<<(crossNegative||single?(reverse?"wrap-reverse":"wrap"):"nowrap")<<"\",\"containerStyle\":{\"justifyContent\":\""<<(negative?mainNames[policy]:"flex-start")<<"\",\"alignContent\":\""<<(crossNegative||single?crossNames[policy]:"flex-start")<<"\",\"alignItems\":\""<<(automatic?"stretch":"flex-start")<<"\"},\"boxes\":[";
      for(int j=0;j<count;j++){auto child=YGNodeGetChild(root,j);if(j)std::cout<<",";std::cout<<"{\"x\":"<<YGNodeLayoutGetLeft(child)<<",\"y\":"<<YGNodeLayoutGetTop(child)<<",\"width\":"<<YGNodeLayoutGetWidth(child)<<",\"height\":"<<YGNodeLayoutGetHeight(child)<<"}";}
      std::cout<<"],\"itemStyles\":[";
      for(int j=0;j<count;j++){if(j)std::cout<<",";std::cout<<"{\"width\":";if(column&&automatic)std::cout<<"\"auto\"";else std::cout<<(column?20:negative||crossNegative?80:20);std::cout<<",\"height\":";if(!column&&automatic)std::cout<<"\"auto\"";else std::cout<<(column?negative||crossNegative?80:20:20);std::cout<<",\"flexBasis\":"<<(negative||crossNegative?80:20)<<",\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0";if(automatic&&j==0)std::cout<<(column?",\"maxWidth\":30":",\"maxHeight\":30");std::cout<<"}";}
      std::cout<<"]";
      if(reverse) {
        bool differs=false;
        for(int j=0;j<count;j++) { auto child=YGNodeGetChild(root,j); const int position=(j==0?(negative?92:32):0); const int x=(column==crossNegative)?position:0, y=(column!=crossNegative)?position:0; differs=differs||YGNodeLayoutGetLeft(child)!=x||YGNodeLayoutGetTop(child)!=y; }
        if(differs) {
          std::cout<<",\"classification\":\"css-safe-overflow-reverse\",\"comparisonLabel\":\"CSS overflow: physical start under reversal\",\"pibblBoxes\":[";
          for(int j=0;j<count;j++){auto child=YGNodeGetChild(root,j);if(j)std::cout<<",";const int position=j==0?(negative?92:32):0;std::cout<<"{\"x\":"<<((column==crossNegative)?position:0)<<",\"y\":"<<((column!=crossNegative)?position:0)<<",\"width\":"<<YGNodeLayoutGetWidth(child)<<",\"height\":"<<YGNodeLayoutGetHeight(child)<<"}";}
          std::cout<<"]";
        }
      }
      std::cout<<"}";YGNodeFreeRecursive(root);YGConfigFree(config);
    }
  }
}
static void percentageBoundsCases() {
  for(int axis=0;axis<2;axis++) for(int family=0;family<2;family++) for(int resized=0;resized<2;resized++) {
    const bool column=axis==1, cap=family==0;
    const int main=cap?(resized?240:200):(resized?140:100), basis=cap?40:80;
    auto config=YGConfigNew();YGConfigSetUseWebDefaults(config,false);YGConfigSetPointScaleFactor(config,0);YGConfigSetErrata(config,YGErrataNone);
    auto root=YGNodeNewWithConfig(config);YGNodeStyleSetWidth(root,column?100:main);YGNodeStyleSetHeight(root,column?main:100);YGNodeStyleSetFlexDirection(root,column?YGFlexDirectionColumn:YGFlexDirectionRow);YGNodeStyleSetGap(root,YGGutterAll,12);YGNodeStyleSetAlignItems(root,YGAlignFlexStart);YGNodeStyleSetAlignContent(root,YGAlignFlexStart);
    for(int j=0;j<2;j++) {
      auto child=YGNodeNewWithConfig(config);YGNodeStyleSetWidth(child,column?20:basis);YGNodeStyleSetHeight(child,column?basis:20);YGNodeStyleSetFlexBasis(child,basis);YGNodeStyleSetFlexGrow(child,cap?1:0);YGNodeStyleSetFlexShrink(child,cap?0:1);YGNodeStyleSetMinWidth(child,0);YGNodeStyleSetMinHeight(child,0);
      if(j==0){if(cap){if(column)YGNodeStyleSetMaxHeightPercent(child,25);else YGNodeStyleSetMaxWidthPercent(child,25);}else{if(column)YGNodeStyleSetMinHeightPercent(child,70);else YGNodeStyleSetMinWidthPercent(child,70);}}
      YGNodeInsertChild(root,child,j);
    }
    YGNodeCalculateLayout(root,YGUndefined,YGUndefined,YGDirectionLTR);
    std::cout<<",{\"name\":\"percent-"<<(cap?"cap":"floor")<<"-"<<(column?"column":"row")<<(resized?"-resized":"")<<"\",\"width\":"<<(column?100:main)<<",\"height\":"<<(column?main:100)<<",\"gap\":12,\"flexDirection\":\""<<(column?"column":"row")<<"\",\"flexWrap\":\"nowrap\",\"boxes\":[";
    for(int j=0;j<2;j++){auto child=YGNodeGetChild(root,j);if(j)std::cout<<",";std::cout<<"{\"x\":"<<YGNodeLayoutGetLeft(child)<<",\"y\":"<<YGNodeLayoutGetTop(child)<<",\"width\":"<<YGNodeLayoutGetWidth(child)<<",\"height\":"<<YGNodeLayoutGetHeight(child)<<"}";}
    std::cout<<"],\"itemStyles\":[";
    for(int j=0;j<2;j++){if(j)std::cout<<",";std::cout<<"{\"width\":"<<(column?20:basis)<<",\"height\":"<<(column?basis:20)<<",\"flexBasis\":"<<basis<<",\"flexGrow\":"<<(cap?1:0)<<",\"flexShrink\":"<<(cap?0:1)<<",\"minWidth\":";if(!cap&&j==0&&!column)std::cout<<"\"70%\"";else std::cout<<0;std::cout<<",\"minHeight\":";if(!cap&&j==0&&column)std::cout<<"\"70%\"";else std::cout<<0;if(cap&&j==0)std::cout<<(column?",\"maxHeight\":\"25%\"":",\"maxWidth\":\"25%\"");std::cout<<"}";}
    std::cout<<"]}";YGNodeFreeRecursive(root);YGConfigFree(config);
  }
}
static void wrappedAspectCases() {
  for(int axis=0;axis<2;axis++)for(int reverse=0;reverse<2;reverse++)for(int resized=0;resized<2;resized++) {
    const bool column=axis==1;const int main=resized?172:200;
    auto config=YGConfigNew();YGConfigSetUseWebDefaults(config,false);YGConfigSetPointScaleFactor(config,0);YGConfigSetErrata(config,YGErrataNone);
    auto root=YGNodeNewWithConfig(config);YGNodeStyleSetWidth(root,column?200:main);YGNodeStyleSetHeight(root,column?main:200);YGNodeStyleSetFlexDirection(root,column?YGFlexDirectionColumn:YGFlexDirectionRow);YGNodeStyleSetFlexWrap(root,reverse?YGWrapWrapReverse:YGWrapWrap);YGNodeStyleSetAlignItems(root,YGAlignFlexStart);YGNodeStyleSetAlignContent(root,YGAlignFlexStart);YGNodeStyleSetGap(root,YGGutterColumn,column?10:12);YGNodeStyleSetGap(root,YGGutterRow,column?12:10);
    for(int j=0;j<3;j++){auto child=YGNodeNewWithConfig(config);if(column)YGNodeStyleSetHeight(child,80);else YGNodeStyleSetWidth(child,80);YGNodeStyleSetFlexBasis(child,80);YGNodeStyleSetFlexGrow(child,1);YGNodeStyleSetFlexShrink(child,0);YGNodeStyleSetMinWidth(child,0);YGNodeStyleSetMinHeight(child,0);YGNodeStyleSetAspectRatio(child,column?.5:2);YGNodeInsertChild(root,child,j);}
    YGNodeCalculateLayout(root,YGUndefined,YGUndefined,YGDirectionLTR);
    std::cout<<",{\"name\":\"aspect-wrap-"<<(column?"column":"row")<<(reverse?"-reverse":"")<<(resized?"-resized":"")<<"\",\"width\":"<<(column?200:main)<<",\"height\":"<<(column?main:200)<<",\"gap\":12,\"flexDirection\":\""<<(column?"column":"row")<<"\",\"flexWrap\":\""<<(reverse?"wrap-reverse":"wrap")<<"\",\"containerStyle\":{\"alignContent\":\"flex-start\",\"alignItems\":\"flex-start\",\"rowGap\":"<<(column?12:10)<<",\"columnGap\":"<<(column?10:12)<<"},\"boxes\":[";
    for(int j=0;j<3;j++){auto child=YGNodeGetChild(root,j);if(j)std::cout<<",";std::cout<<"{\"x\":"<<YGNodeLayoutGetLeft(child)<<",\"y\":"<<YGNodeLayoutGetTop(child)<<",\"width\":"<<YGNodeLayoutGetWidth(child)<<",\"height\":"<<YGNodeLayoutGetHeight(child)<<"}";}
    std::cout<<"],\"itemStyles\":[";
    for(int j=0;j<3;j++){if(j)std::cout<<",";std::cout<<"{\"width\":"<<(column?"\"auto\"":"80")<<",\"height\":"<<(column?"80":"\"auto\"")<<",\"flexBasis\":80,\"flexGrow\":1,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"aspectRatio\":"<<(column?.5:2)<<"}";}
    std::cout<<"]}";YGNodeFreeRecursive(root);YGConfigFree(config);
  }
}
static void percentageGapCases() {
  for (int axis = 0; axis < 2; ++axis) {
    const bool column = axis == 1;
    for (int wrapIndex = 0; wrapIndex < 2; ++wrapIndex) {
      const bool wrap = wrapIndex == 1;
      for (int resizeIndex = 0; resizeIndex < 2; ++resizeIndex) {
        const bool resized = resizeIndex == 1;
        const float width = resized ? 360 : 300;
        const float height = resized ? 250 : 200;
        auto config = YGConfigNew();
        YGConfigSetUseWebDefaults(config, false);
        YGConfigSetPointScaleFactor(config, 0);
        YGConfigSetErrata(config, YGErrataNone);
        auto root = YGNodeNewWithConfig(config);
        YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
        YGNodeStyleSetWidth(root, width);
        YGNodeStyleSetHeight(root, height);
        YGNodeStyleSetFlexDirection(root, column ? YGFlexDirectionColumn : YGFlexDirectionRow);
        YGNodeStyleSetFlexWrap(root, wrap ? YGWrapWrap : YGWrapNoWrap);
        YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
        YGNodeStyleSetAlignContent(root, YGAlignFlexStart);
        YGNodeStyleSetPadding(root, YGEdgeLeft, 10);
        YGNodeStyleSetPadding(root, YGEdgeRight, 30);
        YGNodeStyleSetPadding(root, YGEdgeTop, 20);
        YGNodeStyleSetPadding(root, YGEdgeBottom, 40);
        YGNodeStyleSetGapPercent(root, YGGutterColumn, 10);
        YGNodeStyleSetGapPercent(root, YGGutterRow, 20);
        const int count = wrap ? 3 : 2;
        for (int item = 0; item < count; ++item) {
          auto child = YGNodeNewWithConfig(config);
          YGNodeStyleSetWidth(child, column ? 30 : 100);
          YGNodeStyleSetHeight(child, column ? 50 : 30);
          YGNodeStyleSetFlexBasis(child, column ? 50 : 100);
          YGNodeStyleSetFlexGrow(child, wrap ? 0 : 1);
          YGNodeStyleSetFlexShrink(child, 0);
          YGNodeStyleSetMinWidth(child, 0);
          YGNodeStyleSetMinHeight(child, 0);
          YGNodeInsertChild(root, child, item);
        }
        YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionLTR);
        std::cout << ",{\"name\":\"gap-percent-" << (column ? "column" : "row")
                  << '-' << (wrap ? "wrap" : "nowrap") << (resized ? "-resized" : "")
                  << "\",\"width\":" << width << ",\"height\":" << height
                  << ",\"gap\":0,\"flexDirection\":\"" << (column ? "column" : "row")
                  << "\",\"flexWrap\":\"" << (wrap ? "wrap" : "nowrap")
                  << "\",\"containerStyle\":{\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":40},\"alignContent\":\"flex-start\",\"alignItems\":\"flex-start\",\"rowGap\":\"20%\",\"columnGap\":\"10%\"},\"boxes\":[";
        for (int item = 0; item < count; ++item) {
          if (item) std::cout << ',';
          auto child = YGNodeGetChild(root, item);
          std::cout << "{\"x\":" << YGNodeLayoutGetLeft(child)
                    << ",\"y\":" << YGNodeLayoutGetTop(child)
                    << ",\"width\":" << YGNodeLayoutGetWidth(child)
                    << ",\"height\":" << YGNodeLayoutGetHeight(child) << '}';
        }
        std::cout << "],\"itemStyles\":[";
        for (int item = 0; item < count; ++item) {
          if (item) std::cout << ',';
          std::cout << "{\"width\":" << (column ? 30 : 100)
                    << ",\"height\":" << (column ? 50 : 30)
                    << ",\"flexBasis\":" << (column ? 50 : 100)
                    << ",\"flexGrow\":" << (wrap ? 0 : 1)
                    << ",\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}";
        }
        std::cout << "]}";
        YGNodeFreeRecursive(root);
        YGConfigFree(config);
      }
    }
  }
}


static void percentagePaddingCases() {
  for (int axis = 0; axis < 2; ++axis) {
    const bool column = axis == 1;
    for (int box = 0; box < 2; ++box) {
      const bool contentBox = box == 0;
      for (int resize = 0; resize < 2; ++resize) {
        const bool resized = resize == 1;
        const float rootWidth = resized ? 300 : 200;
        const float rootHeight = resized ? 180 : 120;
        const float aWidth = contentBox ? 80 : 150;
        const float aHeight = contentBox ? 60 : 100;
        const float aBasis = column ? aHeight : aWidth;
        auto config = YGConfigNew();
        YGConfigSetUseWebDefaults(config, false);
        YGConfigSetPointScaleFactor(config, 0);
        YGConfigSetErrata(config, YGErrataNone);
        auto root = YGNodeNewWithConfig(config);
        YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
        YGNodeStyleSetWidth(root, rootWidth);
        YGNodeStyleSetHeight(root, rootHeight);
        YGNodeStyleSetFlexDirection(root, column ? YGFlexDirectionColumn : YGFlexDirectionRow);
        YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
        YGNodeStyleSetAlignContent(root, YGAlignFlexStart);
        YGNodeStyleSetGap(root, YGGutterAll, 12);
        auto a = YGNodeNewWithConfig(config);
        YGNodeStyleSetBoxSizing(a, contentBox ? YGBoxSizingContentBox : YGBoxSizingBorderBox);
        YGNodeStyleSetPaddingPercent(a, YGEdgeLeft, 10);
        YGNodeStyleSetPaddingPercent(a, YGEdgeRight, 15);
        YGNodeStyleSetPaddingPercent(a, YGEdgeTop, 5);
        YGNodeStyleSetPaddingPercent(a, YGEdgeBottom, 10);
        YGNodeStyleSetWidth(a, aWidth);
        YGNodeStyleSetHeight(a, aHeight);
        YGNodeStyleSetFlexBasis(a, aBasis);
        YGNodeStyleSetFlexGrow(a, 0);
        YGNodeStyleSetFlexShrink(a, 0);
        YGNodeStyleSetMinWidth(a, 0);
        YGNodeStyleSetMinHeight(a, 0);
        YGNodeInsertChild(root, a, 0);
        auto b = YGNodeNewWithConfig(config);
        YGNodeStyleSetWidth(b, 10);
        YGNodeStyleSetHeight(b, 10);
        YGNodeStyleSetFlexBasis(b, 10);
        YGNodeStyleSetFlexGrow(b, 0);
        YGNodeStyleSetFlexShrink(b, 0);
        YGNodeStyleSetMinWidth(b, 0);
        YGNodeStyleSetMinHeight(b, 0);
        YGNodeInsertChild(root, b, 1);
        YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionLTR);
        std::cout << ",{\"name\":\"padding-percent-" << (column ? "column" : "row")
                  << '-' << (contentBox ? "content-box" : "border-box-basis")
                  << (resized ? "-resized" : "") << "\",\"width\":" << rootWidth
                  << ",\"height\":" << rootHeight << ",\"gap\":12,\"flexDirection\":\""
                  << (column ? "column" : "row")
                  << "\",\"flexWrap\":\"nowrap\",\"containerStyle\":{\"alignContent\":\"flex-start\",\"alignItems\":\"flex-start\"},\"boxes\":[";
        for (int item = 0; item < 2; ++item) {
          if (item) std::cout << ',';
          auto child = YGNodeGetChild(root, item);
          std::cout << "{\"x\":" << YGNodeLayoutGetLeft(child) << ",\"y\":" << YGNodeLayoutGetTop(child)
                    << ",\"width\":" << YGNodeLayoutGetWidth(child) << ",\"height\":" << YGNodeLayoutGetHeight(child) << '}';
        }
        std::cout << "],\"itemStyles\":[{\"boxSizing\":\"" << (contentBox ? "content-box" : "border-box")
                  << "\",\"padding\":{\"left\":\"10%\",\"right\":\"15%\",\"top\":\"5%\",\"bottom\":\"10%\"}"
                  << ",\"width\":" << aWidth << ",\"height\":" << aHeight << ",\"flexBasis\":" << aBasis
                  << ",\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"width\":10,\"height\":10,\"flexBasis\":10,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
        YGNodeFreeRecursive(root); YGConfigFree(config);
      }
    }
  }
}

// Validation-only harness: the proposed function has a leading comma for a reference emitter.

static void wrappedCrossPercentageCases() {
  for (int axis = 0; axis < 2; ++axis) {
    const bool column = axis == 1;
    for (int bound = 0; bound < 2; ++bound) {
      const bool minimum = bound == 0;
      for (int resize = 0; resize < 2; ++resize) {
        const bool resized = resize == 1;
        const float cross = resized ? 160 : 100;
        auto config = YGConfigNew();
        YGConfigSetUseWebDefaults(config, false);
        YGConfigSetPointScaleFactor(config, 0);
        YGConfigSetErrata(config, YGErrataNone);
        auto root = YGNodeNewWithConfig(config);
        YGNodeStyleSetWidth(root, column ? cross : 200);
        YGNodeStyleSetHeight(root, column ? 200 : cross);
        YGNodeStyleSetFlexDirection(root, column ? YGFlexDirectionColumn : YGFlexDirectionRow);
        YGNodeStyleSetFlexWrap(root, YGWrapWrap);
        YGNodeStyleSetAlignItems(root, YGAlignStretch);
        YGNodeStyleSetAlignContent(root, YGAlignFlexStart);
        YGNodeStyleSetGap(root, YGGutterAll, 12);
        for (int item = 0; item < 3; ++item) {
          auto child = YGNodeNewWithConfig(config);
          if (column) YGNodeStyleSetHeight(child, 80); else YGNodeStyleSetWidth(child, 80);
          YGNodeStyleSetFlexBasis(child, 80);
          YGNodeStyleSetFlexGrow(child, 0);
          YGNodeStyleSetFlexShrink(child, 0);
          YGNodeStyleSetMinWidth(child, 0);
          YGNodeStyleSetMinHeight(child, 0);
          if (item == 0) {
            if (column) {
              if (minimum) YGNodeStyleSetMinWidthPercent(child, 60);
              else YGNodeStyleSetMaxWidthPercent(child, 25);
            } else {
              if (minimum) YGNodeStyleSetMinHeightPercent(child, 60);
              else YGNodeStyleSetMaxHeightPercent(child, 25);
            }
          } else if (item == 1) {
            if (column) YGNodeStyleSetWidth(child, 40); else YGNodeStyleSetHeight(child, 40);
          } else {
            if (column) YGNodeStyleSetWidth(child, 20); else YGNodeStyleSetHeight(child, 20);
          }
          YGNodeInsertChild(root, child, item);
        }
        YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionLTR);
        std::cout << ",{\"name\":\"cross-percent-" << (column ? "column" : "row")
                  << '-' << (minimum ? "min" : "max") << (resized ? "-resized" : "")
                  << "\",\"width\":" << (column ? cross : 200) << ",\"height\":" << (column ? 200 : cross)
                  << ",\"gap\":12,\"flexDirection\":\"" << (column ? "column" : "row")
                  << "\",\"flexWrap\":\"wrap\",\"containerStyle\":{\"alignItems\":\"stretch\",\"alignContent\":\"flex-start\"},\"boxes\":[";
        for (int item = 0; item < 3; ++item) {
          if (item) std::cout << ',';
          auto child = YGNodeGetChild(root, item);
          std::cout << "{\"x\":" << YGNodeLayoutGetLeft(child) << ",\"y\":" << YGNodeLayoutGetTop(child)
                    << ",\"width\":" << YGNodeLayoutGetWidth(child) << ",\"height\":" << YGNodeLayoutGetHeight(child) << '}';
        }
        std::cout << "],\"itemStyles\":[{";
        if (column) std::cout << "\"width\":\"auto\",\"height\":80";
        else std::cout << "\"width\":80,\"height\":\"auto\"";
        std::cout << ",\"flexBasis\":80,\"flexGrow\":0,\"flexShrink\":0,\"min" << (column ? "Height\":0" : "Width\":0");
        if (minimum) std::cout << ",\"min" << (column ? "Width\":\"60%\"" : "Height\":\"60%\"");
        else std::cout << ",\"min" << (column ? "Width\":0,\"maxWidth\":\"25%\"" : "Height\":0,\"maxHeight\":\"25%\"");
        std::cout << "},{\"width\":" << (column ? 40 : 80) << ",\"height\":" << (column ? 80 : 40)
                  << ",\"flexBasis\":80,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}"
                  << ",{\"width\":" << (column ? 20 : 80) << ",\"height\":" << (column ? 80 : 20)
                  << ",\"flexBasis\":80,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
        YGNodeFreeRecursive(root); YGConfigFree(config);
      }
    }
  }
}

// Validation-only harness; function records begin with a comma for the reference emitter.

static void percentageMarginCases() {
  for (int axis = 0; axis < 2; ++axis) {
    const bool column = axis == 1;
    for (int resize = 0; resize < 2; ++resize) {
      const bool resized = resize == 1;
      const float width = resized ? 360 : 300;
      const float height = resized ? 250 : 200;
      auto config = YGConfigNew();
      YGConfigSetUseWebDefaults(config, false);
      YGConfigSetPointScaleFactor(config, 0);
      YGConfigSetErrata(config, YGErrataNone);
      auto root = YGNodeNewWithConfig(config);
      YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
      YGNodeStyleSetWidth(root, width);
      YGNodeStyleSetHeight(root, height);
      YGNodeStyleSetFlexDirection(root, column ? YGFlexDirectionColumn : YGFlexDirectionRow);
      YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
      YGNodeStyleSetAlignContent(root, YGAlignFlexStart);
      YGNodeStyleSetPadding(root, YGEdgeLeft, 10);
      YGNodeStyleSetPadding(root, YGEdgeRight, 30);
      YGNodeStyleSetPadding(root, YGEdgeTop, 20);
      YGNodeStyleSetPadding(root, YGEdgeBottom, 40);
      auto a = YGNodeNewWithConfig(config);
      YGNodeStyleSetWidth(a, 60); YGNodeStyleSetHeight(a, 30);
      YGNodeStyleSetFlexBasis(a, column ? 30 : 60);
      YGNodeStyleSetFlexGrow(a, 0); YGNodeStyleSetFlexShrink(a, 0);
      YGNodeStyleSetMinWidth(a, 0); YGNodeStyleSetMinHeight(a, 0);
      YGNodeStyleSetMarginPercent(a, YGEdgeLeft, 10); YGNodeStyleSetMarginPercent(a, YGEdgeRight, 15);
      YGNodeStyleSetMarginPercent(a, YGEdgeTop, 5); YGNodeStyleSetMarginPercent(a, YGEdgeBottom, 20);
      YGNodeInsertChild(root, a, 0);
      auto b = YGNodeNewWithConfig(config);
      YGNodeStyleSetWidth(b, 136); YGNodeStyleSetHeight(b, 81);
      YGNodeStyleSetFlexBasis(b, column ? 81 : 136);
      YGNodeStyleSetFlexGrow(b, 0); YGNodeStyleSetFlexShrink(b, 0);
      YGNodeStyleSetMinWidth(b, 0); YGNodeStyleSetMinHeight(b, 0);
      YGNodeInsertChild(root, b, 1);
      YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionLTR);
      std::cout << ",{\"name\":\"margin-percent-" << (column ? "column" : "row")
                << "-nowrap" << (resized ? "-resized" : "") << "\",\"width\":" << width
                << ",\"height\":" << height << ",\"gap\":0,\"flexDirection\":\""
                << (column ? "column" : "row")
                << "\",\"flexWrap\":\"nowrap\",\"containerStyle\":{\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":40},\"alignContent\":\"flex-start\",\"alignItems\":\"flex-start\"},\"boxes\":[";
      for (int item = 0; item < 2; ++item) {
        if (item) std::cout << ',';
        auto child = YGNodeGetChild(root, item);
        std::cout << "{\"x\":" << YGNodeLayoutGetLeft(child) << ",\"y\":" << YGNodeLayoutGetTop(child)
                  << ",\"width\":" << YGNodeLayoutGetWidth(child) << ",\"height\":" << YGNodeLayoutGetHeight(child) << '}';
      }
      std::cout << "],\"itemStyles\":[{\"width\":60,\"height\":30,\"flexBasis\":" << (column ? 30 : 60)
                << ",\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"marginLeft\":\"10%\",\"marginRight\":\"15%\",\"marginTop\":\"5%\",\"marginBottom\":\"20%\"},{\"width\":136,\"height\":81,\"flexBasis\":" << (column ? 81 : 136)
                << ",\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
      YGNodeFreeRecursive(root); YGConfigFree(config);
    }
  }
}

static void setMainCross(YGNodeRef node, bool column, float main, float cross) {
  if (column) { YGNodeStyleSetHeight(node, main); YGNodeStyleSetWidth(node, cross); }
  else { YGNodeStyleSetWidth(node, main); YGNodeStyleSetHeight(node, cross); }
}
static void setMinZero(YGNodeRef node) { YGNodeStyleSetMinWidth(node, 0); YGNodeStyleSetMinHeight(node, 0); }
static void printBox(YGNodeRef node, float ox=0, float oy=0) {
  std::cout << "{\"x\":" << ox + YGNodeLayoutGetLeft(node) << ",\"y\":" << oy + YGNodeLayoutGetTop(node)
            << ",\"width\":" << YGNodeLayoutGetWidth(node) << ",\"height\":" << YGNodeLayoutGetHeight(node) << '}';
}
static void nestedPercentageGapCases() {
  for (int axis = 0; axis < 2; ++axis) {
    const bool column = axis == 1;
    for (int wrapIndex = 0; wrapIndex < 2; ++wrapIndex) {
      const bool wrap = wrapIndex == 1;
      for (int resize = 0; resize < 2; ++resize) {
        const bool resized = resize == 1;
        const float main = wrap ? (resized ? 180 : 300) : (resized ? 240 : 360);
        const float cross = 240;
        auto config = YGConfigNew();
        YGConfigSetUseWebDefaults(config, false);
        YGConfigSetPointScaleFactor(config, 0);
        YGConfigSetErrata(config, YGErrataNone);
        auto root = YGNodeNewWithConfig(config);
        setMainCross(root, column, main, cross);
        YGNodeStyleSetFlexDirection(root, column ? YGFlexDirectionColumn : YGFlexDirectionRow);
        YGNodeStyleSetFlexWrap(root, wrap ? YGWrapWrap : YGWrapNoWrap);
        YGNodeStyleSetGap(root, YGGutterAll, 12);
        YGNodeStyleSetAlignItems(root, YGAlignStretch);
        YGNodeStyleSetAlignContent(root, YGAlignFlexStart);
        for (int index = 0; index < 4; ++index) {
          auto child = YGNodeNewWithConfig(config);
          YGNodeStyleSetFlexBasis(child, 80); YGNodeStyleSetFlexGrow(child, 1); YGNodeStyleSetFlexShrink(child, 1); setMinZero(child);
          if (index < 3) {
            // Inner Flex card: pre-allocation main80/cross60, itself grows in the outer owner.
            YGNodeStyleSetFlexDirection(child, column ? YGFlexDirectionColumn : YGFlexDirectionRow);
            setMainCross(child, column, 80, 60);
            YGNodeStyleSetGapPercent(child, YGGutterAll, 10);
            for (int leafIndex = 0; leafIndex < 2; ++leafIndex) {
              auto leaf = YGNodeNewWithConfig(config);
              if (column) {
                YGNodeStyleSetFlexBasisPercent(leaf, 40); YGNodeStyleSetHeightPercent(leaf, 40); YGNodeStyleSetWidthPercent(leaf, 100);
              } else {
                YGNodeStyleSetFlexBasisPercent(leaf, 40); YGNodeStyleSetWidthPercent(leaf, 40); YGNodeStyleSetHeightPercent(leaf, 100);
              }
              YGNodeStyleSetFlexGrow(leaf, 0); YGNodeStyleSetFlexShrink(leaf, 0); setMinZero(leaf);
              YGNodeInsertChild(child, leaf, leafIndex);
            }
          } else {
            setMainCross(child, column, 80, 36);
          }
          YGNodeInsertChild(root, child, index);
        }
        YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionLTR);
        std::cout << ",{\"name\":\"nested-percent-gap-" << (column ? "column" : "row") << '-' << (wrap ? "wrap" : "nowrap") << (resized ? "-resized" : "")
                  << "\",\"width\":" << (column ? cross : main) << ",\"height\":" << (column ? main : cross)
                  << ",\"gap\":12,\"flexDirection\":\"" << (column ? "column" : "row") << "\",\"flexWrap\":\"" << (wrap ? "wrap" : "nowrap")
                  << "\",\"containerStyle\":{\"alignItems\":\"stretch\",\"alignContent\":\"flex-start\"},\"boxes\":[";
        for (int index = 0; index < 4; ++index) { if (index) std::cout << ','; printBox(YGNodeGetChild(root,index)); }
        auto a = YGNodeGetChild(root,0);
        std::cout << "],\"nestedBoxes\":[";
        for (int leafIndex = 0; leafIndex < 2; ++leafIndex) { if (leafIndex) std::cout << ','; printBox(YGNodeGetChild(a,leafIndex),YGNodeLayoutGetLeft(a),YGNodeLayoutGetTop(a)); }
        std::cout << "],\"itemStyles\":[";
        for (int index = 0; index < 4; ++index) {
          if (index) std::cout << ',';
          if (index < 3) std::cout << "{\"width\":" << (column ? 60 : 80) << ",\"height\":" << (column ? 80 : 60) << ",\"flexBasis\":80,\"flexGrow\":1,\"flexShrink\":1,\"minWidth\":0,\"minHeight\":0}";
          else std::cout << "{\"width\":" << (column ? 36 : 80) << ",\"height\":" << (column ? 80 : 36) << ",\"flexBasis\":80,\"flexGrow\":1,\"flexShrink\":1,\"minWidth\":0,\"minHeight\":0}";
        }
        std::cout << "]}";
        YGNodeFreeRecursive(root); YGConfigFree(config);
      }
    }
  }
}
static void nestedCrossMinimumCases() {
  for (int resize = 0; resize < 2; ++resize) {
    const bool resized = resize == 1;
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false);
    YGConfigSetPointScaleFactor(config, 0);
    YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(root, 200);
    YGNodeStyleSetHeight(root, resized ? 160 : 100);
    YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow);
    YGNodeStyleSetFlexWrap(root, YGWrapWrap);
    YGNodeStyleSetGap(root, YGGutterAll, 12);
    YGNodeStyleSetAlignItems(root, YGAlignStretch);
    YGNodeStyleSetAlignContent(root, YGAlignFlexStart);

    auto nested = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(nested, 80);
    YGNodeStyleSetFlexBasis(nested, 80);
    YGNodeStyleSetFlexGrow(nested, 0);
    YGNodeStyleSetFlexShrink(nested, 0);
    YGNodeStyleSetFlexDirection(nested, YGFlexDirectionRow);
    YGNodeStyleSetAlignItems(nested, YGAlignFlexStart);
    setMinZero(nested);
    YGNodeStyleSetMinHeightPercent(nested, 60);
    for (int leafIndex = 0; leafIndex < 2; ++leafIndex) {
      auto leaf = YGNodeNewWithConfig(config);
      YGNodeStyleSetWidth(leaf, 40);
      YGNodeStyleSetHeight(leaf, 20);
      YGNodeStyleSetFlexGrow(leaf, 0);
      YGNodeStyleSetFlexShrink(leaf, 0);
      setMinZero(leaf);
      YGNodeInsertChild(nested, leaf, leafIndex);
    }
    YGNodeInsertChild(root, nested, 0);
    for (int index = 1; index < 3; ++index) {
      auto child = YGNodeNewWithConfig(config);
      YGNodeStyleSetWidth(child, 80);
      YGNodeStyleSetHeight(child, index == 1 ? 40 : 20);
      YGNodeStyleSetFlexBasis(child, 80);
      YGNodeStyleSetFlexGrow(child, 0);
      YGNodeStyleSetFlexShrink(child, 0);
      setMinZero(child);
      YGNodeInsertChild(root, child, index);
    }
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionLTR);
    auto a = YGNodeGetChild(root, 0);
    std::cout << ",{\"name\":\"nested-cross-min-row" << (resized ? "-resized" : "")
              << "\",\"width\":200,\"height\":" << (resized ? 160 : 100)
              << ",\"gap\":12,\"flexDirection\":\"row\",\"flexWrap\":\"wrap\",\"nestedCrossMinFixture\":true,\"containerStyle\":{\"alignItems\":\"stretch\",\"alignContent\":\"flex-start\"},\"boxes\":[";
    for (int index = 0; index < 3; ++index) { if (index) std::cout << ','; printBox(YGNodeGetChild(root, index)); }
    std::cout << "],\"nestedCrossBoxes\":[";
    for (int leafIndex = 0; leafIndex < 2; ++leafIndex) { if (leafIndex) std::cout << ','; printBox(YGNodeGetChild(a, leafIndex), YGNodeLayoutGetLeft(a), YGNodeLayoutGetTop(a)); }
    std::cout << "],\"nestedOwnerStyle\":{\"width\":80,\"flexBasis\":80,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":\"60%\",\"flexDirection\":\"row\",\"alignItems\":\"flex-start\"},\"nestedItemStyles\":[{\"width\":40,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"width\":40,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}],\"itemStyles\":[{\"width\":80,\"height\":\"auto\",\"flexBasis\":80,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":\"60%\"},{\"width\":80,\"height\":40,\"flexBasis\":80,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"width\":80,\"height\":20,\"flexBasis\":80,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}] }";
    YGNodeFreeRecursive(root);
    YGConfigFree(config);
  }
}

static void wrappedPercentageMarginCases() {
  for (int axis = 0; axis < 2; ++axis) {
    const bool column = axis == 1;
    for (int resize = 0; resize < 2; ++resize) {
      const bool resized = resize == 1;
      const float width = resized ? 360 : 300;
      const float height = resized ? 250 : 200;
      auto config = YGConfigNew();
      YGConfigSetUseWebDefaults(config, false);
      YGConfigSetPointScaleFactor(config, 0);
      YGConfigSetErrata(config, YGErrataNone);
      auto root = YGNodeNewWithConfig(config);
      YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
      YGNodeStyleSetWidth(root, width); YGNodeStyleSetHeight(root, height);
      YGNodeStyleSetFlexDirection(root, column ? YGFlexDirectionColumn : YGFlexDirectionRow);
      YGNodeStyleSetFlexWrap(root, YGWrapWrap);
      YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetAlignContent(root, YGAlignFlexStart);
      YGNodeStyleSetPadding(root, YGEdgeLeft, 10); YGNodeStyleSetPadding(root, YGEdgeRight, 30);
      YGNodeStyleSetPadding(root, YGEdgeTop, 20); YGNodeStyleSetPadding(root, YGEdgeBottom, 40);
      auto a = YGNodeNewWithConfig(config);
      YGNodeStyleSetWidth(a, 60); YGNodeStyleSetHeight(a, 30);
      YGNodeStyleSetFlexBasis(a, column ? 30 : 60); YGNodeStyleSetFlexGrow(a, 0); YGNodeStyleSetFlexShrink(a, 0);
      YGNodeStyleSetMinWidth(a, 0); YGNodeStyleSetMinHeight(a, 0);
      YGNodeStyleSetMarginPercent(a, YGEdgeLeft, 10); YGNodeStyleSetMarginPercent(a, YGEdgeRight, 15);
      YGNodeStyleSetMarginPercent(a, YGEdgeTop, 5); YGNodeStyleSetMarginPercent(a, YGEdgeBottom, 20);
      auto b = YGNodeNewWithConfig(config);
      YGNodeStyleSetWidth(b, 136); YGNodeStyleSetHeight(b, 81);
      YGNodeStyleSetFlexBasis(b, column ? 81 : 136); YGNodeStyleSetFlexGrow(b, 0); YGNodeStyleSetFlexShrink(b, 0);
      YGNodeStyleSetMinWidth(b, 0); YGNodeStyleSetMinHeight(b, 0);
      YGNodeInsertChild(root, a, 0); YGNodeInsertChild(root, b, 1);
      YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionLTR);
      const float pibblAX = column && !resized ? 36 : column ? 42 : resized ? 42 : 36;
      const float pibblAY = resized ? 36 : 33;
      const float pibblBX = column && !resized ? 135 : column ? 150 : resized ? 150 : 10;
      const float pibblBY = column ? 20 : resized ? 20 : 115;
      std::cout << ",{\"name\":\"margin-percent-" << (column ? "column" : "row") << "-wrap" << (resized ? "-resized" : "")
                << "\",\"width\":" << width << ",\"height\":" << height << ",\"gap\":0,\"flexDirection\":\"" << (column ? "column" : "row")
                << "\",\"flexWrap\":\"wrap\",\"containerStyle\":{\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":40},\"alignContent\":\"flex-start\",\"alignItems\":\"flex-start\"},\"boxes\":[";
      for (int item = 0; item < 2; ++item) {
        if (item) std::cout << ',';
        auto child = YGNodeGetChild(root, item);
        std::cout << "{\"x\":" << YGNodeLayoutGetLeft(child) << ",\"y\":" << YGNodeLayoutGetTop(child) << ",\"width\":" << YGNodeLayoutGetWidth(child) << ",\"height\":" << YGNodeLayoutGetHeight(child) << '}';
      }
      std::cout << "],\"pibblBoxes\":[{\"x\":" << pibblAX << ",\"y\":" << pibblAY << ",\"width\":60,\"height\":30},{\"x\":" << pibblBX << ",\"y\":" << pibblBY << ",\"width\":136,\"height\":81}]"
                << ",\"classification\":\"preserved-physical-margin-offset\",\"comparisonLabel\":\"Pibbl preserves the numeric leading cross-margin offset; Yoga wrapped cross-line placement omits it. Classified allocation difference, not a parity claim.\""
                << ",\"itemStyles\":[{\"width\":60,\"height\":30,\"flexBasis\":" << (column ? 30 : 60) << ",\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"marginLeft\":\"10%\",\"marginRight\":\"15%\",\"marginTop\":\"5%\",\"marginBottom\":\"20%\"},{\"width\":136,\"height\":81,\"flexBasis\":" << (column ? 81 : 136) << ",\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
      YGNodeFreeRecursive(root); YGConfigFree(config);
    }
  }
}

static void wrappedReversePercentageMarginCases() {
  for (int axis = 0; axis < 2; ++axis) {
    const bool column = axis == 1;
    for (int resize = 0; resize < 2; ++resize) {
      const bool resized = resize == 1;
      const float width = resized ? 360 : 300;
      const float height = resized ? 250 : 200;
      auto config = YGConfigNew();
      YGConfigSetUseWebDefaults(config, false);
      YGConfigSetPointScaleFactor(config, 0);
      YGConfigSetErrata(config, YGErrataNone);
      auto root = YGNodeNewWithConfig(config);
      YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
      YGNodeStyleSetWidth(root, width); YGNodeStyleSetHeight(root, height);
      YGNodeStyleSetFlexDirection(root, column ? YGFlexDirectionColumn : YGFlexDirectionRow);
      YGNodeStyleSetFlexWrap(root, YGWrapWrapReverse);
      YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetAlignContent(root, YGAlignFlexStart);
      YGNodeStyleSetPadding(root, YGEdgeLeft, 10); YGNodeStyleSetPadding(root, YGEdgeRight, 30);
      YGNodeStyleSetPadding(root, YGEdgeTop, 20); YGNodeStyleSetPadding(root, YGEdgeBottom, 40);
      auto a = YGNodeNewWithConfig(config);
      YGNodeStyleSetWidth(a, 60); YGNodeStyleSetHeight(a, 30);
      YGNodeStyleSetFlexBasis(a, column ? 30 : 60); YGNodeStyleSetFlexGrow(a, 0); YGNodeStyleSetFlexShrink(a, 0);
      YGNodeStyleSetMinWidth(a, 0); YGNodeStyleSetMinHeight(a, 0);
      YGNodeStyleSetMarginPercent(a, YGEdgeLeft, 10); YGNodeStyleSetMarginPercent(a, YGEdgeRight, 15);
      YGNodeStyleSetMarginPercent(a, YGEdgeTop, 5); YGNodeStyleSetMarginPercent(a, YGEdgeBottom, 20);
      auto b = YGNodeNewWithConfig(config);
      YGNodeStyleSetWidth(b, 136); YGNodeStyleSetHeight(b, 81);
      YGNodeStyleSetFlexBasis(b, column ? 81 : 136); YGNodeStyleSetFlexGrow(b, 0); YGNodeStyleSetFlexShrink(b, 0);
      YGNodeStyleSetMinWidth(b, 0); YGNodeStyleSetMinHeight(b, 0);
      YGNodeInsertChild(root, a, 0); YGNodeInsertChild(root, b, 1);
      YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionLTR);
      std::cout << ",{\"name\":\"margin-percent-" << (column ? "column" : "row") << "-wrap-reverse" << (resized ? "-resized" : "")
                << "\",\"width\":" << width << ",\"height\":" << height << ",\"gap\":0,\"flexDirection\":\"" << (column ? "column" : "row")
                << "\",\"flexWrap\":\"wrap-reverse\",\"containerStyle\":{\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":40},\"alignContent\":\"flex-start\",\"alignItems\":\"flex-start\"},\"boxes\":[";
      for (int item = 0; item < 2; ++item) {
        if (item) std::cout << ',';
        auto child = YGNodeGetChild(root, item);
        std::cout << "{\"x\":" << YGNodeLayoutGetLeft(child) << ",\"y\":" << YGNodeLayoutGetTop(child) << ",\"width\":" << YGNodeLayoutGetWidth(child) << ",\"height\":" << YGNodeLayoutGetHeight(child) << '}';
      }
      const int ax = column ? (resized ? 222 : 171) : (resized ? 42 : 36);
      const int ay = column ? (resized ? 36 : 33) : (resized ? 116 : 78);
      const int bx = column ? (resized ? 54 : 9) : (resized ? 150 : 10);
      const int by = column ? 20 : (resized ? 129 : -16);
      std::cout << "],\"classification\":\"preserved-physical-margin-offset\",\"comparisonLabel\":\"Preserved Pibbl numeric wrap-reverse offsets; Yoga differs (not parity)\",\"pibblBoxes\":[{\"x\":" << ax << ",\"y\":" << ay << ",\"width\":60,\"height\":30},{\"x\":" << bx << ",\"y\":" << by << ",\"width\":136,\"height\":81}";
      std::cout << "],\"itemStyles\":[{\"width\":60,\"height\":30,\"flexBasis\":" << (column ? 30 : 60) << ",\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"marginLeft\":\"10%\",\"marginRight\":\"15%\",\"marginTop\":\"5%\",\"marginBottom\":\"20%\"},{\"width\":136,\"height\":81,\"flexBasis\":" << (column ? 81 : 136) << ",\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
      YGNodeFreeRecursive(root); YGConfigFree(config);
    }
  }
}

static void layoutDirectionCases() {
  const YGFlexDirection directions[] = {YGFlexDirectionRow,YGFlexDirectionRowReverse,YGFlexDirectionColumn,YGFlexDirectionColumnReverse};
  const char* names[] = {"row", "row-reverse", "column", "column-reverse"};
  for (int axis = 0; axis < 4; ++axis) for (int rtl = 0; rtl < 2; ++rtl) {
    auto config=YGConfigNew(); YGConfigSetUseWebDefaults(config,false); YGConfigSetPointScaleFactor(config,0); YGConfigSetErrata(config,YGErrataNone);
    auto root=YGNodeNewWithConfig(config); YGNodeStyleSetWidth(root,240); YGNodeStyleSetHeight(root,120); YGNodeStyleSetFlexDirection(root,directions[axis]); YGNodeStyleSetAlignItems(root,YGAlignFlexStart); YGNodeStyleSetJustifyContent(root,YGJustifyFlexStart); YGNodeStyleSetGap(root,YGGutterAll,12);
    auto a=YGNodeNewWithConfig(config); YGNodeStyleSetWidth(a,40); YGNodeStyleSetHeight(a,24); YGNodeStyleSetFlexShrink(a,0); YGNodeStyleSetMinWidth(a,0); YGNodeStyleSetMinHeight(a,0); YGNodeStyleSetMargin(a,YGEdgeLeft,8); YGNodeStyleSetMargin(a,YGEdgeRight,20); YGNodeStyleSetMargin(a,YGEdgeTop,3); YGNodeStyleSetMargin(a,YGEdgeBottom,7);
    auto b=YGNodeNewWithConfig(config); YGNodeStyleSetWidth(b,30); YGNodeStyleSetHeight(b,20); YGNodeStyleSetFlexShrink(b,0); YGNodeStyleSetMinWidth(b,0); YGNodeStyleSetMinHeight(b,0); YGNodeStyleSetMargin(b,YGEdgeLeft,5); YGNodeStyleSetMargin(b,YGEdgeRight,9); YGNodeStyleSetMargin(b,YGEdgeTop,2); YGNodeStyleSetMargin(b,YGEdgeBottom,4);
    YGNodeInsertChild(root,a,0); YGNodeInsertChild(root,b,1); YGNodeCalculateLayout(root,YGUndefined,YGUndefined,rtl?YGDirectionRTL:YGDirectionLTR);
    std::cout << ",{\"name\":\"layout-direction-" << names[axis] << '-' << (rtl?"rtl":"ltr") << "\",\"width\":240,\"height\":120,\"gap\":12,\"flexDirection\":\"" << names[axis] << "\",\"flexWrap\":\"nowrap\",\"layoutDirection\":\"" << (rtl?"rtl":"ltr") << "\",\"containerStyle\":{\"alignItems\":\"flex-start\",\"justifyContent\":\"flex-start\"},\"boxes\":["; printBox(a); std::cout << ','; printBox(b); std::cout << "],\"itemStyles\":[{\"width\":40,\"height\":24,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"marginLeft\":8,\"marginRight\":20,\"marginTop\":3,\"marginBottom\":7},{\"width\":30,\"height\":20,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"marginLeft\":5,\"marginRight\":9,\"marginTop\":2,\"marginBottom\":4}]}";
    YGNodeFreeRecursive(root);YGConfigFree(config);
  }
}

static void logicalMarginCases() {
  // Start is an explicit numeric zero; End is a percentage. Both override shorthand
  // and the direction-mapped physical edge regardless of authoring order.
  for (int start = 0; start < 2; ++start) for (int rtl = 0; rtl < 2; ++rtl) for (int logicalFirst = 0; logicalFirst < 2; ++logicalFirst) {
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(root, 200); YGNodeStyleSetHeight(root, 80); YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow);
    YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetJustifyContent(root, YGJustifyFlexStart);
    auto child = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(child, 40); YGNodeStyleSetHeight(child, 20); YGNodeStyleSetFlexShrink(child, 0);
    YGNodeStyleSetMinWidth(child, 0); YGNodeStyleSetMinHeight(child, 0);
    auto physical = [&]() {
      YGNodeStyleSetMargin(child, YGEdgeAll, 5);
      YGNodeStyleSetMargin(child, YGEdgeLeft, 8);
      YGNodeStyleSetMargin(child, YGEdgeRight, 20);
    };
    auto logical = [&]() {
      if (start) YGNodeStyleSetMargin(child, YGEdgeStart, 0);
      else YGNodeStyleSetMarginPercent(child, YGEdgeEnd, -10);
    };
    if (logicalFirst) { logical(); physical(); } else { physical(); logical(); }
    YGNodeInsertChild(root, child, 0);
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, rtl ? YGDirectionRTL : YGDirectionLTR);
    std::cout << ",{\"name\":\"logical-margin-" << (start ? "start-zero" : "end-percent") << '-' << (rtl ? "rtl" : "ltr") << (logicalFirst ? "-logical-first" : "-logical-last")
              << "\",\"width\":200,\"height\":80,\"gap\":0,\"flexDirection\":\"row\",\"flexWrap\":\"nowrap\",\"layoutDirection\":\"" << (rtl ? "rtl" : "ltr")
              << "\",\"containerStyle\":{\"alignItems\":\"flex-start\",\"justifyContent\":\"flex-start\"},\"boxes\":[";
    printBox(child);
    std::cout << "],\"itemStyles\":[{\"width\":40,\"height\":20,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"margin\":5,\"marginLeft\":8,\"marginRight\":20,\"" << (start ? "marginStart\":0" : "marginEnd\":\"-10%\"") << "}]";
    if (rtl) {
      const int pibblX = start ? 160 : 140;
      std::cout << ",\"classification\":\"preserved-physical-logical-conflict\",\"comparisonLabel\":\"Pibbl preserves declared 40px width under RTL logical/physical margin conflict; Yoga reports a different outer width.\",\"pibblBoxes\":[{\"x\":" << pibblX << ",\"y\":5,\"width\":40,\"height\":20}]";
    }
    std::cout << '}';
    YGNodeFreeRecursive(root); YGConfigFree(config);
  }
}


static void logicalPaddingCases() {
  // Logical inline padding overrides shorthand and the direction-mapped physical edge.
  // The percentage resolves against the definite 200px parent width, including vertical layout.
  for (int start = 0; start < 2; ++start) for (int rtl = 0; rtl < 2; ++rtl) for (int logicalFirst = 0; logicalFirst < 2; ++logicalFirst) {
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(root, 200); YGNodeStyleSetHeight(root, 100); YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow);
    YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetJustifyContent(root, YGJustifyFlexStart);
    auto child = YGNodeNewWithConfig(config);
    YGNodeStyleSetBoxSizing(child, YGBoxSizingBorderBox); YGNodeStyleSetWidth(child, 100); YGNodeStyleSetHeight(child, 60);
    YGNodeStyleSetFlexShrink(child, 0); YGNodeStyleSetMinWidth(child, 0); YGNodeStyleSetMinHeight(child, 0);
    auto physical = [&]() {
      YGNodeStyleSetPadding(child, YGEdgeAll, 5);
      YGNodeStyleSetPadding(child, YGEdgeLeft, 8);
      YGNodeStyleSetPadding(child, YGEdgeRight, 20);
    };
    auto logical = [&]() {
      if (start) YGNodeStyleSetPadding(child, YGEdgeStart, 0);
      else YGNodeStyleSetPaddingPercent(child, YGEdgeEnd, 15);
    };
    if (logicalFirst) { logical(); physical(); } else { physical(); logical(); }
    auto leaf = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidthPercent(leaf, 100); YGNodeStyleSetHeightPercent(leaf, 100); YGNodeStyleSetFlexShrink(leaf, 0);
    YGNodeStyleSetMinWidth(leaf, 0); YGNodeStyleSetMinHeight(leaf, 0);
    YGNodeInsertChild(child, leaf, 0); YGNodeInsertChild(root, child, 0);
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, rtl ? YGDirectionRTL : YGDirectionLTR);
    std::cout << ",{\"name\":\"logical-padding-" << (start ? "start-zero" : "end-percent") << '-' << (rtl ? "rtl" : "ltr") << (logicalFirst ? "-logical-first" : "-logical-last")
              << "\",\"width\":200,\"height\":100,\"gap\":0,\"flexDirection\":\"row\",\"flexWrap\":\"nowrap\",\"layoutDirection\":\"" << (rtl ? "rtl" : "ltr")
              << "\",\"containerStyle\":{\"alignItems\":\"flex-start\",\"justifyContent\":\"flex-start\"},\"boxes\":[";
    printBox(child);
    std::cout << "],\"contentBoxes\":[{\"x\":" << YGNodeLayoutGetLeft(child) + YGNodeLayoutGetLeft(leaf)
              << ",\"y\":" << YGNodeLayoutGetTop(child) + YGNodeLayoutGetTop(leaf)
              << ",\"width\":" << YGNodeLayoutGetWidth(leaf) << ",\"height\":" << YGNodeLayoutGetHeight(leaf)
              << "}],\"itemStyles\":[{\"boxSizing\":\"border-box\",\"width\":100,\"height\":60,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"padding\":{\"left\":8,\"right\":20,\"top\":5,\"bottom\":5},\"" << (start ? "paddingStart\":0" : "paddingEnd\":\"15%\"") << "}]}";
    YGNodeFreeRecursive(root); YGConfigFree(config);
  }
}


static void logicalBorderPhysical(YGNodeRef child) {
  YGNodeStyleSetBorder(child, YGEdgeAll, 5);
  YGNodeStyleSetBorder(child, YGEdgeLeft, 8);
  YGNodeStyleSetBorder(child, YGEdgeRight, 20);
}

static void logicalBorderEdge(YGNodeRef child, bool start) {
  if (start) YGNodeStyleSetBorder(child, YGEdgeStart, 0);
  else YGNodeStyleSetBorder(child, YGEdgeEnd, 30);
}

static void logicalBorderCases() {
  // Full-content leaves expose resolved logical border insets and both sizing modes.
  for (int start = 0; start < 2; ++start) for (int rtl = 0; rtl < 2; ++rtl) for (int logicalFirst = 0; logicalFirst < 2; ++logicalFirst) for (int borderBox = 0; borderBox < 2; ++borderBox) {
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(root, 200); YGNodeStyleSetHeight(root, 100); YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow);
    YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetJustifyContent(root, YGJustifyFlexStart);
    auto child = YGNodeNewWithConfig(config);
    YGNodeStyleSetBoxSizing(child, borderBox ? YGBoxSizingBorderBox : YGBoxSizingContentBox); YGNodeStyleSetWidth(child, 100); YGNodeStyleSetHeight(child, 60);
    YGNodeStyleSetFlexShrink(child, 0); YGNodeStyleSetMinWidth(child, 0); YGNodeStyleSetMinHeight(child, 0);
    if (logicalFirst) { logicalBorderEdge(child, start); logicalBorderPhysical(child); }
    else { logicalBorderPhysical(child); logicalBorderEdge(child, start); }
    auto leaf = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidthPercent(leaf, 100); YGNodeStyleSetHeightPercent(leaf, 100); YGNodeStyleSetFlexShrink(leaf, 0);
    YGNodeStyleSetMinWidth(leaf, 0); YGNodeStyleSetMinHeight(leaf, 0);
    YGNodeInsertChild(child, leaf, 0); YGNodeInsertChild(root, child, 0);
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, rtl ? YGDirectionRTL : YGDirectionLTR);
    std::cout << ",{\"name\":\"logical-border-" << (start ? "start-zero" : "end-thirty") << '-' << (rtl ? "rtl" : "ltr") << (logicalFirst ? "-logical-first" : "-logical-last") << '-' << (borderBox ? "border-box" : "content-box")
              << "\",\"width\":200,\"height\":100,\"gap\":0,\"flexDirection\":\"row\",\"flexWrap\":\"nowrap\",\"layoutDirection\":\"" << (rtl ? "rtl" : "ltr") << "\",\"containerStyle\":{\"alignItems\":\"flex-start\",\"justifyContent\":\"flex-start\"},\"boxes\":[";
    printBox(child);
    std::cout << "],\"contentBoxes\":[{\"x\":" << YGNodeLayoutGetLeft(child) + YGNodeLayoutGetLeft(leaf) << ",\"y\":" << YGNodeLayoutGetTop(child) + YGNodeLayoutGetTop(leaf) << ",\"width\":" << YGNodeLayoutGetWidth(leaf) << ",\"height\":" << YGNodeLayoutGetHeight(leaf) << "}],\"itemStyles\":[{\"boxSizing\":\"" << (borderBox ? "border-box" : "content-box") << "\",\"width\":100,\"height\":60,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"borderWidth\":{\"left\":8,\"right\":20,\"top\":5,\"bottom\":5},\"" << (start ? "borderStartWidth\":0" : "borderEndWidth\":30") << "}]}";
    YGNodeFreeRecursive(root); YGConfigFree(config);
  }
  // Yoga resolves a logical border against the receiver's own direction, while the RTL parent still places it from the right.
  for (int start = 0; start < 2; ++start) {
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(root, 200); YGNodeStyleSetHeight(root, 100); YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow);
    YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetJustifyContent(root, YGJustifyFlexStart);
    auto child = YGNodeNewWithConfig(config);
    YGNodeStyleSetDirection(child, YGDirectionLTR); YGNodeStyleSetBoxSizing(child, YGBoxSizingBorderBox); YGNodeStyleSetWidth(child, 100); YGNodeStyleSetHeight(child, 60);
    YGNodeStyleSetFlexShrink(child, 0); YGNodeStyleSetMinWidth(child, 0); YGNodeStyleSetMinHeight(child, 0);
    logicalBorderPhysical(child); logicalBorderEdge(child, start);
    auto leaf = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidthPercent(leaf, 100); YGNodeStyleSetHeightPercent(leaf, 100); YGNodeStyleSetFlexShrink(leaf, 0);
    YGNodeStyleSetMinWidth(leaf, 0); YGNodeStyleSetMinHeight(leaf, 0);
    YGNodeInsertChild(child, leaf, 0); YGNodeInsertChild(root, child, 0);
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionRTL);
    std::cout << ",{\"name\":\"logical-border-" << (start ? "start-zero" : "end-thirty") << "-parent-rtl-child-ltr-border-box\",\"width\":200,\"height\":100,\"gap\":0,\"flexDirection\":\"row\",\"flexWrap\":\"nowrap\",\"layoutDirection\":\"rtl\",\"containerStyle\":{\"alignItems\":\"flex-start\",\"justifyContent\":\"flex-start\"},\"boxes\":[";
    printBox(child);
    std::cout << "],\"contentBoxes\":[{\"x\":" << YGNodeLayoutGetLeft(child) + YGNodeLayoutGetLeft(leaf) << ",\"y\":" << YGNodeLayoutGetTop(child) + YGNodeLayoutGetTop(leaf) << ",\"width\":" << YGNodeLayoutGetWidth(leaf) << ",\"height\":" << YGNodeLayoutGetHeight(leaf) << "}],\"itemStyles\":[{\"boxSizing\":\"border-box\",\"width\":100,\"height\":60,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"borderWidth\":{\"left\":8,\"right\":20,\"top\":5,\"bottom\":5},\"layoutDirection\":\"ltr\",\"" << (start ? "borderStartWidth\":0" : "borderEndWidth\":30") << "}]}";
    YGNodeFreeRecursive(root); YGConfigFree(config);
  }
}


static void intrinsicRowWrapAutoHeightCases() {
  for (int caseIndex = 0; caseIndex < 2; ++caseIndex) {
    const bool narrow = caseIndex == 1;
    const float innerWidth = narrow ? 90 : 160;
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false);
    YGConfigSetPointScaleFactor(config, 0);
    YGConfigSetErrata(config, YGErrataNone);
    auto outer = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(outer, 200); YGNodeStyleSetHeight(outer, 180);
    YGNodeStyleSetFlexDirection(outer, YGFlexDirectionColumn);
    YGNodeStyleSetGap(outer, YGGutterAll, 10);
    YGNodeStyleSetAlignItems(outer, YGAlignFlexStart);
    YGNodeStyleSetAlignContent(outer, YGAlignFlexStart);
    auto inner = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(inner, innerWidth);
    YGNodeStyleSetFlexDirection(inner, YGFlexDirectionRow);
    YGNodeStyleSetFlexWrap(inner, YGWrapWrap);
    YGNodeStyleSetGap(inner, YGGutterAll, 10);
    YGNodeStyleSetFlexGrow(inner, 0); YGNodeStyleSetFlexShrink(inner, 0); setMinZero(inner);
    const float heights[] = {20, 30, 20};
    for (int index = 0; index < 3; ++index) {
      auto leaf = YGNodeNewWithConfig(config);
      YGNodeStyleSetWidth(leaf, 70); YGNodeStyleSetHeight(leaf, heights[index]);
      YGNodeStyleSetFlexGrow(leaf, 0); YGNodeStyleSetFlexShrink(leaf, 0); setMinZero(leaf);
      YGNodeInsertChild(inner, leaf, index);
    }
    auto footer = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(footer, 80); YGNodeStyleSetHeight(footer, 20);
    YGNodeStyleSetFlexGrow(footer, 0); YGNodeStyleSetFlexShrink(footer, 0); setMinZero(footer);
    YGNodeInsertChild(outer, inner, 0); YGNodeInsertChild(outer, footer, 1);
    YGNodeCalculateLayout(outer, YGUndefined, YGUndefined, YGDirectionLTR);
    std::cout << ",{\"name\":\"intrinsic-row-wrap-column-" << (narrow ? "narrow" : "wide")
              << "\",\"width\":200,\"height\":180,\"gap\":10,\"flexDirection\":\"column\",\"flexWrap\":\"nowrap\""
              << ",\"containerStyle\":{\"alignItems\":\"flex-start\",\"alignContent\":\"flex-start\"},\"intrinsicFixture\":true,\"boxes\":[";
    printBox(inner); std::cout << ','; printBox(footer);
    std::cout << "],\"intrinsicNestedBoxes\":[";
    for (int index = 0; index < 3; ++index) {
      if (index) std::cout << ',';
      printBox(YGNodeGetChild(inner, index), YGNodeLayoutGetLeft(inner), YGNodeLayoutGetTop(inner));
    }
    std::cout << "],\"innerStyle\":{\"width\":" << innerWidth
              << ",\"flexWrap\":\"wrap\",\"gap\":10,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}"
              << ",\"intrinsicLeafStyles\":[{\"width\":70,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"width\":70,\"height\":30,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"width\":70,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]"
              << ",\"footerStyle\":{\"width\":80,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}}";
    YGNodeFreeRecursive(outer); YGConfigFree(config);
  }
}

static void directionMatrixCases() {
  const YGFlexDirection directions[] = {YGFlexDirectionRow, YGFlexDirectionRowReverse, YGFlexDirectionColumn, YGFlexDirectionColumnReverse};
  const char* directionNames[] = {"row", "row-reverse", "column", "column-reverse"};
  for (int directionIndex = 0; directionIndex < 4; ++directionIndex) {
    for (int reverseWrap = 0; reverseWrap < 2; ++reverseWrap) {
      for (int rtl = 0; rtl < 2; ++rtl) {
        const bool column = directionIndex >= 2;
        auto config = YGConfigNew();
        YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
        auto root = YGNodeNewWithConfig(config);
        YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
        YGNodeStyleSetWidth(root, 160); YGNodeStyleSetHeight(root, column ? 90 : 100);
        YGNodeStyleSetFlexDirection(root, directions[directionIndex]);
        YGNodeStyleSetFlexWrap(root, reverseWrap ? YGWrapWrapReverse : YGWrapWrap);
        YGNodeStyleSetGap(root, YGGutterAll, 8); YGNodeStyleSetAlignItems(root, YGAlignCenter); YGNodeStyleSetAlignContent(root, YGAlignFlexStart);
        YGNodeStyleSetPadding(root, YGEdgeLeft, 5); YGNodeStyleSetPadding(root, YGEdgeRight, 9); YGNodeStyleSetPadding(root, YGEdgeTop, 2); YGNodeStyleSetPadding(root, YGEdgeBottom, 2); YGNodeStyleSetPadding(root, YGEdgeStart, 0);
        YGNodeStyleSetBorder(root, YGEdgeLeft, 3); YGNodeStyleSetBorder(root, YGEdgeRight, 7); YGNodeStyleSetBorder(root, YGEdgeTop, 1); YGNodeStyleSetBorder(root, YGEdgeBottom, 1); YGNodeStyleSetBorder(root, YGEdgeStart, 2);
        const float widths[] = {40, 50, 60}, heights[] = {20, 28, 16};
        for (int index = 0; index < 3; ++index) {
          auto child = YGNodeNewWithConfig(config);
          YGNodeStyleSetBoxSizing(child, YGBoxSizingContentBox); YGNodeStyleSetWidth(child, widths[index]); YGNodeStyleSetHeight(child, heights[index]);
          YGNodeStyleSetMinWidth(child, 0); YGNodeStyleSetMaxWidth(child, 45); YGNodeStyleSetMinHeight(child, 0); YGNodeStyleSetFlexGrow(child, 0); YGNodeStyleSetFlexShrink(child, 0);
          YGNodeStyleSetMargin(child, YGEdgeStart, 6); YGNodeStyleSetMargin(child, YGEdgeEnd, 3); YGNodeStyleSetMargin(child, YGEdgeTop, 2); YGNodeStyleSetMargin(child, YGEdgeBottom, 4);
          YGNodeInsertChild(root, child, index);
        }
        YGNodeCalculateLayout(root, YGUndefined, YGUndefined, rtl ? YGDirectionRTL : YGDirectionLTR);
        std::cout << ",{\"name\":\"direction-matrix-" << directionNames[directionIndex] << '-' << (reverseWrap ? "wrap-reverse" : "wrap") << '-' << (rtl ? "rtl" : "ltr")
                  << "\",\"width\":160,\"height\":" << (column ? 90 : 100) << ",\"gap\":8,\"flexDirection\":\"" << directionNames[directionIndex]
                  << "\",\"flexWrap\":\"" << (reverseWrap ? "wrap-reverse" : "wrap") << "\",\"layoutDirection\":\"" << (rtl ? "rtl" : "ltr")
                  << "\",\"containerStyle\":{\"boxSizing\":\"border-box\",\"alignItems\":\"center\",\"alignContent\":\"flex-start\",\"padding\":{\"left\":5,\"right\":9,\"top\":2,\"bottom\":2},\"paddingStart\":0,\"borderWidth\":{\"left\":3,\"right\":7,\"top\":1,\"bottom\":1},\"borderStartWidth\":2},\"directionMatrixFixture\":true,\"boxes\":[";
        for (int index = 0; index < 3; ++index) { if (index) std::cout << ','; printBox(YGNodeGetChild(root, index)); }
        // Preserve Pibbl's existing margin-box centering and content-box reflection.
        // Yoga's multiline centering omits asymmetric cross margins, and its
        // wrap-reverse pass reflects against the outer box (CalculateLayout step 9).
        const double crossDelta = column ? (rtl ? -1.5 : 1.5) + (reverseWrap ? (rtl ? 6 : -14) : 0) : -1;
        std::cout << "],\"classification\":\"preserved-margin-and-content-reflection\",\"comparisonLabel\":\"Preserved Pibbl margin-box centering and content-box wrap reflection; Yoga differs (not parity).\",\"pibblBoxes\":[";
        for (int index = 0; index < 3; ++index) {
          if (index) std::cout << ',';
          const auto child = YGNodeGetChild(root, index);
          std::cout << "{\"x\":" << YGNodeLayoutGetLeft(child) + (column ? crossDelta : 0)
                    << ",\"y\":" << YGNodeLayoutGetTop(child) + (column ? 0 : crossDelta)
                    << ",\"width\":" << YGNodeLayoutGetWidth(child) << ",\"height\":" << YGNodeLayoutGetHeight(child) << '}';
        }
        std::cout << "],\"itemStyles\":[";
        for (int index = 0; index < 3; ++index) {
          if (index) std::cout << ',';
          std::cout << "{\"boxSizing\":\"content-box\",\"width\":" << widths[index] << ",\"height\":" << heights[index]
                    << ",\"minWidth\":0,\"maxWidth\":45,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0,\"marginStart\":6,\"marginEnd\":3,\"marginTop\":2,\"marginBottom\":4}";
        }
        std::cout << "]}";
        YGNodeFreeRecursive(root); YGConfigFree(config);
      }
    }
  }
}
static void directionIsolationCases() {
  const float widths[] = {40, 50, 60}, heights[] = {20, 28, 16};
  for (int isolateInsets = 0; isolateInsets < 2; ++isolateInsets) {
    for (int reverseWrap = 0; reverseWrap < 2; ++reverseWrap) {
      for (int rtl = 0; rtl < 2; ++rtl) {
        auto config = YGConfigNew();
        YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
        auto root = YGNodeNewWithConfig(config);
        YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
        YGNodeStyleSetWidth(root, 160); YGNodeStyleSetHeight(root, 90);
        YGNodeStyleSetFlexDirection(root, YGFlexDirectionColumn);
        YGNodeStyleSetFlexWrap(root, reverseWrap ? YGWrapWrapReverse : YGWrapWrap);
        YGNodeStyleSetGap(root, YGGutterAll, 8); YGNodeStyleSetAlignItems(root, YGAlignCenter); YGNodeStyleSetAlignContent(root, YGAlignFlexStart);
        if (isolateInsets) {
          YGNodeStyleSetPadding(root, YGEdgeLeft, 5); YGNodeStyleSetPadding(root, YGEdgeRight, 9); YGNodeStyleSetPadding(root, YGEdgeTop, 2); YGNodeStyleSetPadding(root, YGEdgeBottom, 2); YGNodeStyleSetPadding(root, YGEdgeStart, 0);
          YGNodeStyleSetBorder(root, YGEdgeLeft, 3); YGNodeStyleSetBorder(root, YGEdgeRight, 7); YGNodeStyleSetBorder(root, YGEdgeTop, 1); YGNodeStyleSetBorder(root, YGEdgeBottom, 1); YGNodeStyleSetBorder(root, YGEdgeStart, 2);
        }
        for (int index = 0; index < 3; ++index) {
          auto child = YGNodeNewWithConfig(config);
          YGNodeStyleSetBoxSizing(child, YGBoxSizingContentBox); YGNodeStyleSetWidth(child, widths[index]); YGNodeStyleSetHeight(child, heights[index]);
          YGNodeStyleSetMinWidth(child, 0); YGNodeStyleSetMaxWidth(child, 45); YGNodeStyleSetMinHeight(child, 0); YGNodeStyleSetFlexGrow(child, 0); YGNodeStyleSetFlexShrink(child, 0);
          if (!isolateInsets) {
            YGNodeStyleSetMargin(child, YGEdgeStart, 6); YGNodeStyleSetMargin(child, YGEdgeEnd, 3); YGNodeStyleSetMargin(child, YGEdgeTop, 2); YGNodeStyleSetMargin(child, YGEdgeBottom, 4);
          }
          YGNodeInsertChild(root, child, index);
        }
        YGNodeCalculateLayout(root, YGUndefined, YGUndefined, rtl ? YGDirectionRTL : YGDirectionLTR);
        const char* name = isolateInsets ? "direction-insets" : "direction-margins";
        std::cout << ",{\"name\":\"" << name << "-column-" << (reverseWrap ? "wrap-reverse" : "wrap") << '-' << (rtl ? "rtl" : "ltr")
                  << "\",\"width\":160,\"height\":90,\"gap\":8,\"flexDirection\":\"column\",\"flexWrap\":\"" << (reverseWrap ? "wrap-reverse" : "wrap") << "\",\"layoutDirection\":\"" << (rtl ? "rtl" : "ltr")
                  << "\",\"containerStyle\":{\"boxSizing\":\"border-box\",\"alignItems\":\"center\",\"alignContent\":\"flex-start\"";
        if (isolateInsets) std::cout << ",\"padding\":{\"left\":5,\"right\":9,\"top\":2,\"bottom\":2},\"paddingStart\":0,\"borderWidth\":{\"left\":3,\"right\":7,\"top\":1,\"bottom\":1},\"borderStartWidth\":2";
        std::cout << "},\"directionMatrixFixture\":true,\"boxes\":[";
        for (int index = 0; index < 3; ++index) { if (index) std::cout << ','; printBox(YGNodeGetChild(root, index)); }
        if (isolateInsets && reverseWrap) {
          const double reflectionDelta = rtl ? 6 : -14;
          std::cout << "],\"classification\":\"preserved-content-box-reflection\",\"comparisonLabel\":\"Preserved Pibbl content-box wrap reflection; Yoga root-edge reflection differs (not parity).\",\"pibblBoxes\":[";
          for (int index = 0; index < 3; ++index) {
            if (index) std::cout << ',';
            const auto child = YGNodeGetChild(root, index);
            std::cout << "{\"x\":" << YGNodeLayoutGetLeft(child) + reflectionDelta << ",\"y\":" << YGNodeLayoutGetTop(child) << ",\"width\":" << YGNodeLayoutGetWidth(child) << ",\"height\":" << YGNodeLayoutGetHeight(child) << '}';
          }
        } else if (!isolateInsets) {
          const double marginDelta = rtl ? -1.5 : 1.5;
          std::cout << "],\"classification\":\"preserved-physical-cross-margin\",\"comparisonLabel\":\"Preserved Pibbl physical cross-margin centering; Yoga differs (not parity).\",\"pibblBoxes\":[";
          for (int index = 0; index < 3; ++index) {
            if (index) std::cout << ',';
            const auto child = YGNodeGetChild(root, index);
            std::cout << "{\"x\":" << YGNodeLayoutGetLeft(child) + marginDelta << ",\"y\":" << YGNodeLayoutGetTop(child) << ",\"width\":" << YGNodeLayoutGetWidth(child) << ",\"height\":" << YGNodeLayoutGetHeight(child) << '}';
          }
        }
        std::cout << "],\"itemStyles\":[";
        for (int index = 0; index < 3; ++index) {
          if (index) std::cout << ',';
          std::cout << "{\"boxSizing\":\"content-box\",\"width\":" << widths[index] << ",\"height\":" << heights[index]
                    << ",\"minWidth\":0,\"maxWidth\":45,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0";
          if (!isolateInsets) std::cout << ",\"marginStart\":6,\"marginEnd\":3,\"marginTop\":2,\"marginBottom\":4";
          std::cout << '}';
        }
        std::cout << "]}";
        YGNodeFreeRecursive(root); YGConfigFree(config);
      }
    }
  }
}


static void autoMarginCases() {
  for (int mode = 0; mode < 4; ++mode) {
    const int cases = mode == 3 ? 1 : 2;
    for (int resize = 0; resize < cases; ++resize) {
      const float width = resize ? 260 : 200;
      auto config = YGConfigNew();
      YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
      auto root = YGNodeNewWithConfig(config);
      YGNodeStyleSetWidth(root, width); YGNodeStyleSetHeight(root, 80); YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow); YGNodeStyleSetFlexWrap(root, YGWrapNoWrap);
      YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetJustifyContent(root, mode == 3 ? YGJustifyFlexEnd : YGJustifyFlexStart);
      auto a = YGNodeNewWithConfig(config), b = YGNodeNewWithConfig(config);
      for (auto node : {a, b}) { YGNodeStyleSetWidth(node, 40); YGNodeStyleSetHeight(node, 20); YGNodeStyleSetFlexGrow(node, 0); YGNodeStyleSetFlexShrink(node, 0); setMinZero(node); }
      if (mode == 0 || mode == 3) YGNodeStyleSetMarginAuto(a, YGEdgeLeft);
      if (mode == 1) YGNodeStyleSetMarginAuto(a, YGEdgeRight);
      if (mode == 2) { YGNodeStyleSetMarginAuto(a, YGEdgeLeft); YGNodeStyleSetMarginAuto(a, YGEdgeRight); }
      YGNodeInsertChild(root, a, 0); YGNodeInsertChild(root, b, 1);
      YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionLTR);
      const char* edge = mode == 0 ? "left" : mode == 1 ? "right" : mode == 2 ? "both" : "left-justify-end";
      std::cout << ",{\"name\":\"auto-margin-" << edge << (resize ? "-resized" : "") << "\",\"width\":" << width << ",\"height\":80,\"gap\":0,\"flexDirection\":\"row\",\"flexWrap\":\"nowrap\",\"containerStyle\":{\"alignItems\":\"flex-start\",\"justifyContent\":\"" << (mode == 3 ? "flex-end" : "flex-start") << "\"},\"autoMarginFixture\":true,\"boxes\":[";
      printBox(a); std::cout << ','; printBox(b);
      std::cout << "],\"itemStyles\":[{\"width\":40,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0";
      if (mode == 0 || mode == 3) std::cout << ",\"marginLeft\":\"auto\"";
      if (mode == 1) std::cout << ",\"marginRight\":\"auto\"";
      if (mode == 2) std::cout << ",\"marginLeft\":\"auto\",\"marginRight\":\"auto\"";
      std::cout << "},{\"width\":40,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
      YGNodeFreeRecursive(root); YGConfigFree(config);
    }
  }
}
static void autoMainDirectionCases() {
  const YGFlexDirection directions[] = {YGFlexDirectionRow, YGFlexDirectionRowReverse, YGFlexDirectionColumn, YGFlexDirectionColumnReverse};
  const char* names[] = {"row", "row-reverse", "column", "column-reverse"};
  for (int mode = 0; mode < 10; ++mode) {
    const int direction = mode < 8 ? mode / 2 : 0;
    const bool rtl = mode < 8 ? mode % 2 : true;
    const bool column = direction >= 2;
    const auto edge = mode == 8 ? YGEdgeStart : mode == 9 ? YGEdgeEnd : column ? YGEdgeTop : YGEdgeLeft;
    const char* field = mode == 8 ? "marginStart" : mode == 9 ? "marginEnd" : column ? "marginTop" : "marginLeft";
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(root, column ? 80 : 200); YGNodeStyleSetHeight(root, column ? 200 : 80);
    YGNodeStyleSetFlexDirection(root, directions[direction]); YGNodeStyleSetFlexWrap(root, YGWrapNoWrap);
    YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetJustifyContent(root, YGJustifyFlexStart);
    auto a = YGNodeNewWithConfig(config), b = YGNodeNewWithConfig(config);
    for (auto node : {a,b}) { YGNodeStyleSetWidth(node,column ? 20 : 40); YGNodeStyleSetHeight(node,column ? 40 : 20); YGNodeStyleSetFlexGrow(node,0); YGNodeStyleSetFlexShrink(node,0); setMinZero(node); }
    YGNodeStyleSetMarginAuto(a,edge); YGNodeInsertChild(root,a,0); YGNodeInsertChild(root,b,1);
    YGNodeCalculateLayout(root,YGUndefined,YGUndefined,rtl ? YGDirectionRTL : YGDirectionLTR);
    std::cout << ",{\"name\":\"";
    if (mode < 8) std::cout << "auto-main-" << names[direction] << '-' << (rtl ? "rtl" : "ltr");
    else std::cout << "auto-logical-" << (mode == 8 ? "start" : "end") << "-rtl";
    std::cout << "\",\"width\":" << (column ? 80 : 200) << ",\"height\":" << (column ? 200 : 80)
              << ",\"gap\":0,\"flexDirection\":\"" << names[direction] << "\",\"flexWrap\":\"nowrap\",\"layoutDirection\":\"" << (rtl ? "rtl" : "ltr")
              << "\",\"containerStyle\":{\"alignItems\":\"flex-start\",\"justifyContent\":\"flex-start\"},\"autoMarginFixture\":true,\"autoMainDirectionFixture\":true,\"boxes\":[";
    printBox(a); std::cout << ','; printBox(b);
    std::cout << "],\"itemStyles\":[";
    for (int index=0;index<2;index++) {
      if(index)std::cout<<',';
      std::cout << "{\"width\":" << (column ? 20 : 40) << ",\"height\":" << (column ? 40 : 20) << ",\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0";
      if(index==0)std::cout << ",\"" << field << "\":\"auto\"";
      std::cout << '}';
    }
    std::cout << "]}"; YGNodeFreeRecursive(root); YGConfigFree(config);
  }
}


static void autoWrappedMarginCases() {
  const YGFlexDirection directions[] = {YGFlexDirectionRow, YGFlexDirectionRowReverse, YGFlexDirectionColumn, YGFlexDirectionColumnReverse};
  const char* names[] = {"row", "row-reverse", "column", "column-reverse"};
  for (int direction = 0; direction < 4; ++direction) {
    const bool column = direction >= 2;
    for (int reverseWrap = 0; reverseWrap < 2; ++reverseWrap) {
      for (int rtl = 0; rtl < 2; ++rtl) {
        auto config = YGConfigNew();
        YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
        auto root = YGNodeNewWithConfig(config);
        YGNodeStyleSetWidth(root, column ? 120 : 100); YGNodeStyleSetHeight(root, column ? 100 : 120);
        YGNodeStyleSetFlexDirection(root, directions[direction]);
        YGNodeStyleSetFlexWrap(root, reverseWrap ? YGWrapWrapReverse : YGWrapWrap);
        YGNodeStyleSetGap(root, YGGutterAll, 10); YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetAlignContent(root, YGAlignFlexStart); YGNodeStyleSetJustifyContent(root, YGJustifyFlexStart);
        for (int index = 0; index < 3; ++index) {
          auto child = YGNodeNewWithConfig(config);
          YGNodeStyleSetWidth(child, column ? 20 : 40); YGNodeStyleSetHeight(child, column ? 40 : 20);
          YGNodeStyleSetFlexGrow(child, 0); YGNodeStyleSetFlexShrink(child, 0); setMinZero(child);
          if (index == 0 || index == 2) YGNodeStyleSetMarginAuto(child, column ? YGEdgeTop : YGEdgeLeft);
          YGNodeInsertChild(root, child, index);
        }
        YGNodeCalculateLayout(root, YGUndefined, YGUndefined, rtl ? YGDirectionRTL : YGDirectionLTR);
        std::cout << ",{\"name\":\"auto-wrap-" << names[direction] << '-' << (reverseWrap ? "wrap-reverse" : "wrap") << '-' << (rtl ? "rtl" : "ltr")
                  << "\",\"width\":" << (column ? 120 : 100) << ",\"height\":" << (column ? 100 : 120) << ",\"gap\":10,\"flexDirection\":\"" << names[direction]
                  << "\",\"flexWrap\":\"" << (reverseWrap ? "wrap-reverse" : "wrap") << "\",\"layoutDirection\":\"" << (rtl ? "rtl" : "ltr")
                  << "\",\"containerStyle\":{\"alignItems\":\"flex-start\",\"alignContent\":\"flex-start\",\"justifyContent\":\"flex-start\"},\"autoMarginFixture\":true,\"autoWrappedMarginFixture\":true,\"boxes\":[";
        for (int index = 0; index < 3; ++index) { if (index) std::cout << ','; printBox(YGNodeGetChild(root, index)); }
        const bool mainReverse = column ? direction == 3 : ((direction == 1) != bool(rtl));
        const bool crossReverse = bool(reverseWrap) != (column && bool(rtl));
        std::cout << "],\"classification\":\"css-line-local-auto-margin\",\"comparisonLabel\":\"CSS per-line auto slots; Yoga 3.2.1 includes a deferred next-line slot. Classified difference, not parity.\",\"pibblBoxes\":[";
        for (int index = 0; index < 3; ++index) {
          if (index) std::cout << ',';
          const int main = index == 0 ? (mainReverse ? 60 : 10) : index == 1 ? (mainReverse ? 0 : 60) : 60;
          const int cross = index == 2 ? (crossReverse ? 70 : 30) : (crossReverse ? 100 : 0);
          std::cout << "{\"x\":" << (column ? cross : main) << ",\"y\":" << (column ? main : cross)
                    << ",\"width\":" << (column ? 20 : 40) << ",\"height\":" << (column ? 40 : 20) << '}';
        }
        std::cout << "],\"itemStyles\":[";
        for (int index = 0; index < 3; ++index) {
          if (index) std::cout << ',';
          std::cout << "{\"width\":" << (column ? 20 : 40) << ",\"height\":" << (column ? 40 : 20) << ",\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0";
          if (index == 0 || index == 2) std::cout << ",\"" << (column ? "marginTop" : "marginLeft") << "\":\"auto\"";
          std::cout << '}';
        }
        std::cout << "]}";
        YGNodeFreeRecursive(root); YGConfigFree(config);
      }
    }
  }
  auto config = YGConfigNew();
  YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
  auto root = YGNodeNewWithConfig(config);
  YGNodeStyleSetWidth(root, 100); YGNodeStyleSetHeight(root, 120); YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow); YGNodeStyleSetFlexWrap(root, YGWrapWrap);
  YGNodeStyleSetGap(root, YGGutterAll, 10); YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetAlignContent(root, YGAlignFlexStart); YGNodeStyleSetJustifyContent(root, YGJustifyCenter);
  for (int index = 0; index < 3; ++index) {
    auto child = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(child, 40); YGNodeStyleSetHeight(child, 20); YGNodeStyleSetFlexGrow(child, 0); YGNodeStyleSetFlexShrink(child, 0); setMinZero(child);
    if (index == 0) YGNodeStyleSetMarginAuto(child, YGEdgeLeft);
    YGNodeInsertChild(root, child, index);
  }
  YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionLTR);
  std::cout << ",{\"name\":\"auto-wrap-row-line-without-auto-center\",\"width\":100,\"height\":120,\"gap\":10,\"flexDirection\":\"row\",\"flexWrap\":\"wrap\",\"layoutDirection\":\"ltr\",\"containerStyle\":{\"alignItems\":\"flex-start\",\"alignContent\":\"flex-start\",\"justifyContent\":\"center\"},\"autoMarginFixture\":true,\"autoWrappedMarginFixture\":true,\"boxes\":[";
  for (int index = 0; index < 3; ++index) { if (index) std::cout << ','; printBox(YGNodeGetChild(root, index)); }
  std::cout << "],\"itemStyles\":[{\"width\":40,\"height\":20,\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0,\"marginLeft\":\"auto\"},{\"width\":40,\"height\":20,\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0},{\"width\":40,\"height\":20,\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0}]}";
  YGNodeFreeRecursive(root); YGConfigFree(config);
}


static void autoCrossMarginCases() {
  const YGFlexDirection directions[] = {YGFlexDirectionRow, YGFlexDirectionRowReverse};
  const char* directionsNames[] = {"row", "row-reverse"};
  const YGEdge edges[] = {YGEdgeTop, YGEdgeBottom, YGEdgeTop};
  const char* edgeNames[] = {"top", "bottom", "both"};
  for (int direction = 0; direction < 2; ++direction) {
    for (int rtl = 0; rtl < 2; ++rtl) {
      for (int edge = 0; edge < 3; ++edge) {
        auto config = YGConfigNew();
        YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
        auto root = YGNodeNewWithConfig(config);
        YGNodeStyleSetWidth(root, 100); YGNodeStyleSetHeight(root, 100);
        YGNodeStyleSetFlexDirection(root, directions[direction]); YGNodeStyleSetFlexWrap(root, YGWrapWrap);
        YGNodeStyleSetGap(root, YGGutterAll, 10); YGNodeStyleSetAlignItems(root, YGAlignCenter); YGNodeStyleSetAlignContent(root, YGAlignFlexStart); YGNodeStyleSetJustifyContent(root, YGJustifyFlexStart);
        const float heights[] = {20, 40, 20};
        for (int index = 0; index < 3; ++index) {
          auto child = YGNodeNewWithConfig(config);
          YGNodeStyleSetWidth(child, 40); YGNodeStyleSetHeight(child, heights[index]); YGNodeStyleSetFlexGrow(child, 0); YGNodeStyleSetFlexShrink(child, 0); setMinZero(child);
          if (index == 0) {
            YGNodeStyleSetMarginAuto(child, edges[edge]);
            if (edge == 2) YGNodeStyleSetMarginAuto(child, YGEdgeBottom);
          }
          YGNodeInsertChild(root, child, index);
        }
        YGNodeCalculateLayout(root, YGUndefined, YGUndefined, rtl ? YGDirectionRTL : YGDirectionLTR);
        std::cout << ",{\"name\":\"auto-cross-" << directionsNames[direction] << '-' << edgeNames[edge] << '-' << (rtl ? "rtl" : "ltr")
                  << "\",\"width\":100,\"height\":100,\"gap\":10,\"flexDirection\":\"" << directionsNames[direction]
                  << "\",\"flexWrap\":\"wrap\",\"layoutDirection\":\"" << (rtl ? "rtl" : "ltr")
                  << "\",\"containerStyle\":{\"alignItems\":\"center\",\"alignContent\":\"flex-start\",\"justifyContent\":\"flex-start\"},\"autoMarginFixture\":true,\"autoCrossMarginFixture\":true,\"boxes\":[";
        for (int index = 0; index < 3; ++index) { if (index) std::cout << ','; printBox(YGNodeGetChild(root, index)); }
        std::cout << ']';
        if (edge != 2) {
          const bool reverse = (direction == 1) != bool(rtl);
          std::cout << ",\"classification\":\"css-cross-auto-precedence\",\"comparisonLabel\":\"CSS cross auto margins override alignment; Yoga 3.2.1 centers this wrapped item. Classified difference, not parity.\",\"pibblBoxes\":[";
          for (int index = 0; index < 3; ++index) {
            if (index) std::cout << ',';
            const int x = index == 1 ? (reverse ? 10 : 50) : (reverse ? 60 : 0);
            const int y = index == 0 ? (edge == 0 ? 20 : 0) : index == 1 ? 0 : 50;
            std::cout << "{\"x\":" << x << ",\"y\":" << y << ",\"width\":40,\"height\":" << heights[index] << '}';
          }
          std::cout << ']';
        }
        std::cout << ",\"itemStyles\":[";
        for (int index = 0; index < 3; ++index) {
          if (index) std::cout << ',';
          std::cout << "{\"width\":40,\"height\":" << heights[index] << ",\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0";
          if (index == 0) {
            if (edge == 0 || edge == 2) std::cout << ",\"marginTop\":\"auto\"";
            if (edge == 1 || edge == 2) std::cout << ",\"marginBottom\":\"auto\"";
          }
          std::cout << '}';
        }
        std::cout << "]}";
        YGNodeFreeRecursive(root); YGConfigFree(config);
      }
    }
  }
}


static void autoCrossDirectionCases() {
  const YGFlexDirection directions[] = {YGFlexDirectionRow, YGFlexDirectionRowReverse, YGFlexDirectionColumn, YGFlexDirectionColumnReverse};
  const char* names[] = {"row", "row-reverse", "column", "column-reverse"};
  const char* edgeNames[] = {"before", "after", "both"};
  for (int direction = 0; direction < 4; ++direction) {
    const bool column = direction >= 2;
    const int wrapStart = column ? 0 : 1;
    const int wrapEnd = 2; // Rows cover wrap-reverse only; columns cover wrap and wrap-reverse.
    for (int wrapMode = wrapStart; wrapMode < wrapEnd; ++wrapMode) {
      for (int rtl = 0; rtl < 2; ++rtl) {
        for (int edgeMode = 0; edgeMode < 3; ++edgeMode) {
          auto config = YGConfigNew();
          YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
          auto root = YGNodeNewWithConfig(config);
          YGNodeStyleSetWidth(root, 100); YGNodeStyleSetHeight(root, 100);
          YGNodeStyleSetFlexDirection(root, directions[direction]);
          YGNodeStyleSetFlexWrap(root, wrapMode == 0 ? YGWrapWrap : YGWrapWrapReverse);
          YGNodeStyleSetGap(root, YGGutterAll, 10); YGNodeStyleSetAlignItems(root, YGAlignCenter); YGNodeStyleSetAlignContent(root, YGAlignFlexStart); YGNodeStyleSetJustifyContent(root, YGJustifyFlexStart);
          const float firstCross[] = {20, 40, 20};
          for (int index = 0; index < 3; ++index) {
            auto child = YGNodeNewWithConfig(config);
            YGNodeStyleSetWidth(child, column ? firstCross[index] : 40); YGNodeStyleSetHeight(child, column ? 40 : firstCross[index]);
            YGNodeStyleSetFlexGrow(child, 0); YGNodeStyleSetFlexShrink(child, 0); setMinZero(child);
            if (index == 0) {
              const auto before = column ? YGEdgeLeft : YGEdgeTop;
              const auto after = column ? YGEdgeRight : YGEdgeBottom;
              if (edgeMode == 0 || edgeMode == 2) YGNodeStyleSetMarginAuto(child, before);
              if (edgeMode == 1 || edgeMode == 2) YGNodeStyleSetMarginAuto(child, after);
            }
            YGNodeInsertChild(root, child, index);
          }
          YGNodeCalculateLayout(root, YGUndefined, YGUndefined, rtl ? YGDirectionRTL : YGDirectionLTR);
          std::cout << ",{\"name\":\"auto-cross-direction-" << names[direction] << '-' << (wrapMode == 0 ? "wrap" : "wrap-reverse") << '-' << edgeNames[edgeMode] << '-' << (rtl ? "rtl" : "ltr")
                    << "\",\"width\":100,\"height\":100,\"gap\":10,\"flexDirection\":\"" << names[direction]
                    << "\",\"flexWrap\":\"" << (wrapMode == 0 ? "wrap" : "wrap-reverse") << "\",\"layoutDirection\":\"" << (rtl ? "rtl" : "ltr")
                    << "\",\"containerStyle\":{\"alignItems\":\"center\",\"alignContent\":\"flex-start\",\"justifyContent\":\"flex-start\"},\"autoMarginFixture\":true,\"autoCrossDirectionFixture\":true,\"boxes\":[";
          for (int index = 0; index < 3; ++index) { if (index) std::cout << ','; printBox(YGNodeGetChild(root, index)); }
          std::cout << ']';
          if (edgeMode != 2) {
            const bool mainReverse = column ? direction == 3 : ((direction == 1) != bool(rtl));
            const bool crossReverse = bool(wrapMode) != (column && bool(rtl));
            std::cout << ",\"classification\":\"css-cross-auto-precedence\",\"comparisonLabel\":\"CSS cross auto margins override alignment; Yoga 3.2.1 centers this wrapped item. Classified difference, not parity.\",\"pibblBoxes\":[";
            for (int index = 0; index < 3; ++index) {
              if (index) std::cout << ',';
              const int main = index == 1 ? (mainReverse ? 10 : 50) : (mainReverse ? 60 : 0);
              const int cross = index == 2 ? (crossReverse ? 30 : 50) : (crossReverse ? 60 : 0) + (index == 0 && edgeMode == 0 ? 20 : 0);
              std::cout << "{\"x\":" << (column ? cross : main) << ",\"y\":" << (column ? main : cross)
                        << ",\"width\":" << (column ? firstCross[index] : 40) << ",\"height\":" << (column ? 40 : firstCross[index]) << '}';
            }
            std::cout << ']';
          }
          std::cout << ",\"itemStyles\":[";
          for (int index = 0; index < 3; ++index) {
            if (index) std::cout << ',';
            std::cout << "{\"width\":" << (column ? firstCross[index] : 40) << ",\"height\":" << (column ? 40 : firstCross[index]) << ",\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0";
            if (index == 0) {
              if (edgeMode == 0 || edgeMode == 2) std::cout << ",\"" << (column ? "marginLeft" : "marginTop") << "\":\"auto\"";
              if (edgeMode == 1 || edgeMode == 2) std::cout << ",\"" << (column ? "marginRight" : "marginBottom") << "\":\"auto\"";
            }
            std::cout << '}';
          }
          std::cout << "]}";
          YGNodeFreeRecursive(root); YGConfigFree(config);
        }
      }
    }
  }
}


static void autoShorthandMarginCases() {
  const char* variants[] = {"all", "left-zero", "top-zero", "start-zero"};
  for (int rtl = 0; rtl < 2; ++rtl) {
    for (int variant = 0; variant < 4; ++variant) {
      auto config = YGConfigNew();
      YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
      auto root = YGNodeNewWithConfig(config);
      YGNodeStyleSetWidth(root, 200); YGNodeStyleSetHeight(root, 100); YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow); YGNodeStyleSetFlexWrap(root, YGWrapNoWrap);
      YGNodeStyleSetAlignItems(root, YGAlignCenter); YGNodeStyleSetJustifyContent(root, YGJustifyFlexStart);
      auto a = YGNodeNewWithConfig(config), b = YGNodeNewWithConfig(config);
      YGNodeStyleSetWidth(a,40); YGNodeStyleSetHeight(a,20); YGNodeStyleSetWidth(b,40); YGNodeStyleSetHeight(b,40);
      for (auto child : {a,b}) { YGNodeStyleSetFlexGrow(child,0); YGNodeStyleSetFlexShrink(child,0); setMinZero(child); }
      YGNodeStyleSetMarginAuto(a, YGEdgeAll);
      if (variant == 1) YGNodeStyleSetMargin(a, YGEdgeLeft, 0);
      if (variant == 2) YGNodeStyleSetMargin(a, YGEdgeTop, 0);
      if (variant == 3) YGNodeStyleSetMargin(a, YGEdgeStart, 0);
      YGNodeInsertChild(root,a,0); YGNodeInsertChild(root,b,1);
      YGNodeCalculateLayout(root,YGUndefined,YGUndefined,rtl ? YGDirectionRTL : YGDirectionLTR);
      std::cout << ",{\"name\":\"auto-shorthand-" << variants[variant] << '-' << (rtl ? "rtl" : "ltr")
                << "\",\"width\":200,\"height\":100,\"gap\":0,\"flexDirection\":\"row\",\"flexWrap\":\"nowrap\",\"layoutDirection\":\"" << (rtl ? "rtl" : "ltr")
                << "\",\"containerStyle\":{\"alignItems\":\"center\",\"justifyContent\":\"flex-start\"},\"autoMarginFixture\":true,\"autoShorthandMarginFixture\":true,\"boxes\":[";
      printBox(a); std::cout << ','; printBox(b); std::cout << "],\"itemStyles\":[{\"width\":40,\"height\":20,\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0,\"margin\":\"auto\"";
      if (variant == 1) std::cout << ",\"marginLeft\":0";
      if (variant == 2) std::cout << ",\"marginTop\":0";
      if (variant == 3) std::cout << ",\"marginStart\":0";
      std::cout << "},{\"width\":40,\"height\":40,\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0}]}";
      YGNodeFreeRecursive(root); YGConfigFree(config);
    }
  }
}

static void autoOpposingMarginCases() {
  struct MainCase { const char* name; float width; int kind; };
  const MainCase mainCases[] = {
    {"auto-opposing-main-grow-consumes", 200, 0},
    {"auto-opposing-main-grow-max", 200, 1},
    {"auto-opposing-main-grow-max-resized", 260, 1},
    {"auto-opposing-main-shrink-min", 100, 2},
    {"auto-opposing-main-numeric-after", 200, 3},
    {"auto-opposing-main-negative-center", 60, 4},
  };
  for (const auto& fixture : mainCases) {
    const bool grow = fixture.kind < 2;
    const bool capped = fixture.kind == 1;
    const bool shrink = fixture.kind == 2;
    const bool floor = fixture.kind == 2;
    const bool numericAfter = fixture.kind == 3;
    const bool negative = fixture.kind == 4;
    const int aBasis = grow || shrink ? 80 : 40;
    const int bBasis = shrink ? 80 : 40;
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(root, fixture.width); YGNodeStyleSetHeight(root, 100); YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow); YGNodeStyleSetFlexWrap(root, YGWrapNoWrap);
    YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetJustifyContent(root, negative ? YGJustifyCenter : YGJustifyFlexStart);
    auto a = YGNodeNewWithConfig(config), b = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(a, aBasis); YGNodeStyleSetHeight(a, 20); YGNodeStyleSetFlexBasis(a, aBasis); YGNodeStyleSetFlexGrow(a, grow ? 1 : 0); YGNodeStyleSetFlexShrink(a, shrink ? 1 : 0); setMinZero(a);
    if (capped) YGNodeStyleSetMaxWidth(a, 100); if (floor) YGNodeStyleSetMinWidth(a, 70);
    YGNodeStyleSetMarginAuto(a, YGEdgeLeft); YGNodeStyleSetMarginAuto(a, YGEdgeRight); if (numericAfter) YGNodeStyleSetMargin(a, YGEdgeRight, 10);
    YGNodeStyleSetWidth(b, bBasis); YGNodeStyleSetHeight(b, 20); YGNodeStyleSetFlexBasis(b, bBasis); YGNodeStyleSetFlexGrow(b, 0); YGNodeStyleSetFlexShrink(b, shrink ? 1 : 0); setMinZero(b);
    YGNodeInsertChild(root, a, 0); YGNodeInsertChild(root, b, 1); YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionLTR);
    std::cout << ",{\"name\":\"" << fixture.name << "\",\"width\":" << fixture.width << ",\"height\":100,\"gap\":0,\"flexDirection\":\"row\",\"flexWrap\":\"nowrap\",\"containerStyle\":{\"alignItems\":\"flex-start\",\"justifyContent\":\"" << (negative ? "center" : "flex-start") << "\"},\"autoMarginFixture\":true,\"autoOpposingMarginFixture\":true,\"boxes\":[";
    printBox(a); std::cout << ','; printBox(b); std::cout << ']';
    if (negative) std::cout << ",\"classification\":\"css-nonpositive-auto-alignment\",\"comparisonLabel\":\"CSS keeps center alignment when auto slots receive zero under negative main free space; Yoga 3.2.1 starts at the physical edge. Classified difference, not parity.\",\"pibblBoxes\":[{\"x\":-10,\"y\":0,\"width\":40,\"height\":20},{\"x\":30,\"y\":0,\"width\":40,\"height\":20}]";
    std::cout << ",\"itemStyles\":[{\"width\":" << aBasis << ",\"height\":20,\"flexBasis\":" << aBasis << ",\"flexGrow\":" << (grow ? 1 : 0) << ",\"flexShrink\":" << (shrink ? 1 : 0) << ",\"minWidth\":" << (floor ? 70 : 0) << ",\"minHeight\":0";
    if (capped) std::cout << ",\"maxWidth\":100";
    std::cout << ",\"marginLeft\":\"auto\",\"marginRight\":" << (numericAfter ? "10" : "\"auto\"") << "},{\"width\":" << bBasis << ",\"height\":20,\"flexBasis\":" << bBasis << ",\"flexGrow\":0,\"flexShrink\":" << (shrink ? 1 : 0) << ",\"minWidth\":0,\"minHeight\":0}]}";
    YGNodeFreeRecursive(root); YGConfigFree(config);
  }
  for (int bounded = 0; bounded < 2; ++bounded) {
    const bool minimum = bounded == 0;
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config); YGNodeStyleSetWidth(root, 200); YGNodeStyleSetHeight(root, 100); YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow); YGNodeStyleSetAlignItems(root, YGAlignCenter); YGNodeStyleSetJustifyContent(root, YGJustifyFlexStart);
    auto a = YGNodeNewWithConfig(config), b = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(a, 40); YGNodeStyleSetHeight(a, minimum ? 20 : 80); YGNodeStyleSetFlexGrow(a, 0); YGNodeStyleSetFlexShrink(a, 0); setMinZero(a);
    if (minimum) YGNodeStyleSetMinHeight(a, 40); else YGNodeStyleSetMaxHeight(a, 30);
    YGNodeStyleSetMarginAuto(a, YGEdgeTop); YGNodeStyleSetMarginAuto(a, YGEdgeBottom);
    YGNodeStyleSetWidth(b, 40); YGNodeStyleSetHeight(b, 20); YGNodeStyleSetFlexGrow(b, 0); YGNodeStyleSetFlexShrink(b, 0); setMinZero(b);
    YGNodeInsertChild(root, a, 0); YGNodeInsertChild(root, b, 1); YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionLTR);
    std::cout << ",{\"name\":\"auto-opposing-cross-" << (minimum ? "min" : "max") << "\",\"width\":200,\"height\":100,\"gap\":0,\"flexDirection\":\"row\",\"flexWrap\":\"nowrap\",\"containerStyle\":{\"alignItems\":\"center\",\"justifyContent\":\"flex-start\"},\"autoMarginFixture\":true,\"autoOpposingMarginFixture\":true,\"boxes\":[";
    printBox(a); std::cout << ','; printBox(b); std::cout << "],\"itemStyles\":[{\"width\":40,\"height\":" << (minimum ? 20 : 80) << ",\"minWidth\":0,\"minHeight\":" << (minimum ? 40 : 0) << ",\"flexGrow\":0,\"flexShrink\":0";
    if (!minimum) std::cout << ",\"maxHeight\":30";
    std::cout << ",\"marginTop\":\"auto\",\"marginBottom\":\"auto\"},{\"width\":40,\"height\":20,\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0}]}";
    YGNodeFreeRecursive(root); YGConfigFree(config);
  }
}

static int crossAutoTextMeasureCalls = 0;
static YGSize crossAutoTextMeasure(YGNodeConstRef, float width, YGMeasureMode widthMode, float, YGMeasureMode) {
  crossAutoTextMeasureCalls++;
  // `aaaa` is 4 glyphs × 6; spaces are 6. At 80, two words (54) fit;
  // at 40, each 24px word occupies a line. This is a probe callback only.
  const float usedWidth = widthMode == YGMeasureModeUndefined ? 84 : width;
  float lineWidth = 0, maxWidth = 0; int lines = 1;
  for (int word = 0; word < 3; ++word) {
    const float nextWidth = lineWidth == 0 ? 24 : lineWidth + 30;
    if (lineWidth != 0 && nextWidth > usedWidth) { maxWidth = maxWidth > lineWidth ? maxWidth : lineWidth; ++lines; lineWidth = 24; }
    else lineWidth = nextWidth;
  }
  maxWidth = maxWidth > lineWidth ? maxWidth : lineWidth;
  return {maxWidth, float(lines * 10)};
}
static void textCrossAutoCases() {
 for(int narrow=0;narrow<2;narrow++) {
  const int textWidth=narrow?40:80; crossAutoTextMeasureCalls=0;
  auto config=YGConfigNew();YGConfigSetUseWebDefaults(config,false);YGConfigSetPointScaleFactor(config,0);YGConfigSetErrata(config,YGErrataNone);
  auto root=YGNodeNewWithConfig(config);YGNodeStyleSetWidth(root,160);YGNodeStyleSetHeight(root,100);YGNodeStyleSetFlexDirection(root,YGFlexDirectionRow);YGNodeStyleSetFlexWrap(root,YGWrapNoWrap);YGNodeStyleSetAlignItems(root,YGAlignStretch);YGNodeStyleSetJustifyContent(root,YGJustifyFlexStart);
  auto text=YGNodeNewWithConfig(config), sibling=YGNodeNewWithConfig(config);YGNodeStyleSetWidth(text,textWidth);YGNodeStyleSetFlexGrow(text,0);YGNodeStyleSetFlexShrink(text,0);setMinZero(text);YGNodeSetMeasureFunc(text,crossAutoTextMeasure);YGNodeStyleSetMarginAuto(text,YGEdgeTop);
  YGNodeStyleSetWidth(sibling,40);YGNodeStyleSetHeight(sibling,40);YGNodeStyleSetFlexGrow(sibling,0);YGNodeStyleSetFlexShrink(sibling,0);setMinZero(sibling);
  YGNodeInsertChild(root,text,0);YGNodeInsertChild(root,sibling,1);YGNodeCalculateLayout(root,YGUndefined,YGUndefined,YGDirectionLTR);
  std::cout << ",{\"name\":\"text-cross-auto-top-stretch-"<<(narrow?"narrow":"wide")<<"\",\"width\":160,\"height\":100,\"gap\":0,\"flexDirection\":\"row\",\"flexWrap\":\"nowrap\",\"containerStyle\":{\"alignItems\":\"stretch\",\"justifyContent\":\"flex-start\"},\"autoMarginFixture\":true,\"textCrossAutoFixture\":true,\"textValue\":\"aaaa aaaa aaaa\",\"textMeasure\":{\"kind\":\"deterministic-callback\",\"font\":\"10px monospace\",\"glyphAdvance\":6,\"spaceAdvance\":6,\"lineHeight\":10,\"wrapAtSpaces\":true,\"fontParityClaim\":false,\"calls\":"<<crossAutoTextMeasureCalls<<"},\"boxes\":[";printBox(text);std::cout<<',';printBox(sibling);std::cout<<"],\"itemStyles\":[{\"width\":"<<textWidth<<",\"wrap\":true,\"font\":\"10px monospace\",\"lineHeight\":10,\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0,\"marginTop\":\"auto\"},{\"width\":40,\"height\":40,\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0}]}\n";
  YGNodeFreeRecursive(root);YGConfigFree(config);
 }
}

static int customMeasureCalls = 0;
static YGSize customCellMeasure(YGNodeConstRef, float width, YGMeasureMode widthMode, float, YGMeasureMode) {
  customMeasureCalls++;
  const float usedWidth = widthMode == YGMeasureModeUndefined ? 160 : width;
  const int columns = std::max(1, int(usedWidth / 20));
  const int rows = (8 + columns - 1) / columns;
  return {usedWidth, float(rows * 10)};
}
static void customCrossAutoCases() {
  for (int narrow = 0; narrow < 2; ++narrow) {
    const int width = narrow ? 40 : 80; customMeasureCalls = 0;
    auto config = YGConfigNew(); YGConfigSetUseWebDefaults(config,false); YGConfigSetPointScaleFactor(config,0); YGConfigSetErrata(config,YGErrataNone);
    auto root=YGNodeNewWithConfig(config);YGNodeStyleSetWidth(root,160);YGNodeStyleSetHeight(root,100);YGNodeStyleSetFlexDirection(root,YGFlexDirectionRow);YGNodeStyleSetFlexWrap(root,YGWrapNoWrap);YGNodeStyleSetAlignItems(root,YGAlignStretch);YGNodeStyleSetJustifyContent(root,YGJustifyFlexStart);
    auto a=YGNodeNewWithConfig(config),b=YGNodeNewWithConfig(config);YGNodeStyleSetWidth(a,width);YGNodeStyleSetFlexGrow(a,0);YGNodeStyleSetFlexShrink(a,0);setMinZero(a);YGNodeSetMeasureFunc(a,customCellMeasure);YGNodeStyleSetMarginAuto(a,YGEdgeTop);
    YGNodeStyleSetWidth(b,40);YGNodeStyleSetHeight(b,40);YGNodeStyleSetFlexGrow(b,0);YGNodeStyleSetFlexShrink(b,0);setMinZero(b);YGNodeInsertChild(root,a,0);YGNodeInsertChild(root,b,1);YGNodeCalculateLayout(root,YGUndefined,YGUndefined,YGDirectionLTR);
    std::cout << ",{\"name\":\"custom-cross-auto-top-stretch-"<<(narrow?"narrow":"wide")<<"\",\"width\":160,\"height\":100,\"gap\":0,\"flexDirection\":\"row\",\"flexWrap\":\"nowrap\",\"containerStyle\":{\"alignItems\":\"stretch\",\"justifyContent\":\"flex-start\"},\"autoMarginFixture\":true,\"customCrossAutoFixture\":true,\"customMeasure\":{\"kind\":\"deterministic-cell-callback\",\"jobs\":8,\"cellWidth\":20,\"rowHeight\":10,\"columns\":\"max(1,floor(width/20))\",\"rows\":\"ceil(8/columns)\",\"calls\":"<<customMeasureCalls<<"},\"boxes\":[";printBox(a);std::cout<<',';printBox(b);std::cout<<"],\"itemStyles\":[{\"width\":"<<width<<",\"minWidth\":0,\"flexShrink\":0,\"marginTop\":\"auto\"},{\"width\":40,\"height\":40,\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0}]}\n";
    YGNodeFreeRecursive(root);YGConfigFree(config);
  }
}


static void ownerCrossAutoCases() {
  for (int narrow = 0; narrow < 2; ++narrow) {
    const int ownerWidth = narrow ? 90 : 160;
    auto config = YGConfigNew(); YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(root, 240); YGNodeStyleSetHeight(root, 120);
    YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow); YGNodeStyleSetFlexWrap(root, YGWrapNoWrap);
    YGNodeStyleSetAlignItems(root, YGAlignStretch); YGNodeStyleSetJustifyContent(root, YGJustifyFlexStart);
    auto owner = YGNodeNewWithConfig(config), sibling = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(owner, ownerWidth); YGNodeStyleSetFlexDirection(owner, YGFlexDirectionRow); YGNodeStyleSetFlexWrap(owner, YGWrapWrap);
    YGNodeStyleSetGap(owner, YGGutterAll, 10); YGNodeStyleSetAlignItems(owner, YGAlignFlexStart);
    YGNodeStyleSetFlexGrow(owner, 0); YGNodeStyleSetFlexShrink(owner, 0); setMinZero(owner); YGNodeStyleSetMarginAuto(owner, YGEdgeTop);
    const int heights[] = {20, 30, 20};
    for (int index = 0; index < 3; ++index) {
      auto leaf = YGNodeNewWithConfig(config);
      YGNodeStyleSetWidth(leaf, 70); YGNodeStyleSetHeight(leaf, heights[index]);
      YGNodeStyleSetFlexGrow(leaf, 0); YGNodeStyleSetFlexShrink(leaf, 0); setMinZero(leaf);
      YGNodeInsertChild(owner, leaf, index);
    }
    YGNodeStyleSetWidth(sibling, 40); YGNodeStyleSetHeight(sibling, 40);
    YGNodeStyleSetFlexGrow(sibling, 0); YGNodeStyleSetFlexShrink(sibling, 0); setMinZero(sibling);
    YGNodeInsertChild(root, owner, 0); YGNodeInsertChild(root, sibling, 1);
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionLTR);
    std::cout << ",{\"name\":\"owner-cross-auto-top-stretch-" << (narrow ? "narrow" : "wide")
              << "\",\"width\":240,\"height\":120,\"gap\":0,\"flexDirection\":\"row\",\"flexWrap\":\"nowrap\""
              << ",\"containerStyle\":{\"alignItems\":\"stretch\",\"justifyContent\":\"flex-start\"},\"autoMarginFixture\":true,\"ownerCrossAutoFixture\":true,\"boxes\":[";
    printBox(owner); std::cout << ','; printBox(sibling);
    std::cout << "],\"ownerNestedBoxes\":[";
    for (int index = 0; index < 3; ++index) { if (index) std::cout << ','; printBox(YGNodeGetChild(owner, index), YGNodeLayoutGetLeft(owner), YGNodeLayoutGetTop(owner)); }
    std::cout << "],\"ownerStyle\":{\"width\":" << ownerWidth << ",\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0,\"flexDirection\":\"row\",\"flexWrap\":\"wrap\",\"gap\":10,\"alignItems\":\"flex-start\",\"marginTop\":\"auto\"}"
              << ",\"ownerLeafStyles\":[{\"width\":70,\"height\":20,\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0},{\"width\":70,\"height\":30,\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0},{\"width\":70,\"height\":20,\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0}]"
              << ",\"itemStyles\":[{\"width\":" << ownerWidth << ",\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0,\"flexDirection\":\"row\",\"flexWrap\":\"wrap\",\"gap\":10,\"alignItems\":\"flex-start\",\"marginTop\":\"auto\"},{\"width\":40,\"height\":40,\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0}]}";
    YGNodeFreeRecursive(root); YGConfigFree(config);
  }
}


static void roundingCases() {
  auto config = YGConfigNew();
  YGConfigSetUseWebDefaults(config, false);
  YGConfigSetPointScaleFactor(config, 0);
  YGConfigSetErrata(config, YGErrataNone);
  auto root = YGNodeNewWithConfig(config);
  YGNodeStyleSetWidth(root, 101.25f);
  YGNodeStyleSetHeight(root, 61.5f);
  YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow);
  YGNodeStyleSetFlexWrap(root, YGWrapNoWrap);
  YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
  YGNodeStyleSetAlignContent(root, YGAlignFlexStart);
  YGNodeStyleSetGap(root, YGGutterAll, 2.5f);
  const float heights[] = {10.375f, 12.625f};
  for (int index = 0; index < 2; ++index) {
    auto child = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(child, 20.125f);
    YGNodeStyleSetHeight(child, heights[index]);
    YGNodeStyleSetFlexBasis(child, 20.125f);
    YGNodeStyleSetFlexGrow(child, 1);
    YGNodeStyleSetFlexShrink(child, 0);
    setMinZero(child);
    YGNodeInsertChild(root, child, index);
  }
  YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionLTR);
  std::cout << ",{\"name\":\"rounding-scale-zero-row\",\"width\":101.25,\"height\":61.5,\"gap\":2.5,\"flexDirection\":\"row\",\"flexWrap\":\"nowrap\",\"roundingFixture\":true,\"containerStyle\":{\"alignItems\":\"flex-start\",\"alignContent\":\"flex-start\"},\"boxes\":[";
  printBox(YGNodeGetChild(root, 0)); std::cout << ','; printBox(YGNodeGetChild(root, 1));
  std::cout << "],\"itemStyles\":[{\"width\":20.125,\"height\":10.375,\"flexBasis\":20.125,\"flexGrow\":1,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"width\":20.125,\"height\":12.625,\"flexBasis\":20.125,\"flexGrow\":1,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
  YGNodeFreeRecursive(root);
  YGConfigFree(config);
}


static void nestedCrossMinimumDecoratedReverseCases() {
  for (int resize = 0; resize < 2; ++resize) {
    const bool resized = resize == 1;
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false);
    YGConfigSetPointScaleFactor(config, 0);
    YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
    YGNodeStyleSetWidth(root, 244);
    YGNodeStyleSetHeight(root, resized ? 204 : 144);
    YGNodeStyleSetFlexDirection(root, YGFlexDirectionRowReverse);
    YGNodeStyleSetFlexWrap(root, YGWrapWrap);
    YGNodeStyleSetGap(root, YGGutterAll, 12);
    YGNodeStyleSetAlignItems(root, YGAlignStretch);
    YGNodeStyleSetAlignContent(root, YGAlignFlexStart);
    YGNodeStyleSetPadding(root, YGEdgeLeft, 10);
    YGNodeStyleSetPadding(root, YGEdgeRight, 30);
    YGNodeStyleSetPadding(root, YGEdgeTop, 20);
    YGNodeStyleSetPadding(root, YGEdgeBottom, 20);
    YGNodeStyleSetBorder(root, YGEdgeAll, 2);

    auto nested = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(nested, 80);
    YGNodeStyleSetFlexBasis(nested, 80);
    YGNodeStyleSetFlexGrow(nested, 0);
    YGNodeStyleSetFlexShrink(nested, 0);
    YGNodeStyleSetFlexDirection(nested, YGFlexDirectionRow);
    YGNodeStyleSetAlignItems(nested, YGAlignFlexStart);
    setMinZero(nested);
    YGNodeStyleSetMinHeightPercent(nested, 60);
    for (int leafIndex = 0; leafIndex < 2; ++leafIndex) {
      auto leaf = YGNodeNewWithConfig(config);
      YGNodeStyleSetWidth(leaf, 40);
      YGNodeStyleSetHeight(leaf, 20);
      YGNodeStyleSetFlexGrow(leaf, 0);
      YGNodeStyleSetFlexShrink(leaf, 0);
      setMinZero(leaf);
      YGNodeInsertChild(nested, leaf, leafIndex);
    }
    YGNodeInsertChild(root, nested, 0);
    for (int index = 1; index < 3; ++index) {
      auto child = YGNodeNewWithConfig(config);
      YGNodeStyleSetWidth(child, 80);
      YGNodeStyleSetHeight(child, index == 1 ? 40 : 20);
      YGNodeStyleSetFlexBasis(child, 80);
      YGNodeStyleSetFlexGrow(child, 0);
      YGNodeStyleSetFlexShrink(child, 0);
      setMinZero(child);
      YGNodeInsertChild(root, child, index);
    }
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionLTR);
    auto a = YGNodeGetChild(root, 0);
    std::cout << ",{\"name\":\"nested-cross-min-decorated-row-reverse" << (resized ? "-resized" : "")
              << "\",\"width\":244,\"height\":" << (resized ? 204 : 144)
              << ",\"gap\":12,\"flexDirection\":\"row-reverse\",\"flexWrap\":\"wrap\",\"nestedDecoratedCrossMinFixture\":true,\"containerStyle\":{\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":20},\"borderWidth\":2,\"alignItems\":\"stretch\",\"alignContent\":\"flex-start\"},\"boxes\":[";
    for (int index = 0; index < 3; ++index) { if (index) std::cout << ','; printBox(YGNodeGetChild(root, index)); }
    std::cout << "],\"nestedDecoratedBoxes\":[";
    for (int leafIndex = 0; leafIndex < 2; ++leafIndex) { if (leafIndex) std::cout << ','; printBox(YGNodeGetChild(a, leafIndex), YGNodeLayoutGetLeft(a), YGNodeLayoutGetTop(a)); }
    std::cout << "],\"nestedOwnerStyle\":{\"width\":80,\"flexBasis\":80,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":\"60%\",\"flexDirection\":\"row\",\"alignItems\":\"flex-start\"},\"nestedItemStyles\":[{\"width\":40,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"width\":40,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}],\"itemStyles\":[{\"width\":80,\"height\":\"auto\",\"flexBasis\":80,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":\"60%\"},{\"width\":80,\"height\":40,\"flexBasis\":80,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"width\":80,\"height\":20,\"flexBasis\":80,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}] }";
    YGNodeFreeRecursive(root);
    YGConfigFree(config);
  }
}


static void nestedCrossMaximumDecoratedReverseCases() {
  for (int resize = 0; resize < 2; ++resize) {
    const bool resized = resize == 1;
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false);
    YGConfigSetPointScaleFactor(config, 0);
    YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
    YGNodeStyleSetWidth(root, 244); YGNodeStyleSetHeight(root, resized ? 204 : 144);
    YGNodeStyleSetFlexDirection(root, YGFlexDirectionRowReverse); YGNodeStyleSetFlexWrap(root, YGWrapWrap);
    YGNodeStyleSetGap(root, YGGutterAll, 12); YGNodeStyleSetAlignItems(root, YGAlignStretch); YGNodeStyleSetAlignContent(root, YGAlignFlexStart);
    YGNodeStyleSetPadding(root, YGEdgeLeft, 10); YGNodeStyleSetPadding(root, YGEdgeRight, 30); YGNodeStyleSetPadding(root, YGEdgeTop, 20); YGNodeStyleSetPadding(root, YGEdgeBottom, 20);
    YGNodeStyleSetBorder(root, YGEdgeAll, 2);
    auto nested = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(nested, 80); YGNodeStyleSetHeight(nested, 60); YGNodeStyleSetFlexBasis(nested, 80); YGNodeStyleSetFlexGrow(nested, 0); YGNodeStyleSetFlexShrink(nested, 0);
    YGNodeStyleSetFlexDirection(nested, YGFlexDirectionRow); YGNodeStyleSetAlignItems(nested, YGAlignStretch); setMinZero(nested); YGNodeStyleSetMaxHeightPercent(nested, 25);
    for (int leafIndex = 0; leafIndex < 2; ++leafIndex) {
      auto leaf = YGNodeNewWithConfig(config);
      YGNodeStyleSetWidth(leaf, 40); YGNodeStyleSetHeightPercent(leaf, 100); YGNodeStyleSetFlexGrow(leaf, 0); YGNodeStyleSetFlexShrink(leaf, 0); setMinZero(leaf);
      YGNodeInsertChild(nested, leaf, leafIndex);
    }
    YGNodeInsertChild(root, nested, 0);
    for (int index = 1; index < 3; ++index) {
      auto child = YGNodeNewWithConfig(config);
      YGNodeStyleSetWidth(child, 80); YGNodeStyleSetHeight(child, index == 1 ? 40 : 20); YGNodeStyleSetFlexBasis(child, 80); YGNodeStyleSetFlexGrow(child, 0); YGNodeStyleSetFlexShrink(child, 0); setMinZero(child);
      YGNodeInsertChild(root, child, index);
    }
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionLTR);
    auto a = YGNodeGetChild(root, 0);
    std::cout << ",{\"name\":\"nested-cross-max-decorated-row-reverse" << (resized ? "-resized" : "")
              << "\",\"width\":244,\"height\":" << (resized ? 204 : 144)
              << ",\"gap\":12,\"flexDirection\":\"row-reverse\",\"flexWrap\":\"wrap\",\"nestedDecoratedCrossMaxFixture\":true,\"containerStyle\":{\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":20},\"borderWidth\":2,\"alignItems\":\"stretch\",\"alignContent\":\"flex-start\"},\"boxes\":[";
    for (int index = 0; index < 3; ++index) { if (index) std::cout << ','; printBox(YGNodeGetChild(root, index)); }
    std::cout << "],\"nestedDecoratedMaxBoxes\":[";
    for (int leafIndex = 0; leafIndex < 2; ++leafIndex) { if (leafIndex) std::cout << ','; printBox(YGNodeGetChild(a, leafIndex), YGNodeLayoutGetLeft(a), YGNodeLayoutGetTop(a)); }
    std::cout << "],\"nestedOwnerStyle\":{\"width\":80,\"height\":60,\"flexBasis\":80,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"maxHeight\":\"25%\",\"flexDirection\":\"row\",\"alignItems\":\"stretch\"},\"nestedItemStyles\":[{\"width\":40,\"height\":\"100%\",\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"width\":40,\"height\":\"100%\",\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}],\"itemStyles\":[{\"width\":80,\"height\":60,\"flexBasis\":80,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"maxHeight\":\"25%\"},{\"width\":80,\"height\":40,\"flexBasis\":80,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"width\":80,\"height\":20,\"flexBasis\":80,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}] }";
    YGNodeFreeRecursive(root); YGConfigFree(config);
  }
}


static void nestedCrossMaximumDecoratedColumnReverseCases() {
  for (int resize = 0; resize < 2; ++resize) {
    const bool resized = resize == 1;
    auto config = YGConfigNew(); YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox); YGNodeStyleSetWidth(root, resized ? 204 : 144); YGNodeStyleSetHeight(root, 244);
    YGNodeStyleSetFlexDirection(root, YGFlexDirectionColumnReverse); YGNodeStyleSetFlexWrap(root, YGWrapWrap); YGNodeStyleSetGap(root, YGGutterAll, 12);
    YGNodeStyleSetAlignItems(root, YGAlignStretch); YGNodeStyleSetAlignContent(root, YGAlignFlexStart);
    YGNodeStyleSetPadding(root, YGEdgeLeft, 20); YGNodeStyleSetPadding(root, YGEdgeRight, 20); YGNodeStyleSetPadding(root, YGEdgeTop, 10); YGNodeStyleSetPadding(root, YGEdgeBottom, 30); YGNodeStyleSetBorder(root, YGEdgeAll, 2);
    auto nested = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(nested, 60); YGNodeStyleSetHeight(nested, 80); YGNodeStyleSetFlexBasis(nested, 80); YGNodeStyleSetFlexGrow(nested, 0); YGNodeStyleSetFlexShrink(nested, 0);
    YGNodeStyleSetFlexDirection(nested, YGFlexDirectionColumn); YGNodeStyleSetAlignItems(nested, YGAlignStretch); setMinZero(nested); YGNodeStyleSetMaxWidthPercent(nested, 25);
    for (int leafIndex=0; leafIndex<2; ++leafIndex) {
      auto leaf=YGNodeNewWithConfig(config); YGNodeStyleSetWidthPercent(leaf,100); YGNodeStyleSetHeight(leaf,40); YGNodeStyleSetFlexGrow(leaf,0); YGNodeStyleSetFlexShrink(leaf,0); setMinZero(leaf); YGNodeInsertChild(nested,leaf,leafIndex);
    }
    YGNodeInsertChild(root,nested,0);
    for(int index=1;index<3;++index){auto child=YGNodeNewWithConfig(config); YGNodeStyleSetWidth(child,index==1?40:20); YGNodeStyleSetHeight(child,80); YGNodeStyleSetFlexBasis(child,80); YGNodeStyleSetFlexGrow(child,0); YGNodeStyleSetFlexShrink(child,0); setMinZero(child); YGNodeInsertChild(root,child,index);}
    YGNodeCalculateLayout(root,YGUndefined,YGUndefined,YGDirectionLTR);
    auto a=YGNodeGetChild(root,0);
    std::cout<<",{\"name\":\"nested-cross-max-decorated-column-reverse"<<(resized?"-resized":"")<<"\",\"width\":"<<(resized?204:144)<<",\"height\":244,\"gap\":12,\"flexDirection\":\"column-reverse\",\"flexWrap\":\"wrap\",\"nestedDecoratedColumnCrossMaxFixture\":true,\"containerStyle\":{\"boxSizing\":\"border-box\",\"padding\":{\"left\":20,\"right\":20,\"top\":10,\"bottom\":30},\"borderWidth\":2,\"alignItems\":\"stretch\",\"alignContent\":\"flex-start\"},\"boxes\":[";
    for(int index=0;index<3;++index){if(index)std::cout<<',';printBox(YGNodeGetChild(root,index));}
    std::cout<<"],\"nestedDecoratedColumnMaxBoxes\":[";
    for(int leafIndex=0;leafIndex<2;++leafIndex){if(leafIndex)std::cout<<',';printBox(YGNodeGetChild(a,leafIndex),YGNodeLayoutGetLeft(a),YGNodeLayoutGetTop(a));}
    std::cout<<"],\"nestedOwnerStyle\":{\"width\":60,\"height\":80,\"flexBasis\":80,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"maxWidth\":\"25%\",\"flexDirection\":\"column\",\"alignItems\":\"stretch\"},\"nestedItemStyles\":[{\"width\":\"100%\",\"height\":40,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"width\":\"100%\",\"height\":40,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}],\"itemStyles\":[{\"width\":60,\"height\":80,\"flexBasis\":80,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"maxWidth\":\"25%\"},{\"width\":40,\"height\":80,\"flexBasis\":80,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"width\":20,\"height\":80,\"flexBasis\":80,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}] }";
    YGNodeFreeRecursive(root); YGConfigFree(config);
  }
}


static void nestedCrossMinimumDecoratedColumnReverseCases() {
  for (int resize=0; resize<2; ++resize) {
    const bool resized=resize==1; auto config=YGConfigNew(); YGConfigSetUseWebDefaults(config,false); YGConfigSetPointScaleFactor(config,0); YGConfigSetErrata(config,YGErrataNone);
    auto root=YGNodeNewWithConfig(config); YGNodeStyleSetBoxSizing(root,YGBoxSizingBorderBox); YGNodeStyleSetWidth(root,resized?204:144); YGNodeStyleSetHeight(root,244); YGNodeStyleSetFlexDirection(root,YGFlexDirectionColumnReverse); YGNodeStyleSetFlexWrap(root,YGWrapWrap); YGNodeStyleSetGap(root,YGGutterAll,12); YGNodeStyleSetAlignItems(root,YGAlignStretch); YGNodeStyleSetAlignContent(root,YGAlignFlexStart); YGNodeStyleSetPadding(root,YGEdgeLeft,20); YGNodeStyleSetPadding(root,YGEdgeRight,20); YGNodeStyleSetPadding(root,YGEdgeTop,10); YGNodeStyleSetPadding(root,YGEdgeBottom,30); YGNodeStyleSetBorder(root,YGEdgeAll,2);
    auto nested=YGNodeNewWithConfig(config); YGNodeStyleSetWidth(nested,20); YGNodeStyleSetHeight(nested,80); YGNodeStyleSetFlexBasis(nested,80); YGNodeStyleSetFlexGrow(nested,0); YGNodeStyleSetFlexShrink(nested,0); YGNodeStyleSetFlexDirection(nested,YGFlexDirectionColumn); YGNodeStyleSetAlignItems(nested,YGAlignStretch); setMinZero(nested); YGNodeStyleSetMinWidthPercent(nested,60);
    for(int leafIndex=0;leafIndex<2;++leafIndex){auto leaf=YGNodeNewWithConfig(config); YGNodeStyleSetWidthPercent(leaf,100); YGNodeStyleSetHeight(leaf,40); YGNodeStyleSetFlexGrow(leaf,0); YGNodeStyleSetFlexShrink(leaf,0); setMinZero(leaf); YGNodeInsertChild(nested,leaf,leafIndex);}
    YGNodeInsertChild(root,nested,0);
    for(int index=1;index<3;++index){auto child=YGNodeNewWithConfig(config);YGNodeStyleSetWidth(child,index==1?40:20);YGNodeStyleSetHeight(child,80);YGNodeStyleSetFlexBasis(child,80);YGNodeStyleSetFlexGrow(child,0);YGNodeStyleSetFlexShrink(child,0);setMinZero(child);YGNodeInsertChild(root,child,index);}
    YGNodeCalculateLayout(root,YGUndefined,YGUndefined,YGDirectionLTR); auto a=YGNodeGetChild(root,0);
    std::cout<<",{\"name\":\"nested-cross-min-decorated-column-reverse"<<(resized?"-resized":"")<<"\",\"width\":"<<(resized?204:144)<<",\"height\":244,\"gap\":12,\"flexDirection\":\"column-reverse\",\"flexWrap\":\"wrap\",\"nestedDecoratedColumnCrossMinFixture\":true,\"containerStyle\":{\"boxSizing\":\"border-box\",\"padding\":{\"left\":20,\"right\":20,\"top\":10,\"bottom\":30},\"borderWidth\":2,\"alignItems\":\"stretch\",\"alignContent\":\"flex-start\"},\"boxes\":[";
    for(int index=0;index<3;++index){if(index)std::cout<<',';printBox(YGNodeGetChild(root,index));}
    std::cout<<"],\"nestedDecoratedColumnMinBoxes\":[";for(int leafIndex=0;leafIndex<2;++leafIndex){if(leafIndex)std::cout<<',';printBox(YGNodeGetChild(a,leafIndex),YGNodeLayoutGetLeft(a),YGNodeLayoutGetTop(a));}
    std::cout<<"],\"nestedOwnerStyle\":{\"width\":20,\"height\":80,\"flexBasis\":80,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":\"60%\",\"minHeight\":0,\"flexDirection\":\"column\",\"alignItems\":\"stretch\"},\"nestedItemStyles\":[{\"width\":\"100%\",\"height\":40,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"width\":\"100%\",\"height\":40,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}],\"itemStyles\":[{\"width\":20,\"height\":80,\"flexBasis\":80,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":\"60%\",\"minHeight\":0},{\"width\":40,\"height\":80,\"flexBasis\":80,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"width\":20,\"height\":80,\"flexBasis\":80,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}] }";
    YGNodeFreeRecursive(root);YGConfigFree(config);
  }
}


static void customColumnMeasureCases() {
  for (int resize = 0; resize < 2; ++resize) {
    const int width = resize ? 60 : 40;
    customMeasureCalls = 0;
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(root, 120); YGNodeStyleSetHeight(root, 140);
    YGNodeStyleSetFlexDirection(root, YGFlexDirectionColumn); YGNodeStyleSetFlexWrap(root, YGWrapNoWrap);
    YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetAlignContent(root, YGAlignFlexStart);
    auto queue = YGNodeNewWithConfig(config), follower = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(queue, width); YGNodeStyleSetHeightAuto(queue); YGNodeStyleSetFlexBasisAuto(queue); YGNodeStyleSetFlexGrow(queue, 0); YGNodeStyleSetFlexShrink(queue, 0); setMinZero(queue);
    YGNodeSetMeasureFunc(queue, customCellMeasure);
    YGNodeStyleSetWidth(follower, 20); YGNodeStyleSetHeight(follower, 20); YGNodeStyleSetFlexGrow(follower, 0); YGNodeStyleSetFlexShrink(follower, 0); setMinZero(follower);
    YGNodeInsertChild(root, queue, 0); YGNodeInsertChild(root, follower, 1);
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionLTR);
    std::cout << ",{\"name\":\"custom-column-measure" << (resize ? "-resized" : "")
              << "\",\"width\":120,\"height\":140,\"gap\":0,\"flexDirection\":\"column\",\"flexWrap\":\"nowrap\",\"containerStyle\":{\"alignItems\":\"flex-start\",\"alignContent\":\"flex-start\"},\"customColumnMeasureFixture\":true,\"customMeasure\":{\"kind\":\"deterministic-cell-callback\",\"jobs\":8,\"cellWidth\":20,\"rowHeight\":10,\"columns\":\"max(1,floor(width/20))\",\"rows\":\"ceil(8/columns)\",\"exactWidth\":true,\"calls\":" << customMeasureCalls << "},\"boxes\":[";
    printBox(queue); std::cout << ','; printBox(follower);
    std::cout << "],\"itemStyles\":[{\"width\":" << width << ",\"height\":\"auto\",\"flexBasis\":\"auto\",\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"width\":20,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
    YGNodeFreeRecursive(root); YGConfigFree(config);
  }
}

static void relativeStaticCases() {
  for (int variant = 0; variant < 6; ++variant) {
    const bool rtl = variant == 1 || variant == 3 || variant == 5;
    const bool relative = variant >= 2;
    const bool soleOpposite = variant >= 4;
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false);
    YGConfigSetPointScaleFactor(config, 0);
    YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(root, 160);
    YGNodeStyleSetHeight(root, 60);
    YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow);
    YGNodeStyleSetFlexWrap(root, YGWrapNoWrap);
    YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
    YGNodeStyleSetGap(root, YGGutterAll, 10);
    for (int item = 0; item < 2; ++item) {
      auto child = YGNodeNewWithConfig(config);
      YGNodeStyleSetWidth(child, 50);
      YGNodeStyleSetHeight(child, 20);
      YGNodeStyleSetFlexGrow(child, 0);
      YGNodeStyleSetFlexShrink(child, 0);
      YGNodeStyleSetMinWidth(child, 0);
      YGNodeStyleSetMinHeight(child, 0);
      if (item == 0) {
        YGNodeStyleSetPositionType(child, relative ? YGPositionTypeRelative : YGPositionTypeStatic);
        if (soleOpposite) {
          YGNodeStyleSetPosition(child, YGEdgeRight, 18);
          YGNodeStyleSetPosition(child, YGEdgeBottom, 10);
        } else {
          YGNodeStyleSetPosition(child, YGEdgeLeft, 12);
          YGNodeStyleSetPosition(child, YGEdgeRight, 18);
          YGNodeStyleSetPosition(child, YGEdgeTop, 8);
          YGNodeStyleSetPosition(child, YGEdgeBottom, 10);
        }
      }
      YGNodeInsertChild(root, child, item);
    }
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, rtl ? YGDirectionRTL : YGDirectionLTR);
    const char* mode = relative ? "relative" : "static";
    std::cout << ",{\"name\":\"position-" << mode << (soleOpposite ? "-right-bottom-" : "-all-") << (rtl ? "rtl" : "ltr")
              << "\",\"width\":160,\"height\":60,\"gap\":10,\"flexDirection\":\"row\",\"flexWrap\":\"nowrap\",\"layoutDirection\":\"" << (rtl ? "rtl" : "ltr")
              << "\",\"containerStyle\":{\"alignItems\":\"flex-start\"},\"relativeStaticFixture\":true,\"boxes\":[";
    for (int item = 0; item < 2; ++item) {
      auto child = YGNodeGetChild(root, item);
      if (item) std::cout << ",";
      std::cout << "{\"x\":" << YGNodeLayoutGetLeft(child) << ",\"y\":" << YGNodeLayoutGetTop(child)
                << ",\"width\":" << YGNodeLayoutGetWidth(child) << ",\"height\":" << YGNodeLayoutGetHeight(child) << "}";
    }
    std::cout << "],\"itemStyles\":[{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"position\":\"" << mode << "\"";
    if (soleOpposite) std::cout << ",\"right\":18,\"bottom\":10";
    else std::cout << ",\"left\":12,\"right\":18,\"top\":8,\"bottom\":10";
    std::cout << "},{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
    YGNodeFreeRecursive(root);
    YGConfigFree(config);
  }
}


static void decoratedRelativeStaticCases() {
  for (int variant = 0; variant < 4; ++variant) {
    const bool rtl = variant == 1 || variant == 3;
    const bool relative = variant >= 2;
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false);
    YGConfigSetPointScaleFactor(config, 0);
    YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
    YGNodeStyleSetWidth(root, 204);
    YGNodeStyleSetHeight(root, 104);
    YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow);
    YGNodeStyleSetFlexWrap(root, YGWrapNoWrap);
    YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
    YGNodeStyleSetGap(root, YGGutterAll, 10);
    YGNodeStyleSetPadding(root, YGEdgeLeft, 10);
    YGNodeStyleSetPadding(root, YGEdgeRight, 30);
    YGNodeStyleSetPadding(root, YGEdgeTop, 20);
    YGNodeStyleSetPadding(root, YGEdgeBottom, 20);
    YGNodeStyleSetBorder(root, YGEdgeAll, 2);
    for (int item = 0; item < 2; ++item) {
      auto child = YGNodeNewWithConfig(config);
      YGNodeStyleSetWidth(child, 50);
      YGNodeStyleSetHeight(child, 20);
      YGNodeStyleSetFlexGrow(child, 0);
      YGNodeStyleSetFlexShrink(child, 0);
      YGNodeStyleSetMinWidth(child, 0);
      YGNodeStyleSetMinHeight(child, 0);
      if (item == 0) {
        YGNodeStyleSetPositionType(child, relative ? YGPositionTypeRelative : YGPositionTypeStatic);
        YGNodeStyleSetPosition(child, YGEdgeLeft, 12);
        YGNodeStyleSetPosition(child, YGEdgeRight, 18);
        YGNodeStyleSetPosition(child, YGEdgeTop, 8);
        YGNodeStyleSetPosition(child, YGEdgeBottom, 10);
      }
      YGNodeInsertChild(root, child, item);
    }
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, rtl ? YGDirectionRTL : YGDirectionLTR);
    const char* mode = relative ? "relative" : "static";
    std::cout << ",{\"name\":\"position-decorated-" << mode << "-all-" << (rtl ? "rtl" : "ltr")
              << "\",\"width\":204,\"height\":104,\"gap\":10,\"flexDirection\":\"row\",\"flexWrap\":\"nowrap\",\"layoutDirection\":\"" << (rtl ? "rtl" : "ltr")
              << "\",\"containerStyle\":{\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":20},\"borderWidth\":2,\"alignItems\":\"flex-start\"},\"decoratedRelativeStaticFixture\":true,\"boxes\":[";
    for (int item = 0; item < 2; ++item) {
      auto child = YGNodeGetChild(root, item);
      if (item) std::cout << ',';
      std::cout << "{\"x\":" << YGNodeLayoutGetLeft(child) << ",\"y\":" << YGNodeLayoutGetTop(child)
                << ",\"width\":" << YGNodeLayoutGetWidth(child) << ",\"height\":" << YGNodeLayoutGetHeight(child) << "}";
    }
    std::cout << "],\"itemStyles\":[{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"position\":\"" << mode
              << "\",\"left\":12,\"right\":18,\"top\":8,\"bottom\":10},{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
    YGNodeFreeRecursive(root);
    YGConfigFree(config);
  }
}


static void absoluteParticipationCases() {
  for (int variant = 0; variant < 7; ++variant) {
    const bool rtl = variant == 1 || variant == 3 || variant == 5;
    const bool allInsets = variant == 0 || variant == 1;
    const bool trailingOnly = variant == 4 || variant == 5;
    const bool overlapLeft = variant == 6;
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false);
    YGConfigSetPointScaleFactor(config, 0);
    YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
    YGNodeStyleSetWidth(root, 204);
    YGNodeStyleSetHeight(root, 104);
    YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow);
    YGNodeStyleSetFlexWrap(root, YGWrapNoWrap);
    YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
    YGNodeStyleSetGap(root, YGGutterAll, 10);
    YGNodeStyleSetPadding(root, YGEdgeLeft, 10);
    YGNodeStyleSetPadding(root, YGEdgeRight, 30);
    YGNodeStyleSetPadding(root, YGEdgeTop, 20);
    YGNodeStyleSetPadding(root, YGEdgeBottom, 20);
    YGNodeStyleSetBorder(root, YGEdgeAll, 2);
    for (int item = 0; item < 3; ++item) {
      auto child = YGNodeNewWithConfig(config);
      YGNodeStyleSetWidth(child, item == 1 ? 30 : 50);
      YGNodeStyleSetHeight(child, 20);
      YGNodeStyleSetFlexGrow(child, 0);
      YGNodeStyleSetFlexShrink(child, 0);
      YGNodeStyleSetMinWidth(child, 0);
      YGNodeStyleSetMinHeight(child, 0);
      if (item == 1) {
        YGNodeStyleSetPositionType(child, YGPositionTypeAbsolute);
        if (!trailingOnly) YGNodeStyleSetPosition(child, YGEdgeLeft, overlapLeft ? 72 : 12);
        if (allInsets || trailingOnly) YGNodeStyleSetPosition(child, YGEdgeRight, 18);
        if (!trailingOnly) YGNodeStyleSetPosition(child, YGEdgeTop, 8);
        if (allInsets || trailingOnly) YGNodeStyleSetPosition(child, YGEdgeBottom, 10);
      }
      YGNodeInsertChild(root, child, item);
    }
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, rtl ? YGDirectionRTL : YGDirectionLTR);
    const char* insets = allInsets ? "all" : trailingOnly ? "right-bottom" : overlapLeft ? "left72-top8" : "left-top";
    std::cout << ",{\"name\":\"position-absolute-decorated-" << insets << "-" << (rtl ? "rtl" : "ltr")
              << "\",\"width\":204,\"height\":104,\"gap\":10,\"flexDirection\":\"row\",\"flexWrap\":\"nowrap\",\"layoutDirection\":\"" << (rtl ? "rtl" : "ltr")
              << "\",\"containerStyle\":{\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":20},\"borderWidth\":2,\"alignItems\":\"flex-start\"},\"absoluteParticipationFixture\":true,\"boxes\":[";
    for (int item = 0; item < 3; ++item) {
      auto child = YGNodeGetChild(root, item);
      if (item) std::cout << ',';
      std::cout << "{\"x\":" << YGNodeLayoutGetLeft(child) << ",\"y\":" << YGNodeLayoutGetTop(child)
                << ",\"width\":" << YGNodeLayoutGetWidth(child) << ",\"height\":" << YGNodeLayoutGetHeight(child) << "}";
    }
    std::cout << "],\"itemStyles\":[{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"width\":30,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"position\":\"absolute\"";
    if (!trailingOnly) std::cout << ",\"left\":" << (overlapLeft ? 72 : 12);
    if (allInsets || trailingOnly) std::cout << ",\"right\":18";
    if (!trailingOnly) std::cout << ",\"top\":8";
    if (allInsets || trailingOnly) std::cout << ",\"bottom\":10";
    std::cout << "},{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
    YGNodeFreeRecursive(root);
    YGConfigFree(config);
  }
}


static void absoluteAlignmentCases() {
  for (int variant = 0; variant < 6; ++variant) {
    const bool rtl = variant == 1 || variant == 3 || variant == 5;
    const bool centerEnd = variant < 4;
    const bool leftOnly = variant == 2 || variant == 3;
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false);
    YGConfigSetPointScaleFactor(config, 0);
    YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
    YGNodeStyleSetWidth(root, 204);
    YGNodeStyleSetHeight(root, 104);
    YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow);
    YGNodeStyleSetFlexWrap(root, YGWrapNoWrap);
    YGNodeStyleSetGap(root, YGGutterAll, 10);
    YGNodeStyleSetPadding(root, YGEdgeLeft, 10);
    YGNodeStyleSetPadding(root, YGEdgeRight, 30);
    YGNodeStyleSetPadding(root, YGEdgeTop, 20);
    YGNodeStyleSetPadding(root, YGEdgeBottom, 20);
    YGNodeStyleSetBorder(root, YGEdgeAll, 2);
    YGNodeStyleSetJustifyContent(root, centerEnd ? YGJustifyCenter : YGJustifyFlexStart);
    YGNodeStyleSetAlignItems(root, centerEnd ? YGAlignFlexEnd : YGAlignStretch);
    for (int item = 0; item < 3; ++item) {
      auto child = YGNodeNewWithConfig(config);
      YGNodeStyleSetWidth(child, item == 1 ? 30 : 50);
      YGNodeStyleSetHeight(child, 20);
      YGNodeStyleSetFlexGrow(child, 0);
      YGNodeStyleSetFlexShrink(child, 0);
      YGNodeStyleSetMinWidth(child, 0);
      YGNodeStyleSetMinHeight(child, 0);
      if (item == 1) {
        YGNodeStyleSetPositionType(child, YGPositionTypeAbsolute);
        if (leftOnly) YGNodeStyleSetPosition(child, YGEdgeLeft, 12);
      }
      YGNodeInsertChild(root, child, item);
    }
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, rtl ? YGDirectionRTL : YGDirectionLTR);
    const char* mode = centerEnd ? (leftOnly ? "left-center-end" : "none-center-end") : "none-default";
    std::cout << ",{\"name\":\"position-absolute-alignment-" << mode << "-" << (rtl ? "rtl" : "ltr")
              << "\",\"width\":204,\"height\":104,\"gap\":10,\"flexDirection\":\"row\",\"flexWrap\":\"nowrap\",\"layoutDirection\":\"" << (rtl ? "rtl" : "ltr")
              << "\",\"containerStyle\":{\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":20},\"borderWidth\":2,\"justifyContent\":\"" << (centerEnd ? "center" : "flex-start") << "\",\"alignItems\":\"" << (centerEnd ? "flex-end" : "stretch") << "\"},\"absoluteAlignmentFixture\":true,\"boxes\":[";
    for (int item = 0; item < 3; ++item) {
      auto child = YGNodeGetChild(root, item);
      if (item) std::cout << ',';
      std::cout << "{\"x\":" << YGNodeLayoutGetLeft(child) << ",\"y\":" << YGNodeLayoutGetTop(child)
                << ",\"width\":" << YGNodeLayoutGetWidth(child) << ",\"height\":" << YGNodeLayoutGetHeight(child) << "}";
    }
    std::cout << "],\"itemStyles\":[{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"width\":30,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"position\":\"absolute\"";
    if (leftOnly) std::cout << ",\"left\":12";
    std::cout << "},{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
    YGNodeFreeRecursive(root);
    YGConfigFree(config);
  }
}


static void absoluteDerivedSizeCases() {
  for (int variant = 0; variant < 4; ++variant) {
    const bool rtl = variant == 2 || variant == 3;
    const bool resized = variant == 1 || variant == 3;
    const float rootWidth = resized ? 244 : 204;
    const float rootHeight = resized ? 124 : 104;
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false);
    YGConfigSetPointScaleFactor(config, 0);
    YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
    YGNodeStyleSetWidth(root, rootWidth);
    YGNodeStyleSetHeight(root, rootHeight);
    YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow);
    YGNodeStyleSetFlexWrap(root, YGWrapNoWrap);
    YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
    YGNodeStyleSetGap(root, YGGutterAll, 10);
    YGNodeStyleSetPadding(root, YGEdgeLeft, 10);
    YGNodeStyleSetPadding(root, YGEdgeRight, 30);
    YGNodeStyleSetPadding(root, YGEdgeTop, 20);
    YGNodeStyleSetPadding(root, YGEdgeBottom, 20);
    YGNodeStyleSetBorder(root, YGEdgeAll, 2);
    for (int item = 0; item < 3; ++item) {
      auto child = YGNodeNewWithConfig(config);
      if (item == 1) {
        YGNodeStyleSetPositionType(child, YGPositionTypeAbsolute);
        YGNodeStyleSetPosition(child, YGEdgeLeft, 12);
        YGNodeStyleSetPosition(child, YGEdgeRight, 18);
        YGNodeStyleSetPosition(child, YGEdgeTop, 8);
        YGNodeStyleSetPosition(child, YGEdgeBottom, 10);
      } else {
        YGNodeStyleSetWidth(child, 50);
        YGNodeStyleSetHeight(child, 20);
        YGNodeStyleSetFlexGrow(child, 0);
        YGNodeStyleSetFlexShrink(child, 0);
        YGNodeStyleSetMinWidth(child, 0);
        YGNodeStyleSetMinHeight(child, 0);
      }
      YGNodeInsertChild(root, child, item);
    }
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, rtl ? YGDirectionRTL : YGDirectionLTR);
    std::cout << ",{\"name\":\"position-absolute-derived-auto-" << (rtl ? "rtl" : "ltr") << (resized ? "-resized" : "")
              << "\",\"width\":" << rootWidth << ",\"height\":" << rootHeight << ",\"gap\":10,\"flexDirection\":\"row\",\"flexWrap\":\"nowrap\",\"layoutDirection\":\"" << (rtl ? "rtl" : "ltr")
              << "\",\"containerStyle\":{\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":20},\"borderWidth\":2,\"alignItems\":\"flex-start\"},\"absoluteDerivedSizeFixture\":true,\"boxes\":[";
    for (int item = 0; item < 3; ++item) {
      auto child = YGNodeGetChild(root, item);
      if (item) std::cout << ',';
      std::cout << "{\"x\":" << YGNodeLayoutGetLeft(child) << ",\"y\":" << YGNodeLayoutGetTop(child)
                << ",\"width\":" << YGNodeLayoutGetWidth(child) << ",\"height\":" << YGNodeLayoutGetHeight(child) << "}";
    }
    std::cout << "],\"itemStyles\":[{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"width\":\"auto\",\"height\":\"auto\",\"position\":\"absolute\",\"left\":12,\"right\":18,\"top\":8,\"bottom\":10},{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
    YGNodeFreeRecursive(root);
    YGConfigFree(config);
  }
}

static void nestedContainingBlockCases() {
  // Explicit static and relative only: Pibbl omitted-position legacy behavior is
  // classified separately and intentionally has no Yoga parity record here.
  for (int variant = 0; variant < 4; ++variant) {
    const bool relative = variant >= 2;
    const bool rtl = (variant & 1) != 0;
    const float width = 204;
    const float height = 104;
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false);
    YGConfigSetPointScaleFactor(config, 0);
    YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetPositionType(root, YGPositionTypeRelative);
    YGNodeStyleSetWidth(root, width);
    YGNodeStyleSetHeight(root, height);
    YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow);
    YGNodeStyleSetFlexWrap(root, YGWrapNoWrap);
    YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
    YGNodeStyleSetGap(root, YGGutterAll, 10);
    auto inner = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(inner, 80);
    YGNodeStyleSetHeight(inner, 60);
    YGNodeStyleSetFlexGrow(inner, 0);
    YGNodeStyleSetFlexShrink(inner, 0);
    YGNodeStyleSetMinWidth(inner, 0);
    YGNodeStyleSetMinHeight(inner, 0);
    YGNodeStyleSetMargin(inner, YGEdgeLeft, 20);
    YGNodeStyleSetMargin(inner, YGEdgeTop, 10);
    YGNodeStyleSetPositionType(inner, relative ? YGPositionTypeRelative : YGPositionTypeStatic);
    auto absolute = YGNodeNewWithConfig(config);
    YGNodeStyleSetPositionType(absolute, YGPositionTypeAbsolute);
    YGNodeStyleSetWidth(absolute, 30);
    YGNodeStyleSetHeight(absolute, 20);
    YGNodeStyleSetFlexGrow(absolute, 0);
    YGNodeStyleSetFlexShrink(absolute, 0);
    YGNodeStyleSetMinWidth(absolute, 0);
    YGNodeStyleSetMinHeight(absolute, 0);
    YGNodeStyleSetPosition(absolute, YGEdgeLeft, 12);
    YGNodeStyleSetPosition(absolute, YGEdgeTop, 8);
    YGNodeInsertChild(inner, absolute, 0);
    auto b = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(b, 40);
    YGNodeStyleSetHeight(b, 20);
    YGNodeStyleSetFlexGrow(b, 0);
    YGNodeStyleSetFlexShrink(b, 0);
    YGNodeStyleSetMinWidth(b, 0);
    YGNodeStyleSetMinHeight(b, 0);
    YGNodeInsertChild(root, inner, 0);
    YGNodeInsertChild(root, b, 1);
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, rtl ? YGDirectionRTL : YGDirectionLTR);
    const char* kind = relative ? "relative" : "static";
    std::cout << ",{\"name\":\"position-containing-" << kind << '-' << (rtl ? "rtl" : "ltr")
              << "\",\"width\":" << width << ",\"height\":" << height << ",\"gap\":10,\"flexDirection\":\"row\",\"flexWrap\":\"nowrap\",\"layoutDirection\":\"" << (rtl ? "rtl" : "ltr")
              << "\",\"containerStyle\":{\"position\":\"relative\",\"alignItems\":\"flex-start\"},\"nestedContainingBlockFixture\":true";
    std::cout << ",\"boxes\":[";
    printBox(inner); std::cout << ','; printBox(b);
    std::cout << "],\"nestedBoxes\":[";
    printBox(absolute, YGNodeLayoutGetLeft(inner), YGNodeLayoutGetTop(inner));
    std::cout << "],\"nestedOwnerStyle\":{\"width\":80,\"height\":60,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"marginLeft\":20,\"marginTop\":10";
    std::cout << ",\"position\":\"" << kind << "\"";
    std::cout << "},\"nestedItemStyles\":[{\"width\":30,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"position\":\"absolute\",\"left\":12,\"top\":8}],\"itemStyles\":[{\"width\":80,\"height\":60,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"marginLeft\":20,\"marginTop\":10";
    std::cout << ",\"position\":\"" << kind << "\"";
    std::cout << "},{\"width\":40,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
    YGNodeFreeRecursive(root);
    YGConfigFree(config);
  }
}

static const char* containingDirectionName(YGFlexDirection direction) {
  switch (direction) {
    case YGFlexDirectionRow: return "row";
    case YGFlexDirectionRowReverse: return "row-reverse";
    case YGFlexDirectionColumn: return "column";
    default: return "column-reverse";
  }
}
static void nestedContainingBlockDirectionCases() {
  struct Case { YGFlexDirection direction; };
  const Case cases[] = {{YGFlexDirectionRow}, {YGFlexDirectionRowReverse}, {YGFlexDirectionColumn}, {YGFlexDirectionColumnReverse}};
  for (const auto& current : cases) for (int relativeIndex = 0; relativeIndex < 2; ++relativeIndex) for (int rtlIndex = 0; rtlIndex < 2; ++rtlIndex) {
    const bool relative = relativeIndex != 0, rtl = rtlIndex != 0;
    auto config=YGConfigNew(); YGConfigSetUseWebDefaults(config,false); YGConfigSetPointScaleFactor(config,0); YGConfigSetErrata(config,YGErrataNone);
    auto root=YGNodeNewWithConfig(config); YGNodeStyleSetPositionType(root,YGPositionTypeRelative); YGNodeStyleSetBoxSizing(root,YGBoxSizingBorderBox); YGNodeStyleSetWidth(root,204); YGNodeStyleSetHeight(root,144); YGNodeStyleSetFlexDirection(root,current.direction); YGNodeStyleSetFlexWrap(root,YGWrapNoWrap); YGNodeStyleSetAlignItems(root,YGAlignFlexStart); YGNodeStyleSetGap(root,YGGutterAll,10); YGNodeStyleSetPadding(root,YGEdgeLeft,10); YGNodeStyleSetPadding(root,YGEdgeRight,30); YGNodeStyleSetPadding(root,YGEdgeTop,20); YGNodeStyleSetPadding(root,YGEdgeBottom,20);
    auto inner=YGNodeNewWithConfig(config); YGNodeStyleSetWidth(inner,80); YGNodeStyleSetHeight(inner,60); YGNodeStyleSetFlexDirection(inner,current.direction); YGNodeStyleSetFlexWrap(inner,YGWrapNoWrap); YGNodeStyleSetAlignItems(inner,YGAlignFlexStart); YGNodeStyleSetFlexGrow(inner,0); YGNodeStyleSetFlexShrink(inner,0); YGNodeStyleSetMinWidth(inner,0); YGNodeStyleSetMinHeight(inner,0); YGNodeStyleSetMargin(inner,YGEdgeLeft,20); YGNodeStyleSetMargin(inner,YGEdgeTop,10); YGNodeStyleSetPositionType(inner,relative?YGPositionTypeRelative:YGPositionTypeStatic);
    auto absolute=YGNodeNewWithConfig(config); YGNodeStyleSetPositionType(absolute,YGPositionTypeAbsolute); YGNodeStyleSetWidth(absolute,30); YGNodeStyleSetHeight(absolute,20); YGNodeStyleSetFlexGrow(absolute,0); YGNodeStyleSetFlexShrink(absolute,0); YGNodeStyleSetMinWidth(absolute,0); YGNodeStyleSetMinHeight(absolute,0); YGNodeStyleSetPosition(absolute,YGEdgeLeft,12); YGNodeStyleSetPosition(absolute,YGEdgeTop,8); YGNodeInsertChild(inner,absolute,0);
    auto sibling=YGNodeNewWithConfig(config); YGNodeStyleSetWidth(sibling,40); YGNodeStyleSetHeight(sibling,20); YGNodeStyleSetFlexGrow(sibling,0); YGNodeStyleSetFlexShrink(sibling,0); YGNodeStyleSetMinWidth(sibling,0); YGNodeStyleSetMinHeight(sibling,0); YGNodeInsertChild(root,inner,0); YGNodeInsertChild(root,sibling,1); YGNodeCalculateLayout(root,YGUndefined,YGUndefined,rtl?YGDirectionRTL:YGDirectionLTR);
    std::cout<<",{\"name\":\"position-containing-direction-"<<containingDirectionName(current.direction)<<'-'<<(relative?"relative":"static")<<'-'<<(rtl?"rtl":"ltr")<<"\",\"width\":204,\"height\":144,\"gap\":10,\"flexDirection\":\""<<containingDirectionName(current.direction)<<"\",\"flexWrap\":\"nowrap\",\"layoutDirection\":\""<<(rtl?"rtl":"ltr")<<"\",\"containerStyle\":{\"position\":\"relative\",\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":20},\"alignItems\":\"flex-start\"},\"nestedContainingBlockDirectionFixture\":true,\"boxes\":["; printBox(inner);std::cout<<',';printBox(sibling);std::cout<<"],\"nestedBoxes\":[";printBox(absolute,YGNodeLayoutGetLeft(inner),YGNodeLayoutGetTop(inner));std::cout<<"],\"nestedOwnerStyle\":{\"width\":80,\"height\":60,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"marginLeft\":20,\"marginTop\":10,\"flexDirection\":\""<<containingDirectionName(current.direction)<<"\",\"flexWrap\":\"nowrap\",\"alignItems\":\"flex-start\",\"position\":\""<<(relative?"relative":"static")<<"\"},\"nestedItemStyles\":[{\"width\":30,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"position\":\"absolute\",\"left\":12,\"top\":8}],\"itemStyles\":[{\"width\":80,\"height\":60,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"marginLeft\":20,\"marginTop\":10,\"flexDirection\":\""<<containingDirectionName(current.direction)<<"\",\"position\":\""<<(relative?"relative":"static")<<"\"},{\"width\":40,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
    YGNodeFreeRecursive(root);YGConfigFree(config);
  }
  for (int relativeIndex=0;relativeIndex<2;++relativeIndex) {
    const bool relative=relativeIndex!=0;
    auto config=YGConfigNew();YGConfigSetUseWebDefaults(config,false);YGConfigSetPointScaleFactor(config,0);YGConfigSetErrata(config,YGErrataNone);auto root=YGNodeNewWithConfig(config);YGNodeStyleSetPositionType(root,YGPositionTypeRelative);YGNodeStyleSetBoxSizing(root,YGBoxSizingBorderBox);YGNodeStyleSetWidth(root,244);YGNodeStyleSetHeight(root,184);YGNodeStyleSetFlexDirection(root,YGFlexDirectionColumnReverse);YGNodeStyleSetFlexWrap(root,YGWrapNoWrap);YGNodeStyleSetAlignItems(root,YGAlignFlexStart);YGNodeStyleSetGap(root,YGGutterAll,10);YGNodeStyleSetPadding(root,YGEdgeLeft,10);YGNodeStyleSetPadding(root,YGEdgeRight,30);YGNodeStyleSetPadding(root,YGEdgeTop,20);YGNodeStyleSetPadding(root,YGEdgeBottom,20);auto inner=YGNodeNewWithConfig(config);YGNodeStyleSetWidth(inner,80);YGNodeStyleSetHeight(inner,60);YGNodeStyleSetFlexDirection(inner,YGFlexDirectionColumnReverse);YGNodeStyleSetFlexWrap(inner,YGWrapNoWrap);YGNodeStyleSetAlignItems(inner,YGAlignFlexStart);YGNodeStyleSetFlexGrow(inner,0);YGNodeStyleSetFlexShrink(inner,0);YGNodeStyleSetMinWidth(inner,0);YGNodeStyleSetMinHeight(inner,0);YGNodeStyleSetMargin(inner,YGEdgeLeft,20);YGNodeStyleSetMargin(inner,YGEdgeTop,10);YGNodeStyleSetPositionType(inner,relative?YGPositionTypeRelative:YGPositionTypeStatic);auto absolute=YGNodeNewWithConfig(config);YGNodeStyleSetPositionType(absolute,YGPositionTypeAbsolute);YGNodeStyleSetWidth(absolute,30);YGNodeStyleSetHeight(absolute,20);YGNodeStyleSetFlexGrow(absolute,0);YGNodeStyleSetFlexShrink(absolute,0);YGNodeStyleSetMinWidth(absolute,0);YGNodeStyleSetMinHeight(absolute,0);YGNodeStyleSetPosition(absolute,YGEdgeLeft,12);YGNodeStyleSetPosition(absolute,YGEdgeTop,8);YGNodeInsertChild(inner,absolute,0);auto sibling=YGNodeNewWithConfig(config);YGNodeStyleSetWidth(sibling,40);YGNodeStyleSetHeight(sibling,20);YGNodeStyleSetFlexGrow(sibling,0);YGNodeStyleSetFlexShrink(sibling,0);YGNodeStyleSetMinWidth(sibling,0);YGNodeStyleSetMinHeight(sibling,0);YGNodeInsertChild(root,inner,0);YGNodeInsertChild(root,sibling,1);YGNodeCalculateLayout(root,YGUndefined,YGUndefined,YGDirectionLTR);
    std::cout<<",{\"name\":\"position-containing-direction-column-reverse-"<<(relative?"relative":"static")<<"-ltr-resized\",\"width\":244,\"height\":184,\"gap\":10,\"flexDirection\":\"column-reverse\",\"flexWrap\":\"nowrap\",\"layoutDirection\":\"ltr\",\"containerStyle\":{\"position\":\"relative\",\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":20},\"alignItems\":\"flex-start\"},\"nestedContainingBlockDirectionFixture\":true,\"boxes\":[";printBox(inner);std::cout<<',';printBox(sibling);std::cout<<"],\"nestedBoxes\":[";printBox(absolute,YGNodeLayoutGetLeft(inner),YGNodeLayoutGetTop(inner));std::cout<<"],\"nestedOwnerStyle\":{\"width\":80,\"height\":60,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"marginLeft\":20,\"marginTop\":10,\"flexDirection\":\"column-reverse\",\"flexWrap\":\"nowrap\",\"alignItems\":\"flex-start\",\"position\":\""<<(relative?"relative":"static")<<"\"},\"nestedItemStyles\":[{\"width\":30,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"position\":\"absolute\",\"left\":12,\"top\":8}],\"itemStyles\":[{\"width\":80,\"height\":60,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"marginLeft\":20,\"marginTop\":10,\"flexDirection\":\"column-reverse\",\"position\":\""<<(relative?"relative":"static")<<"\"},{\"width\":40,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";YGNodeFreeRecursive(root);YGConfigFree(config);
  }
}

static void absoluteBoundsCases() {
  // Pibbl deliberately rejects min > max; retain no Yoga record for that
  // contradictory input because it is not a Pibbl parity case.
  for (int variant = 0; variant < 4; ++variant) {
    const bool fixed = variant >= 2;
    const bool rtl = (variant & 1) != 0;
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false);
    YGConfigSetPointScaleFactor(config, 0);
    YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetPositionType(root, YGPositionTypeRelative);
    YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
    YGNodeStyleSetWidth(root, 204);
    YGNodeStyleSetHeight(root, 104);
    YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow);
    YGNodeStyleSetFlexWrap(root, YGWrapNoWrap);
    YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
    YGNodeStyleSetGap(root, YGGutterAll, 10);
    YGNodeStyleSetPadding(root, YGEdgeLeft, 10);
    YGNodeStyleSetPadding(root, YGEdgeRight, 30);
    YGNodeStyleSetPadding(root, YGEdgeTop, 20);
    YGNodeStyleSetPadding(root, YGEdgeBottom, 20);
    YGNodeStyleSetBorder(root, YGEdgeAll, 2);
    for (int item = 0; item < 3; ++item) {
      auto child = YGNodeNewWithConfig(config);
      if (item == 1) {
        YGNodeStyleSetPositionType(child, YGPositionTypeAbsolute);
        YGNodeStyleSetPosition(child, YGEdgeLeft, 12);
        YGNodeStyleSetPosition(child, YGEdgeRight, 18);
        YGNodeStyleSetPosition(child, YGEdgeTop, 8);
        YGNodeStyleSetPosition(child, YGEdgeBottom, 10);
        if (fixed) {
          YGNodeStyleSetWidth(child, 30);
          YGNodeStyleSetHeight(child, 20);
          YGNodeStyleSetMinWidth(child, 60);
          YGNodeStyleSetMaxHeight(child, 10);
        } else {
          YGNodeStyleSetMaxWidth(child, 100);
          YGNodeStyleSetMinHeight(child, 90);
        }
      } else {
        YGNodeStyleSetWidth(child, 50);
        YGNodeStyleSetHeight(child, 20);
        YGNodeStyleSetFlexGrow(child, 0);
        YGNodeStyleSetFlexShrink(child, 0);
        YGNodeStyleSetMinWidth(child, 0);
        YGNodeStyleSetMinHeight(child, 0);
      }
      YGNodeInsertChild(root, child, item);
    }
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, rtl ? YGDirectionRTL : YGDirectionLTR);
    std::cout << ",{\"name\":\"position-absolute-bounds-" << (fixed ? "fixed" : "auto") << '-' << (rtl ? "rtl" : "ltr")
              << "\",\"width\":204,\"height\":104,\"gap\":10,\"flexDirection\":\"row\",\"flexWrap\":\"nowrap\",\"layoutDirection\":\"" << (rtl ? "rtl" : "ltr")
              << "\",\"containerStyle\":{\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":20},\"borderWidth\":2,\"alignItems\":\"flex-start\"},\"absoluteBoundsFixture\":true,\"boxes\":[";
    for (int item = 0; item < 3; ++item) { if (item) std::cout << ','; printBox(YGNodeGetChild(root, item)); }
    std::cout << "],\"itemStyles\":[{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"position\":\"absolute\",\"left\":12,\"right\":18,\"top\":8,\"bottom\":10";
    if (fixed) std::cout << ",\"width\":30,\"height\":20,\"minWidth\":60,\"maxHeight\":10";
    else std::cout << ",\"width\":\"auto\",\"height\":\"auto\",\"maxWidth\":100,\"minHeight\":90";
    std::cout << "},{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
    YGNodeFreeRecursive(root);
    YGConfigFree(config);
  }
}

static void absoluteAspectCases() {
  // Exactly one automatic axis derives from aspectRatio before ordinary bounds clamp.
  // A paired physical inset on that automatic axis takes precedence over the ratio.
  for (int variant = 0; variant < 6; ++variant) {
    const bool widthAxis = variant < 2 || variant == 4 || variant == 5;
    const bool rtl = variant < 4 && (variant & 1) != 0;
    const bool widthBound = variant == 4;
    const bool pairedHeightInsets = variant == 5;
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false);
    YGConfigSetPointScaleFactor(config, 0);
    YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetPositionType(root, YGPositionTypeRelative);
    YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
    YGNodeStyleSetWidth(root, 204);
    YGNodeStyleSetHeight(root, 104);
    YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow);
    YGNodeStyleSetFlexWrap(root, YGWrapNoWrap);
    YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
    YGNodeStyleSetGap(root, YGGutterAll, 10);
    YGNodeStyleSetPadding(root, YGEdgeLeft, 10);
    YGNodeStyleSetPadding(root, YGEdgeRight, 30);
    YGNodeStyleSetPadding(root, YGEdgeTop, 20);
    YGNodeStyleSetPadding(root, YGEdgeBottom, 20);
    YGNodeStyleSetBorder(root, YGEdgeAll, 2);
    for (int item = 0; item < 3; ++item) {
      auto child = YGNodeNewWithConfig(config);
      if (item == 1) {
        YGNodeStyleSetPositionType(child, YGPositionTypeAbsolute);
        YGNodeStyleSetAspectRatio(child, 2);
        if (widthAxis) {
          YGNodeStyleSetWidth(child, 80);
          YGNodeStyleSetPosition(child, YGEdgeLeft, 12);
          YGNodeStyleSetPosition(child, YGEdgeTop, 8);
          if (widthBound) YGNodeStyleSetMinWidth(child, 100);
          if (pairedHeightInsets) YGNodeStyleSetPosition(child, YGEdgeBottom, 10);
        } else {
          YGNodeStyleSetHeight(child, 30);
          YGNodeStyleSetPosition(child, YGEdgeRight, 18);
          YGNodeStyleSetPosition(child, YGEdgeBottom, 10);
        }
      } else {
        YGNodeStyleSetWidth(child, 50);
        YGNodeStyleSetHeight(child, 20);
        YGNodeStyleSetFlexGrow(child, 0);
        YGNodeStyleSetFlexShrink(child, 0);
        YGNodeStyleSetMinWidth(child, 0);
        YGNodeStyleSetMinHeight(child, 0);
      }
      YGNodeInsertChild(root, child, item);
    }
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, rtl ? YGDirectionRTL : YGDirectionLTR);
    const char* name = widthBound ? "width-bound" : pairedHeightInsets ? "height-inset-pair" : widthAxis ? "width-auto-height" : "height-auto-width";
    std::cout << ",{\"name\":\"position-absolute-aspect-" << name << '-' << (rtl ? "rtl" : "ltr")
              << "\",\"width\":204,\"height\":104,\"gap\":10,\"flexDirection\":\"row\",\"flexWrap\":\"nowrap\",\"layoutDirection\":\"" << (rtl ? "rtl" : "ltr")
              << "\",\"containerStyle\":{\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":20},\"borderWidth\":2,\"alignItems\":\"flex-start\"},\"absoluteAspectFixture\":true,\"boxes\":[";
    for (int item = 0; item < 3; ++item) { if (item) std::cout << ','; printBox(YGNodeGetChild(root, item)); }
    std::cout << "],\"itemStyles\":[{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"position\":\"absolute\",\"aspectRatio\":2";
    if (widthAxis) {
      std::cout << ",\"width\":80,\"height\":\"auto\",\"left\":12,\"top\":8";
      if (widthBound) std::cout << ",\"minWidth\":100";
      if (pairedHeightInsets) std::cout << ",\"bottom\":10";
    } else std::cout << ",\"width\":\"auto\",\"height\":30,\"right\":18,\"bottom\":10";
    std::cout << "},{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
    YGNodeFreeRecursive(root);
    YGConfigFree(config);
  }
}

static YGSize absoluteMeasuredWidth(YGNodeConstRef, float, YGMeasureMode, float, YGMeasureMode) {
  // Deterministic custom-provider oracle, not a font measurement claim: 3 jobs × 20px.
  return {60, 20};
}
static void absoluteMeasuredWidthCases() {
  for (int variant = 0; variant < 6; ++variant) {
    const bool right = variant == 2 || variant == 3 || variant >= 4;
    const bool resized = variant == 1 || variant == 3;
    const bool maximum = variant == 4;
    const bool minimum = variant == 5;
    const float rootWidth = resized ? 244 : 204;
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false);
    YGConfigSetPointScaleFactor(config, 0);
    YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetPositionType(root, YGPositionTypeRelative);
    YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
    YGNodeStyleSetWidth(root, rootWidth);
    YGNodeStyleSetHeight(root, 104);
    YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow);
    YGNodeStyleSetFlexWrap(root, YGWrapNoWrap);
    YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
    YGNodeStyleSetGap(root, YGGutterAll, 10);
    YGNodeStyleSetPadding(root, YGEdgeLeft, 10);
    YGNodeStyleSetPadding(root, YGEdgeRight, 30);
    YGNodeStyleSetPadding(root, YGEdgeTop, 20);
    YGNodeStyleSetPadding(root, YGEdgeBottom, 20);
    YGNodeStyleSetBorder(root, YGEdgeAll, 2);
    for (int item = 0; item < 3; ++item) {
      auto child = YGNodeNewWithConfig(config);
      if (item == 1) {
        YGNodeStyleSetPositionType(child, YGPositionTypeAbsolute);
        YGNodeStyleSetHeight(child, 20);
        YGNodeStyleSetMinWidth(child, 0);
        YGNodeStyleSetMinHeight(child, 0);
        YGNodeStyleSetFlexGrow(child, 0);
        YGNodeStyleSetFlexShrink(child, 0);
        YGNodeStyleSetPosition(child, right ? YGEdgeRight : YGEdgeLeft, right ? 18 : 12);
        YGNodeStyleSetPosition(child, YGEdgeTop, 8);
        if (maximum) YGNodeStyleSetMaxWidth(child, 50);
        if (minimum) YGNodeStyleSetMinWidth(child, 80);
        YGNodeSetMeasureFunc(child, absoluteMeasuredWidth);
      } else {
        YGNodeStyleSetWidth(child, 50);
        YGNodeStyleSetHeight(child, 20);
        YGNodeStyleSetFlexGrow(child, 0);
        YGNodeStyleSetFlexShrink(child, 0);
        YGNodeStyleSetMinWidth(child, 0);
        YGNodeStyleSetMinHeight(child, 0);
      }
      YGNodeInsertChild(root, child, item);
    }
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionLTR);
    const char* mode = maximum ? "right-max50" : minimum ? "right-min80" : right ? "right" : "left";
    std::cout << ",{\"name\":\"position-absolute-measured-" << mode << (resized ? "-resized" : "")
              << "\",\"width\":" << rootWidth << ",\"height\":104,\"gap\":10,\"flexDirection\":\"row\",\"flexWrap\":\"nowrap\",\"containerStyle\":{\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":20},\"borderWidth\":2,\"alignItems\":\"flex-start\"},\"absoluteMeasuredWidthFixture\":true,\"measurementModel\":\"deterministic provider: 3 jobs x 20px; native callback width unbounded and height exact 20\",\"boxes\":[";
    for (int item = 0; item < 3; ++item) { if (item) std::cout << ','; printBox(YGNodeGetChild(root, item)); }
    std::cout << "],\"itemStyles\":[{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"position\":\"absolute\",\"width\":\"auto\",\"height\":20,\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0,\"top\":8,";
    if (right) std::cout << "\"right\":18"; else std::cout << "\"left\":12";
    if (maximum) std::cout << ",\"maxWidth\":50";
    if (minimum) std::cout << ",\"minWidth\":80";
    std::cout << "},{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
    YGNodeFreeRecursive(root);
    YGConfigFree(config);
  }
}


static YGSize absoluteMeasuredHeight(YGNodeConstRef, float width, YGMeasureMode, float, YGMeasureMode) {
  // Deterministic custom-provider oracle: 8 jobs, 20px columns, 10px rows.
  const float columns = std::max(1.0f, std::floor(width / 20.0f));
  return {width, std::ceil(8.0f / columns) * 10.0f};
}
static void absoluteMeasuredHeightCases() {
  for (int variant = 0; variant < 6; ++variant) {
    const bool bottom = variant == 1 || variant == 3 || variant == 5;
    const bool resized = variant == 2 || variant == 3 || variant == 5;
    const bool minimum = variant == 4;
    const bool maximum = variant == 5;
    const float rootHeight = resized ? 124 : 104;
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false);
    YGConfigSetPointScaleFactor(config, 0);
    YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetPositionType(root, YGPositionTypeRelative);
    YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
    YGNodeStyleSetWidth(root, 204);
    YGNodeStyleSetHeight(root, rootHeight);
    YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow);
    YGNodeStyleSetFlexWrap(root, YGWrapNoWrap);
    YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
    YGNodeStyleSetGap(root, YGGutterAll, 10);
    YGNodeStyleSetPadding(root, YGEdgeLeft, 10);
    YGNodeStyleSetPadding(root, YGEdgeRight, 30);
    YGNodeStyleSetPadding(root, YGEdgeTop, 20);
    YGNodeStyleSetPadding(root, YGEdgeBottom, 20);
    YGNodeStyleSetBorder(root, YGEdgeAll, 2);
    for (int item = 0; item < 3; ++item) {
      auto child = YGNodeNewWithConfig(config);
      if (item == 1) {
        YGNodeStyleSetPositionType(child, YGPositionTypeAbsolute);
        YGNodeStyleSetWidth(child, 80);
        YGNodeStyleSetMinWidth(child, 0);
        YGNodeStyleSetMinHeight(child, minimum ? 30 : 0);
        YGNodeStyleSetFlexGrow(child, 0);
        YGNodeStyleSetFlexShrink(child, 0);
        YGNodeStyleSetPosition(child, YGEdgeLeft, 12);
        YGNodeStyleSetPosition(child, bottom ? YGEdgeBottom : YGEdgeTop, bottom ? 10 : 8);
        if (maximum) YGNodeStyleSetMaxHeight(child, 10);
        YGNodeSetMeasureFunc(child, absoluteMeasuredHeight);
      } else {
        YGNodeStyleSetWidth(child, 50);
        YGNodeStyleSetHeight(child, 20);
        YGNodeStyleSetFlexGrow(child, 0);
        YGNodeStyleSetFlexShrink(child, 0);
        YGNodeStyleSetMinWidth(child, 0);
        YGNodeStyleSetMinHeight(child, 0);
      }
      YGNodeInsertChild(root, child, item);
    }
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionLTR);
    const char* mode = maximum ? "bottom-max10" : minimum ? "top-min30" : bottom ? "bottom" : "top";
    std::cout << ",{\"name\":\"position-absolute-measured-height-" << mode << (resized && !maximum ? "-resized" : "")
              << "\",\"width\":204,\"height\":" << rootHeight << ",\"gap\":10,\"flexDirection\":\"row\",\"flexWrap\":\"nowrap\",\"containerStyle\":{\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":20},\"borderWidth\":2,\"alignItems\":\"flex-start\"},\"absoluteMeasuredHeightFixture\":true,\"measurementModel\":\"deterministic provider: 8 jobs x 20px; native callback width exact and height unbounded\",\"boxes\":[";
    for (int item = 0; item < 3; ++item) { if (item) std::cout << ','; printBox(YGNodeGetChild(root, item)); }
    std::cout << "],\"itemStyles\":[{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"position\":\"absolute\",\"width\":80,\"height\":\"auto\",\"minWidth\":0,\"minHeight\":" << (minimum ? 30 : 0) << ",\"flexGrow\":0,\"flexShrink\":0,\"left\":12,";
    if (bottom) std::cout << "\"bottom\":10"; else std::cout << "\"top\":8";
    if (maximum) std::cout << ",\"maxHeight\":10";
    std::cout << "},{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
    YGNodeFreeRecursive(root);
    YGConfigFree(config);
  }
}

static float absoluteMeasuredMainQueryWidth;
static YGMeasureMode absoluteMeasuredMainQueryWidthMode;
static YGSize absoluteMeasuredMain(YGNodeConstRef, float width, YGMeasureMode widthMode, float height, YGMeasureMode) {
  absoluteMeasuredMainQueryWidth = width;
  absoluteMeasuredMainQueryWidthMode = widthMode;
  // Deterministic provider oracle: 3 jobs × 20px. The selected automatic axis stays natural.
  if (std::isfinite(height)) return {60, height};
  const float columns = std::max(1.0f, std::floor(width / 20.0f));
  return {width, std::ceil(8.0f / columns) * 10.0f};
}
static void absoluteMeasuredMainCases() {
  struct Case { YGFlexDirection direction; bool rtl; const char* name; };
  const Case directions[] = {
    {YGFlexDirectionRow, false, "row-ltr"}, {YGFlexDirectionRow, true, "row-rtl"},
    {YGFlexDirectionRowReverse, false, "row-reverse-ltr"}, {YGFlexDirectionRowReverse, true, "row-reverse-rtl"},
    {YGFlexDirectionColumn, false, "column-ltr"}, {YGFlexDirectionColumn, true, "column-rtl"},
    {YGFlexDirectionColumnReverse, false, "column-reverse-ltr"}, {YGFlexDirectionColumnReverse, true, "column-reverse-rtl"},
  };
  for (int profile = 0; profile < 2; ++profile) for (const auto& direction : directions) {
    const bool naturalWidth = profile == 0;
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetPositionType(root, YGPositionTypeRelative); YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
    YGNodeStyleSetWidth(root, 204); YGNodeStyleSetHeight(root, 104); YGNodeStyleSetFlexDirection(root, direction.direction); YGNodeStyleSetFlexWrap(root, YGWrapNoWrap);
    YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetGap(root, YGGutterAll, 10);
    YGNodeStyleSetPadding(root, YGEdgeLeft, 10); YGNodeStyleSetPadding(root, YGEdgeRight, 30); YGNodeStyleSetPadding(root, YGEdgeTop, 20); YGNodeStyleSetPadding(root, YGEdgeBottom, 20); YGNodeStyleSetBorder(root, YGEdgeAll, 2);
    for (int item = 0; item < 3; ++item) {
      auto child = YGNodeNewWithConfig(config);
      if (item == 1) {
        YGNodeStyleSetPositionType(child, YGPositionTypeAbsolute); YGNodeStyleSetFlexGrow(child, 0); YGNodeStyleSetFlexShrink(child, 0); YGNodeStyleSetMinWidth(child, 0); YGNodeStyleSetMinHeight(child, 0);
        if (naturalWidth) { YGNodeStyleSetHeight(child, 20); YGNodeStyleSetPosition(child, YGEdgeRight, 18); YGNodeStyleSetPosition(child, YGEdgeTop, 8); }
        else { YGNodeStyleSetWidth(child, 80); YGNodeStyleSetPosition(child, YGEdgeLeft, 12); YGNodeStyleSetPosition(child, YGEdgeBottom, 10); }
        YGNodeSetMeasureFunc(child, absoluteMeasuredMain);
      } else { YGNodeStyleSetWidth(child, 50); YGNodeStyleSetHeight(child, 20); YGNodeStyleSetFlexGrow(child, 0); YGNodeStyleSetFlexShrink(child, 0); YGNodeStyleSetMinWidth(child, 0); YGNodeStyleSetMinHeight(child, 0); }
      YGNodeInsertChild(root, child, item);
    }
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, direction.rtl ? YGDirectionRTL : YGDirectionLTR);
    std::cout << ",{\"name\":\"position-absolute-measured-main-" << (naturalWidth ? "width" : "height") << '-' << direction.name
              << "\",\"width\":204,\"height\":104,\"gap\":10,\"flexDirection\":\"" << (direction.direction == YGFlexDirectionRow ? "row" : direction.direction == YGFlexDirectionRowReverse ? "row-reverse" : direction.direction == YGFlexDirectionColumn ? "column" : "column-reverse") << "\",\"flexWrap\":\"nowrap\",\"layoutDirection\":\"" << (direction.rtl ? "rtl" : "ltr")
              << "\",\"containerStyle\":{\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":20},\"borderWidth\":2,\"alignItems\":\"flex-start\"},\"absoluteMeasuredMainFixture\":true,\"measurementModel\":\"deterministic provider: " << (naturalWidth ? "3 jobs x 20px; Pibbl width unbounded / height exact 20" : "8 jobs x 20px; width exact 80 / height unbounded") << "\"";
    if (naturalWidth && absoluteMeasuredMainQueryWidthMode == YGMeasureModeAtMost)
      std::cout << ",\"measurementQueryDifference\":true,\"nativeMeasurementConstraints\":{\"minWidth\":0,\"maxWidth\":" << absoluteMeasuredMainQueryWidth << ",\"minHeight\":20,\"maxHeight\":20}";
    std::cout << ",\"boxes\":[";
    for (int item = 0; item < 3; ++item) { if (item) std::cout << ','; printBox(YGNodeGetChild(root, item)); }
    std::cout << "],\"itemStyles\":[{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"position\":\"absolute\",\"width\":" << (naturalWidth ? "\"auto\"" : "80") << ",\"height\":" << (naturalWidth ? "20" : "\"auto\"") << ",\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0," << (naturalWidth ? "\"right\":18,\"top\":8" : "\"left\":12,\"bottom\":10") << "},{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
    YGNodeFreeRecursive(root); YGConfigFree(config);
  }
  for (int resize = 0; resize < 2; ++resize) {
    const bool naturalWidth = resize == 0;
    auto config = YGConfigNew(); YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config); YGNodeStyleSetPositionType(root, YGPositionTypeRelative); YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
    YGNodeStyleSetWidth(root, naturalWidth ? 244 : 204); YGNodeStyleSetHeight(root, naturalWidth ? 104 : 124); YGNodeStyleSetFlexDirection(root, YGFlexDirectionColumnReverse); YGNodeStyleSetFlexWrap(root, YGWrapNoWrap); YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetGap(root, YGGutterAll, 10);
    YGNodeStyleSetPadding(root, YGEdgeLeft, 10); YGNodeStyleSetPadding(root, YGEdgeRight, 30); YGNodeStyleSetPadding(root, YGEdgeTop, 20); YGNodeStyleSetPadding(root, YGEdgeBottom, 20); YGNodeStyleSetBorder(root, YGEdgeAll, 2);
    for (int item = 0; item < 3; ++item) { auto child = YGNodeNewWithConfig(config); if (item == 1) { YGNodeStyleSetPositionType(child, YGPositionTypeAbsolute); YGNodeStyleSetFlexGrow(child,0); YGNodeStyleSetFlexShrink(child,0); YGNodeStyleSetMinWidth(child,0); YGNodeStyleSetMinHeight(child,0); if (naturalWidth) { YGNodeStyleSetHeight(child,20); YGNodeStyleSetPosition(child,YGEdgeRight,18); YGNodeStyleSetPosition(child,YGEdgeTop,8); } else { YGNodeStyleSetWidth(child,80); YGNodeStyleSetPosition(child,YGEdgeLeft,12); YGNodeStyleSetPosition(child,YGEdgeBottom,10); } YGNodeSetMeasureFunc(child,absoluteMeasuredMain); } else { YGNodeStyleSetWidth(child,50); YGNodeStyleSetHeight(child,20); YGNodeStyleSetFlexGrow(child,0); YGNodeStyleSetFlexShrink(child,0); YGNodeStyleSetMinWidth(child,0); YGNodeStyleSetMinHeight(child,0); } YGNodeInsertChild(root,child,item); }
    YGNodeCalculateLayout(root,YGUndefined,YGUndefined,YGDirectionRTL);
    std::cout << ",{\"name\":\"position-absolute-measured-main-" << (naturalWidth ? "width-column-reverse-rtl-resized" : "height-column-reverse-rtl-resized") << "\",\"width\":" << (naturalWidth ? 244 : 204) << ",\"height\":" << (naturalWidth ? 104 : 124) << ",\"gap\":10,\"flexDirection\":\"column-reverse\",\"flexWrap\":\"nowrap\",\"layoutDirection\":\"rtl\",\"containerStyle\":{\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":20},\"borderWidth\":2,\"alignItems\":\"flex-start\"},\"absoluteMeasuredMainFixture\":true,\"measurementModel\":\"deterministic provider resize\"";
    if (naturalWidth && absoluteMeasuredMainQueryWidthMode == YGMeasureModeAtMost)
      std::cout << ",\"measurementQueryDifference\":true,\"nativeMeasurementConstraints\":{\"minWidth\":0,\"maxWidth\":" << absoluteMeasuredMainQueryWidth << ",\"minHeight\":20,\"maxHeight\":20}";
    std::cout << ",\"boxes\":[";
    for(int item=0;item<3;++item){if(item)std::cout<<',';printBox(YGNodeGetChild(root,item));}
    std::cout << "],\"itemStyles\":[{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"position\":\"absolute\",\"width\":" << (naturalWidth ? "\"auto\"" : "80") << ",\"height\":" << (naturalWidth ? "20" : "\"auto\"") << ",\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0," << (naturalWidth ? "\"right\":18,\"top\":8" : "\"left\":12,\"bottom\":10") << "},{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
    YGNodeFreeRecursive(root); YGConfigFree(config);
  }
}

static void absoluteMainDirectionCases() {
  struct Case { YGFlexDirection direction; bool rtl; bool centered; bool insets; const char* name; };
  const Case cases[] = {
    {YGFlexDirectionColumn, false, false, false, "column-ltr"},
    {YGFlexDirectionColumn, true, false, false, "column-rtl"},
    {YGFlexDirectionColumnReverse, false, false, false, "column-reverse-ltr"},
    {YGFlexDirectionColumnReverse, true, false, false, "column-reverse-rtl"},
    {YGFlexDirectionColumn, false, true, false, "column-center-end-ltr"},
    {YGFlexDirectionColumn, true, true, false, "column-center-end-rtl"},
    {YGFlexDirectionColumnReverse, false, false, true, "column-reverse-insets-ltr"},
    {YGFlexDirectionColumnReverse, true, false, true, "column-reverse-insets-rtl"},
    {YGFlexDirectionRowReverse, false, false, false, "row-reverse-ltr"},
    {YGFlexDirectionRowReverse, true, false, false, "row-reverse-rtl"},
  };
  for (const auto& current : cases) {
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false);
    YGConfigSetPointScaleFactor(config, 0);
    YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetPositionType(root, YGPositionTypeRelative);
    YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
    YGNodeStyleSetWidth(root, 204);
    YGNodeStyleSetHeight(root, 244);
    YGNodeStyleSetFlexDirection(root, current.direction);
    YGNodeStyleSetFlexWrap(root, YGWrapNoWrap);
    YGNodeStyleSetJustifyContent(root, current.centered ? YGJustifyCenter : YGJustifyFlexStart);
    YGNodeStyleSetAlignItems(root, current.centered ? YGAlignFlexEnd : YGAlignStretch);
    YGNodeStyleSetGap(root, YGGutterAll, 10);
    YGNodeStyleSetPadding(root, YGEdgeLeft, 10);
    YGNodeStyleSetPadding(root, YGEdgeRight, 30);
    YGNodeStyleSetPadding(root, YGEdgeTop, 20);
    YGNodeStyleSetPadding(root, YGEdgeBottom, 20);
    YGNodeStyleSetBorder(root, YGEdgeAll, 2);
    for (int item = 0; item < 3; ++item) {
      auto child = YGNodeNewWithConfig(config);
      YGNodeStyleSetWidth(child, item == 1 ? 30 : 50);
      YGNodeStyleSetHeight(child, 20);
      if (item != 1) {
        YGNodeStyleSetMinWidth(child, 0);
        YGNodeStyleSetMinHeight(child, 0);
      }
      YGNodeStyleSetFlexGrow(child, 0);
      YGNodeStyleSetFlexShrink(child, 0);
      if (item == 1) {
        YGNodeStyleSetPositionType(child, YGPositionTypeAbsolute);
        if (current.insets) {
          YGNodeStyleSetPosition(child, YGEdgeLeft, 12);
          YGNodeStyleSetPosition(child, YGEdgeTop, 8);
        }
      }
      YGNodeInsertChild(root, child, item);
    }
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, current.rtl ? YGDirectionRTL : YGDirectionLTR);
    std::cout << ",{\"name\":\"position-absolute-main-" << current.name
              << "\",\"width\":204,\"height\":244,\"gap\":10,\"flexDirection\":\"" << (current.direction == YGFlexDirectionColumnReverse ? "column-reverse" : current.direction == YGFlexDirectionRowReverse ? "row-reverse" : "column")
              << "\",\"flexWrap\":\"nowrap\",\"layoutDirection\":\"" << (current.rtl ? "rtl" : "ltr")
              << "\",\"containerStyle\":{\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":20},\"borderWidth\":2,\"justifyContent\":\"" << (current.centered ? "center" : "flex-start") << "\",\"alignItems\":\"" << (current.centered ? "flex-end" : "stretch") << "\"},\"absoluteMainDirectionFixture\":true,\"boxes\":[";
    for (int item = 0; item < 3; ++item) { if (item) std::cout << ','; printBox(YGNodeGetChild(root, item)); }
    std::cout << "],\"itemStyles\":[{\"width\":50,\"height\":20,\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0},{\"position\":\"absolute\",\"width\":30,\"height\":20,\"flexGrow\":0,\"flexShrink\":0";
    if (current.insets) std::cout << ",\"left\":12,\"top\":8";
    std::cout << "},{\"width\":50,\"height\":20,\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0}]}";
    YGNodeFreeRecursive(root);
    YGConfigFree(config);
  }
}


static void relativeMainDirectionCases() {
  struct Case { YGFlexDirection direction; bool rtl; bool relative; const char* name; };
  const Case cases[] = {
    {YGFlexDirectionRow, false, false, "row-static-ltr"},
    {YGFlexDirectionRow, true, false, "row-static-rtl"},
    {YGFlexDirectionRow, false, true, "row-relative-ltr"},
    {YGFlexDirectionRow, true, true, "row-relative-rtl"},
    {YGFlexDirectionRowReverse, false, false, "row-reverse-static-ltr"},
    {YGFlexDirectionRowReverse, true, false, "row-reverse-static-rtl"},
    {YGFlexDirectionRowReverse, false, true, "row-reverse-relative-ltr"},
    {YGFlexDirectionRowReverse, true, true, "row-reverse-relative-rtl"},
    {YGFlexDirectionColumn, false, false, "column-static-ltr"},
    {YGFlexDirectionColumn, true, false, "column-static-rtl"},
    {YGFlexDirectionColumn, false, true, "column-relative-ltr"},
    {YGFlexDirectionColumn, true, true, "column-relative-rtl"},
    {YGFlexDirectionColumnReverse, false, false, "column-reverse-static-ltr"},
    {YGFlexDirectionColumnReverse, true, false, "column-reverse-static-rtl"},
    {YGFlexDirectionColumnReverse, false, true, "column-reverse-relative-ltr"},
    {YGFlexDirectionColumnReverse, true, true, "column-reverse-relative-rtl"},
  };
  for (const auto& current : cases) {
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false);
    YGConfigSetPointScaleFactor(config, 0);
    YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
    YGNodeStyleSetWidth(root, 204);
    YGNodeStyleSetHeight(root, 244);
    YGNodeStyleSetFlexDirection(root, current.direction);
    YGNodeStyleSetFlexWrap(root, YGWrapNoWrap);
    YGNodeStyleSetGap(root, YGGutterAll, 10);
    YGNodeStyleSetPadding(root, YGEdgeLeft, 10);
    YGNodeStyleSetPadding(root, YGEdgeRight, 30);
    YGNodeStyleSetPadding(root, YGEdgeTop, 20);
    YGNodeStyleSetPadding(root, YGEdgeBottom, 20);
    YGNodeStyleSetBorder(root, YGEdgeAll, 2);
    for (int item = 0; item < 2; ++item) {
      auto child = YGNodeNewWithConfig(config);
      YGNodeStyleSetWidth(child, 50);
      YGNodeStyleSetHeight(child, 20);
      YGNodeStyleSetFlexGrow(child, 0);
      YGNodeStyleSetFlexShrink(child, 0);
      YGNodeStyleSetMinWidth(child, 0);
      YGNodeStyleSetMinHeight(child, 0);
      if (item == 0) {
        YGNodeStyleSetPositionType(child, current.relative ? YGPositionTypeRelative : YGPositionTypeStatic);
        YGNodeStyleSetPosition(child, YGEdgeLeft, 12);
        YGNodeStyleSetPosition(child, YGEdgeRight, 18);
        YGNodeStyleSetPosition(child, YGEdgeTop, 8);
        YGNodeStyleSetPosition(child, YGEdgeBottom, 10);
      }
      YGNodeInsertChild(root, child, item);
    }
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, current.rtl ? YGDirectionRTL : YGDirectionLTR);
    const bool reverse = current.direction == YGFlexDirectionRowReverse || current.direction == YGFlexDirectionColumnReverse;
    const auto a = YGNodeGetChild(root, 0);
    const auto b = YGNodeGetChild(root, 1);
    std::cout << ",{\"name\":\"position-relative-main-" << current.name
              << "\",\"width\":204,\"height\":244,\"gap\":10,\"flexDirection\":\""
              << (current.direction == YGFlexDirectionRow ? "row" : current.direction == YGFlexDirectionRowReverse ? "row-reverse" : current.direction == YGFlexDirectionColumn ? "column" : "column-reverse")
              << "\",\"flexWrap\":\"nowrap\",\"layoutDirection\":\"" << (current.rtl ? "rtl" : "ltr")
              << "\",\"containerStyle\":{\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":20},\"borderWidth\":2,\"alignItems\":\"flex-start\"},\"relativeMainDirectionFixture\":true,\"boxes\":[";
    printBox(a); std::cout << ','; printBox(b); std::cout << ']';
    if (reverse && current.relative) {
      const bool rowReverse = current.direction == YGFlexDirectionRowReverse;
      const float baseX = rowReverse ? (current.rtl ? 12 : 122) : (current.rtl ? 122 : 12);
      const float baseY = rowReverse ? 22 : 202;
      const float physicalX = baseX + (current.rtl ? -18 : 12);
      const float physicalY = baseY + 8;
      std::cout << ",\"classification\":\"preserved-physical-relative-offset\",\"comparisonLabel\":\"Pibbl preserves physical final-world relative offsets under main-axis reversal; Yoga differs (not parity).\",\"pibblBoxes\":[{\"x\":" << physicalX << ",\"y\":" << physicalY << ",\"width\":50,\"height\":20},";
      printBox(b);
      std::cout << ']';
    }
    std::cout << ",\"itemStyles\":[{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"position\":\"" << (current.relative ? "relative" : "static") << "\",\"left\":12,\"right\":18,\"top\":8,\"bottom\":10},{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
    YGNodeFreeRecursive(root);
    YGConfigFree(config);
  }
}

static void absoluteMainBoundsCases() {
  struct Case { YGFlexDirection direction; bool rtl; bool automatic; bool resized; const char* name; };
  const Case cases[] = {
    {YGFlexDirectionRow, false, true, false, "row-ltr-initial"}, {YGFlexDirectionRow, false, true, true, "row-ltr-resized"},
    {YGFlexDirectionRow, true, true, false, "row-rtl-initial"}, {YGFlexDirectionRow, true, true, true, "row-rtl-resized"},
    {YGFlexDirectionRowReverse, false, true, false, "row-reverse-ltr-initial"}, {YGFlexDirectionRowReverse, false, true, true, "row-reverse-ltr-resized"},
    {YGFlexDirectionRowReverse, true, true, false, "row-reverse-rtl-initial"}, {YGFlexDirectionRowReverse, true, true, true, "row-reverse-rtl-resized"},
    {YGFlexDirectionColumn, false, true, false, "column-ltr-initial"}, {YGFlexDirectionColumn, false, true, true, "column-ltr-resized"},
    {YGFlexDirectionColumn, true, true, false, "column-rtl-initial"}, {YGFlexDirectionColumn, true, true, true, "column-rtl-resized"},
    {YGFlexDirectionColumnReverse, false, true, false, "column-reverse-ltr-initial"}, {YGFlexDirectionColumnReverse, false, true, true, "column-reverse-ltr-resized"},
    {YGFlexDirectionColumnReverse, true, true, false, "column-reverse-rtl-initial"}, {YGFlexDirectionColumnReverse, true, true, true, "column-reverse-rtl-resized"},
    {YGFlexDirectionRow, false, false, false, "row-ltr-fixed"}, {YGFlexDirectionRow, true, false, false, "row-rtl-fixed"},
    {YGFlexDirectionRowReverse, false, false, false, "row-reverse-ltr-fixed"}, {YGFlexDirectionRowReverse, true, false, false, "row-reverse-rtl-fixed"},
    {YGFlexDirectionColumn, false, false, false, "column-ltr-fixed"}, {YGFlexDirectionColumn, true, false, false, "column-rtl-fixed"},
    {YGFlexDirectionColumnReverse, false, false, false, "column-reverse-ltr-fixed"}, {YGFlexDirectionColumnReverse, true, false, false, "column-reverse-rtl-fixed"},
  };
  for (const auto& current : cases) {
    const float rootWidth = current.resized ? 244 : 204;
    const float rootHeight = current.resized ? 144 : 104;
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false);
    YGConfigSetPointScaleFactor(config, 0);
    YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetPositionType(root, YGPositionTypeRelative);
    YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
    YGNodeStyleSetWidth(root, rootWidth);
    YGNodeStyleSetHeight(root, rootHeight);
    YGNodeStyleSetFlexDirection(root, current.direction);
    YGNodeStyleSetFlexWrap(root, YGWrapNoWrap);
    YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
    YGNodeStyleSetGap(root, YGGutterAll, 10);
    YGNodeStyleSetPadding(root, YGEdgeLeft, 10);
    YGNodeStyleSetPadding(root, YGEdgeRight, 30);
    YGNodeStyleSetPadding(root, YGEdgeTop, 20);
    YGNodeStyleSetPadding(root, YGEdgeBottom, 20);
    YGNodeStyleSetBorder(root, YGEdgeAll, 2);
    for (int item = 0; item < 3; ++item) {
      auto child = YGNodeNewWithConfig(config);
      if (item == 1) {
        YGNodeStyleSetPositionType(child, YGPositionTypeAbsolute);
        YGNodeStyleSetPosition(child, YGEdgeLeft, 12);
        YGNodeStyleSetPosition(child, YGEdgeRight, 18);
        YGNodeStyleSetPosition(child, YGEdgeTop, 8);
        YGNodeStyleSetPosition(child, YGEdgeBottom, 10);
        if (current.automatic) {
          YGNodeStyleSetWidthAuto(child);
          YGNodeStyleSetHeightAuto(child);
          YGNodeStyleSetMinWidth(child, 180);
          YGNodeStyleSetMinHeight(child, 90);
        } else {
          YGNodeStyleSetWidth(child, 30);
          YGNodeStyleSetHeight(child, 20);
          YGNodeStyleSetMinWidth(child, 60);
          YGNodeStyleSetMaxHeight(child, 10);
        }
      } else {
        YGNodeStyleSetWidth(child, 50);
        YGNodeStyleSetHeight(child, 20);
        YGNodeStyleSetFlexGrow(child, 0);
        YGNodeStyleSetFlexShrink(child, 0);
        YGNodeStyleSetMinWidth(child, 0);
        YGNodeStyleSetMinHeight(child, 0);
      }
      YGNodeInsertChild(root, child, item);
    }
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, current.rtl ? YGDirectionRTL : YGDirectionLTR);
    std::cout << ",{\"name\":\"position-absolute-main-bounds-" << (current.automatic ? "auto-" : "fixed-") << current.name
              << "\",\"width\":" << rootWidth << ",\"height\":" << rootHeight << ",\"gap\":10,\"flexDirection\":\""
              << (current.direction == YGFlexDirectionRow ? "row" : current.direction == YGFlexDirectionRowReverse ? "row-reverse" : current.direction == YGFlexDirectionColumn ? "column" : "column-reverse")
              << "\",\"flexWrap\":\"nowrap\",\"layoutDirection\":\"" << (current.rtl ? "rtl" : "ltr")
              << "\",\"containerStyle\":{\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":20},\"borderWidth\":2,\"alignItems\":\"flex-start\"},\"absoluteMainBoundsFixture\":true,\"boxes\":[";
    for (int item = 0; item < 3; ++item) { if (item) std::cout << ','; printBox(YGNodeGetChild(root, item)); }
    std::cout << "],\"itemStyles\":[{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"position\":\"absolute\",\"left\":12,\"right\":18,\"top\":8,\"bottom\":10";
    if (current.automatic) std::cout << ",\"width\":\"auto\",\"height\":\"auto\",\"minWidth\":180,\"minHeight\":90";
    else std::cout << ",\"width\":30,\"height\":20,\"minWidth\":60,\"maxHeight\":10";
    std::cout << "},{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
    YGNodeFreeRecursive(root);
    YGConfigFree(config);
  }
}

static void absoluteMainAspectCases() {
  const YGFlexDirection directions[] = {YGFlexDirectionRow, YGFlexDirectionRowReverse, YGFlexDirectionColumn, YGFlexDirectionColumnReverse};
  const char* directionNames[] = {"row", "row-reverse", "column", "column-reverse"};
  const char* variants[] = {"width-bound", "height-bound", "height-pair"};
  for (int directionIndex = 0; directionIndex < 4; ++directionIndex) {
    for (int rtlIndex = 0; rtlIndex < 2; ++rtlIndex) {
      for (int variant = 0; variant < 2; ++variant) {
        const bool rtl = rtlIndex != 0;
        auto config = YGConfigNew();
        YGConfigSetUseWebDefaults(config, false);
        YGConfigSetPointScaleFactor(config, 0);
        YGConfigSetErrata(config, YGErrataNone);
        auto root = YGNodeNewWithConfig(config);
        YGNodeStyleSetPositionType(root, YGPositionTypeRelative);
        YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
        YGNodeStyleSetWidth(root, 204);
        YGNodeStyleSetHeight(root, 104);
        YGNodeStyleSetFlexDirection(root, directions[directionIndex]);
        YGNodeStyleSetFlexWrap(root, YGWrapNoWrap);
        YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
        YGNodeStyleSetGap(root, YGGutterAll, 10);
        YGNodeStyleSetPadding(root, YGEdgeLeft, 10);
        YGNodeStyleSetPadding(root, YGEdgeRight, 30);
        YGNodeStyleSetPadding(root, YGEdgeTop, 20);
        YGNodeStyleSetPadding(root, YGEdgeBottom, 20);
        YGNodeStyleSetBorder(root, YGEdgeAll, 2);
        for (int item = 0; item < 3; ++item) {
          auto child = YGNodeNewWithConfig(config);
          if (item == 1) {
            YGNodeStyleSetPositionType(child, YGPositionTypeAbsolute);
            YGNodeStyleSetAspectRatio(child, 2);
            if (variant == 0) {
              YGNodeStyleSetWidth(child, 80); YGNodeStyleSetHeightAuto(child); YGNodeStyleSetPosition(child, YGEdgeLeft, 12); YGNodeStyleSetPosition(child, YGEdgeTop, 8); YGNodeStyleSetMinWidth(child, 100);
            } else if (variant == 1) {
              YGNodeStyleSetWidthAuto(child); YGNodeStyleSetHeight(child, 30); YGNodeStyleSetPosition(child, YGEdgeRight, 18); YGNodeStyleSetPosition(child, YGEdgeBottom, 10); YGNodeStyleSetMaxHeight(child, 20);
            } else {
              YGNodeStyleSetWidth(child, 80); YGNodeStyleSetHeightAuto(child); YGNodeStyleSetPosition(child, YGEdgeLeft, 12); YGNodeStyleSetPosition(child, YGEdgeTop, 8); YGNodeStyleSetPosition(child, YGEdgeBottom, 10);
            }
          } else {
            YGNodeStyleSetWidth(child, 50); YGNodeStyleSetHeight(child, 20); YGNodeStyleSetFlexGrow(child, 0); YGNodeStyleSetFlexShrink(child, 0); YGNodeStyleSetMinWidth(child, 0); YGNodeStyleSetMinHeight(child, 0);
          }
          YGNodeInsertChild(root, child, item);
        }
        YGNodeCalculateLayout(root, YGUndefined, YGUndefined, rtl ? YGDirectionRTL : YGDirectionLTR);
        std::cout << ",{\"name\":\"position-absolute-main-aspect-" << variants[variant] << '-' << directionNames[directionIndex] << '-' << (rtl ? "rtl" : "ltr")
                  << "\",\"width\":204,\"height\":104,\"gap\":10,\"flexDirection\":\"" << directionNames[directionIndex] << "\",\"flexWrap\":\"nowrap\",\"layoutDirection\":\"" << (rtl ? "rtl" : "ltr")
                  << "\",\"containerStyle\":{\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":20},\"borderWidth\":2,\"alignItems\":\"flex-start\"},\"absoluteMainAspectFixture\":true,\"boxes\":[";
        for (int item = 0; item < 3; ++item) { if (item) std::cout << ','; printBox(YGNodeGetChild(root, item)); }
        std::cout << "],\"itemStyles\":[{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"position\":\"absolute\",\"aspectRatio\":2";
        if (variant == 0) std::cout << ",\"width\":80,\"height\":\"auto\",\"left\":12,\"top\":8,\"minWidth\":100";
        else if (variant == 1) std::cout << ",\"width\":\"auto\",\"height\":30,\"right\":18,\"bottom\":10,\"maxHeight\":20";
        else std::cout << ",\"width\":80,\"height\":\"auto\",\"left\":12,\"top\":8,\"bottom\":10";
        std::cout << "},{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
        YGNodeFreeRecursive(root); YGConfigFree(config);
      }
    }
  }
  // One paired-height direction pair proves opposing insets override ratio and retain owner resize.
  for (int resized = 0; resized < 2; ++resized) {
    auto config = YGConfigNew(); YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config); YGNodeStyleSetPositionType(root, YGPositionTypeRelative); YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox); YGNodeStyleSetWidth(root, resized ? 244 : 204); YGNodeStyleSetHeight(root, resized ? 144 : 104); YGNodeStyleSetFlexDirection(root, YGFlexDirectionColumnReverse); YGNodeStyleSetFlexWrap(root, YGWrapNoWrap); YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetGap(root, YGGutterAll, 10); YGNodeStyleSetPadding(root, YGEdgeLeft, 10); YGNodeStyleSetPadding(root, YGEdgeRight, 30); YGNodeStyleSetPadding(root, YGEdgeTop, 20); YGNodeStyleSetPadding(root, YGEdgeBottom, 20); YGNodeStyleSetBorder(root, YGEdgeAll, 2);
    for (int item = 0; item < 3; ++item) { auto child = YGNodeNewWithConfig(config); if (item == 1) { YGNodeStyleSetPositionType(child, YGPositionTypeAbsolute); YGNodeStyleSetAspectRatio(child, 2); YGNodeStyleSetWidth(child, 80); YGNodeStyleSetHeightAuto(child); YGNodeStyleSetPosition(child, YGEdgeLeft, 12); YGNodeStyleSetPosition(child, YGEdgeTop, 8); YGNodeStyleSetPosition(child, YGEdgeBottom, 10); } else { YGNodeStyleSetWidth(child, 50); YGNodeStyleSetHeight(child, 20); YGNodeStyleSetFlexGrow(child, 0); YGNodeStyleSetFlexShrink(child, 0); YGNodeStyleSetMinWidth(child, 0); YGNodeStyleSetMinHeight(child, 0); } YGNodeInsertChild(root, child, item); }
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionRTL);
    std::cout << ",{\"name\":\"position-absolute-main-aspect-height-pair-column-reverse-rtl" << (resized ? "-resized" : "") << "\",\"width\":" << (resized ? 244 : 204) << ",\"height\":" << (resized ? 144 : 104) << ",\"gap\":10,\"flexDirection\":\"column-reverse\",\"flexWrap\":\"nowrap\",\"layoutDirection\":\"rtl\",\"containerStyle\":{\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":20},\"borderWidth\":2,\"alignItems\":\"flex-start\"},\"absoluteMainAspectFixture\":true,\"boxes\":["; for (int item = 0; item < 3; ++item) { if (item) std::cout << ','; printBox(YGNodeGetChild(root, item)); } std::cout << "],\"itemStyles\":[{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"position\":\"absolute\",\"aspectRatio\":2,\"width\":80,\"height\":\"auto\",\"left\":12,\"top\":8,\"bottom\":10},{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
    YGNodeFreeRecursive(root); YGConfigFree(config);
  }
}

static void absoluteWrapCases() {
  for (int resized = 0; resized < 2; ++resized) {
    const int width = resized ? 124 : 164;
    auto config = YGConfigNew(); YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetPositionType(root, YGPositionTypeRelative);
    YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
    YGNodeStyleSetWidth(root, width); YGNodeStyleSetHeight(root, 104);
    YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow); YGNodeStyleSetFlexWrap(root, YGWrapWrap);
    YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetAlignContent(root, YGAlignFlexStart); YGNodeStyleSetGap(root, YGGutterAll, 10);
    YGNodeStyleSetBorder(root, YGEdgeAll, 2); YGNodeStyleSetPadding(root, YGEdgeAll, 10);
    for (int index = 0; index < 4; ++index) {
      auto child = YGNodeNewWithConfig(config);
      YGNodeStyleSetFlexGrow(child, 0); YGNodeStyleSetFlexShrink(child, 0); YGNodeStyleSetMinWidth(child, 0); YGNodeStyleSetMinHeight(child, 0);
      if (index == 1) {
        YGNodeStyleSetPositionType(child, YGPositionTypeAbsolute);
        YGNodeStyleSetWidth(child, 50); YGNodeStyleSetHeight(child, 30);
        YGNodeStyleSetPosition(child, YGEdgeLeft, 12); YGNodeStyleSetPosition(child, YGEdgeTop, 8);
      } else { YGNodeStyleSetWidth(child, 60); YGNodeStyleSetHeight(child, 20); }
      YGNodeInsertChild(root, child, index);
    }
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionLTR);
    std::cout << ",{\"name\":\"position-absolute-wrap-" << (resized ? "narrow" : "wide")
      << "\",\"width\":" << width << ",\"height\":104,\"gap\":10,\"flexDirection\":\"row\",\"flexWrap\":\"wrap\",\"absoluteWrapFixture\":true,\"containerStyle\":{\"position\":\"relative\",\"boxSizing\":\"border-box\",\"padding\":10,\"borderWidth\":2,\"alignItems\":\"flex-start\",\"alignContent\":\"flex-start\"},\"boxes\":[";
    for (int index = 0; index < 4; ++index) { if (index) std::cout << ','; printBox(YGNodeGetChild(root, index)); }
    std::cout << "],\"itemStyles\":[{\"width\":60,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"position\":\"absolute\",\"width\":50,\"height\":30,\"left\":12,\"top\":8,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"width\":60,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"width\":60,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
    YGNodeFreeRecursive(root); YGConfigFree(config);
  }
}

static int absoluteTextHeightMeasureCalls = 0;
static int absoluteTextHeightWords = 3;
static YGSize absoluteTextHeightMeasure(YGNodeConstRef, float width, YGMeasureMode widthMode, float, YGMeasureMode) {
  absoluteTextHeightMeasureCalls++;
  // Synthetic sizing callback only: `aaaa` and each space advance 6px.
  // It records a native layout oracle, never Canvas-font parity.
  const float usedWidth = widthMode == YGMeasureModeUndefined ? float(absoluteTextHeightWords * 24 + (absoluteTextHeightWords - 1) * 6) : width;
  float lineWidth = 0, maximum = 0; int lines = 1;
  for (int word = 0; word < absoluteTextHeightWords; ++word) {
    const float next = lineWidth == 0 ? 24 : lineWidth + 30;
    if (lineWidth != 0 && next > usedWidth) { maximum = std::max(maximum, lineWidth); ++lines; lineWidth = 24; }
    else lineWidth = next;
  }
  return {std::max(maximum, lineWidth), float(lines * 10)};
}
static void absoluteTextHeightCases() {
  for (int widthIndex = 0; widthIndex < 2; ++widthIndex) for (int wordIndex = 0; wordIndex < 2; ++wordIndex) {
    const int textWidth = widthIndex == 0 ? 40 : 80;
    absoluteTextHeightWords = wordIndex == 0 ? 3 : 6;
    absoluteTextHeightMeasureCalls = 0;
    auto config = YGConfigNew(); YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config); YGNodeStyleSetPositionType(root, YGPositionTypeRelative); YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
    YGNodeStyleSetWidth(root, 204); YGNodeStyleSetHeight(root, 104); YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow); YGNodeStyleSetFlexWrap(root, YGWrapNoWrap); YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetGap(root, YGGutterAll, 10);
    YGNodeStyleSetPadding(root, YGEdgeLeft, 10); YGNodeStyleSetPadding(root, YGEdgeRight, 30); YGNodeStyleSetPadding(root, YGEdgeTop, 20); YGNodeStyleSetPadding(root, YGEdgeBottom, 20); YGNodeStyleSetBorder(root, YGEdgeAll, 2);
    auto a = YGNodeNewWithConfig(config), text = YGNodeNewWithConfig(config), c = YGNodeNewWithConfig(config);
    for (auto flow : {a, c}) { YGNodeStyleSetWidth(flow, 50); YGNodeStyleSetHeight(flow, 20); YGNodeStyleSetFlexGrow(flow, 0); YGNodeStyleSetFlexShrink(flow, 0); setMinZero(flow); }
    YGNodeStyleSetPositionType(text, YGPositionTypeAbsolute); YGNodeStyleSetWidth(text, textWidth); YGNodeStyleSetHeightAuto(text); YGNodeStyleSetPosition(text, YGEdgeLeft, 12); YGNodeStyleSetPosition(text, YGEdgeBottom, 10); YGNodeStyleSetFlexGrow(text, 0); YGNodeStyleSetFlexShrink(text, 0); setMinZero(text); YGNodeSetMeasureFunc(text, absoluteTextHeightMeasure);
    YGNodeInsertChild(root, a, 0); YGNodeInsertChild(root, text, 1); YGNodeInsertChild(root, c, 2); YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionLTR);
    const char* widthName = textWidth == 40 ? "narrow" : "wide"; const char* wordName = absoluteTextHeightWords == 3 ? "three" : "six";
    std::cout << ",{\"name\":\"position-absolute-text-height-" << widthName << "-" << wordName << "\",\"width\":204,\"height\":104,\"gap\":10,\"flexDirection\":\"row\",\"flexWrap\":\"nowrap\",\"containerStyle\":{\"position\":\"relative\",\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":20},\"borderWidth\":2,\"alignItems\":\"flex-start\"},\"absoluteTextHeightFixture\":true,\"textValue\":\"";
    for (int word = 0; word < absoluteTextHeightWords; ++word) { if (word) std::cout << " "; std::cout << "aaaa"; }
    std::cout << "\",\"textMeasure\":{\"kind\":\"deterministic-callback\",\"glyphAdvance\":6,\"spaceAdvance\":6,\"lineHeight\":10,\"wrapAtSpaces\":true,\"fontParityClaim\":false,\"calls\":" << absoluteTextHeightMeasureCalls << "},\"boxes\":["; printBox(a); std::cout << ','; printBox(text); std::cout << ','; printBox(c); std::cout << "],\"itemStyles\":[{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"position\":\"absolute\",\"width\":" << textWidth << ",\"height\":\"auto\",\"left\":12,\"bottom\":10,\"wrap\":true,\"font\":\"10px monospace\",\"lineHeight\":10,\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0},{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
    YGNodeFreeRecursive(root); YGConfigFree(config);
  }
}

static float absoluteTextWidthQuery = 0;
static YGMeasureMode absoluteTextWidthMode = YGMeasureModeUndefined;
static float absoluteTextHeightQuery = 0;
static YGMeasureMode absoluteTextHeightMode = YGMeasureModeUndefined;
static YGSize absoluteTextWidthMeasure(YGNodeConstRef, float width, YGMeasureMode widthMode, float height, YGMeasureMode heightMode) {
  absoluteTextWidthQuery = width; absoluteTextWidthMode = widthMode;
  absoluteTextHeightQuery = height; absoluteTextHeightMode = heightMode;
  // Synthetic source callback: three `aaaa` words, 6px glyphs/spaces = 84px.
  // It is provenance for Yoga's query envelope, never Canvas font parity.
  return {84, 20};
}
static const char* measureModeName(YGMeasureMode mode) {
  return mode == YGMeasureModeExactly ? "exact" : mode == YGMeasureModeAtMost ? "at-most" : "undefined";
}
static void absoluteTextWidthCases() {
  for (int column = 0; column < 2; ++column) for (int rtl = 0; rtl < 2; ++rtl) {
    absoluteTextWidthQuery = absoluteTextHeightQuery = 0;
    absoluteTextWidthMode = absoluteTextHeightMode = YGMeasureModeUndefined;
    auto config = YGConfigNew(); YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config); YGNodeStyleSetPositionType(root, YGPositionTypeRelative); YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
    YGNodeStyleSetWidth(root, 204); YGNodeStyleSetHeight(root, 104); YGNodeStyleSetFlexDirection(root, column ? YGFlexDirectionColumn : YGFlexDirectionRow); YGNodeStyleSetFlexWrap(root, YGWrapNoWrap); YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetGap(root, YGGutterAll, 10);
    YGNodeStyleSetPadding(root, YGEdgeLeft, 10); YGNodeStyleSetPadding(root, YGEdgeRight, 30); YGNodeStyleSetPadding(root, YGEdgeTop, 20); YGNodeStyleSetPadding(root, YGEdgeBottom, 20); YGNodeStyleSetBorder(root, YGEdgeAll, 2);
    auto a = YGNodeNewWithConfig(config), text = YGNodeNewWithConfig(config), c = YGNodeNewWithConfig(config);
    for (auto flow : {a, c}) { YGNodeStyleSetWidth(flow, 50); YGNodeStyleSetHeight(flow, 20); YGNodeStyleSetFlexGrow(flow, 0); YGNodeStyleSetFlexShrink(flow, 0); setMinZero(flow); }
    YGNodeStyleSetPositionType(text, YGPositionTypeAbsolute); YGNodeStyleSetWidthAuto(text); YGNodeStyleSetHeight(text, 20); YGNodeStyleSetPosition(text, YGEdgeRight, 18); YGNodeStyleSetPosition(text, YGEdgeTop, 8); YGNodeStyleSetFlexGrow(text, 0); YGNodeStyleSetFlexShrink(text, 0); setMinZero(text); YGNodeSetMeasureFunc(text, absoluteTextWidthMeasure);
    YGNodeInsertChild(root, a, 0); YGNodeInsertChild(root, text, 1); YGNodeInsertChild(root, c, 2); YGNodeCalculateLayout(root, YGUndefined, YGUndefined, rtl ? YGDirectionRTL : YGDirectionLTR);
    std::cout << ",{\"name\":\"position-absolute-text-width-" << (column ? "column" : "row") << '-' << (rtl ? "rtl" : "ltr") << "\",\"width\":204,\"height\":104,\"gap\":10,\"flexDirection\":\"" << (column ? "column" : "row") << "\",\"flexWrap\":\"nowrap\",\"layoutDirection\":\"" << (rtl ? "rtl" : "ltr") << "\",\"containerStyle\":{\"position\":\"relative\",\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":20},\"borderWidth\":2,\"alignItems\":\"flex-start\"},\"absoluteTextWidthFixture\":true,\"classification\":\"native-font-metric-source\",\"comparisonLabel\":\"Yoga synthetic 6px callback is query-source provenance only; Pibbl derives Text width from the active Canvas font.\",\"textValue\":\"aaaa aaaa aaaa\",\"nativeMeasurementConstraints\":{\"width\":\"" << measureModeName(absoluteTextWidthMode) << "\",\"widthValue\":"; if (std::isfinite(absoluteTextWidthQuery)) std::cout << absoluteTextWidthQuery; else std::cout << "\"unbounded\""; std::cout << ",\"height\":\"" << measureModeName(absoluteTextHeightMode) << "\",\"heightValue\":"; if (std::isfinite(absoluteTextHeightQuery)) std::cout << absoluteTextHeightQuery; else std::cout << "\"unbounded\""; std::cout << "},\"boxes\":["; printBox(a); std::cout << ','; printBox(text); std::cout << ','; printBox(c); std::cout << "],\"itemStyles\":[{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"position\":\"absolute\",\"width\":\"auto\",\"height\":20,\"right\":18,\"top\":8,\"font\":\"10px monospace\",\"wrap\":false,\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0},{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
    YGNodeFreeRecursive(root); YGConfigFree(config);
  }
}


static float absoluteTextBothWidth = 0, absoluteTextBothHeight = 0;
static YGMeasureMode absoluteTextBothWidthMode = YGMeasureModeUndefined, absoluteTextBothHeightMode = YGMeasureModeUndefined;
static YGSize absoluteTextBothMeasure(YGNodeConstRef, float width, YGMeasureMode widthMode, float height, YGMeasureMode heightMode) {
  absoluteTextBothWidth = width; absoluteTextBothHeight = height;
  absoluteTextBothWidthMode = widthMode; absoluteTextBothHeightMode = heightMode;
  // Three aaaa words using a 6px synthetic glyph/space source: 84px × 20px.
  // This captures Yoga's constraint envelope only; it is not Canvas font parity.
  return {84, 20};
}
static void absoluteTextBothCases() {
  for (int column = 0; column < 2; ++column) for (int rtl = 0; rtl < 2; ++rtl) {
    absoluteTextBothWidth = absoluteTextBothHeight = 0;
    absoluteTextBothWidthMode = absoluteTextBothHeightMode = YGMeasureModeUndefined;
    auto config = YGConfigNew(); YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
    auto root = YGNodeNewWithConfig(config); YGNodeStyleSetPositionType(root, YGPositionTypeRelative); YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
    YGNodeStyleSetWidth(root, 204); YGNodeStyleSetHeight(root, 104); YGNodeStyleSetFlexDirection(root, column ? YGFlexDirectionColumn : YGFlexDirectionRow); YGNodeStyleSetFlexWrap(root, YGWrapNoWrap); YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetGap(root, YGGutterAll, 10);
    YGNodeStyleSetPadding(root, YGEdgeLeft, 10); YGNodeStyleSetPadding(root, YGEdgeRight, 30); YGNodeStyleSetPadding(root, YGEdgeTop, 20); YGNodeStyleSetPadding(root, YGEdgeBottom, 20); YGNodeStyleSetBorder(root, YGEdgeAll, 2);
    auto a = YGNodeNewWithConfig(config), text = YGNodeNewWithConfig(config), c = YGNodeNewWithConfig(config);
    for (auto flow : {a, c}) { YGNodeStyleSetWidth(flow, 50); YGNodeStyleSetHeight(flow, 20); YGNodeStyleSetFlexGrow(flow, 0); YGNodeStyleSetFlexShrink(flow, 0); setMinZero(flow); }
    YGNodeStyleSetPositionType(text, YGPositionTypeAbsolute); YGNodeStyleSetPosition(text, YGEdgeRight, 18); YGNodeStyleSetPosition(text, YGEdgeBottom, 10); YGNodeStyleSetFlexGrow(text, 0); YGNodeStyleSetFlexShrink(text, 0); setMinZero(text); YGNodeSetMeasureFunc(text, absoluteTextBothMeasure);
    YGNodeInsertChild(root, a, 0); YGNodeInsertChild(root, text, 1); YGNodeInsertChild(root, c, 2); YGNodeCalculateLayout(root, YGUndefined, YGUndefined, rtl ? YGDirectionRTL : YGDirectionLTR);
    std::cout << ",{\"name\":\"position-absolute-text-both-auto-" << (column ? "column" : "row") << '-' << (rtl ? "rtl" : "ltr") << "\",\"width\":204,\"height\":104,\"gap\":10,\"flexDirection\":\"" << (column ? "column" : "row") << "\",\"flexWrap\":\"nowrap\",\"layoutDirection\":\"" << (rtl ? "rtl" : "ltr") << "\",\"containerStyle\":{\"position\":\"relative\",\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":20},\"borderWidth\":2,\"alignItems\":\"flex-start\"},\"absoluteTextBothFixture\":true,\"classification\":\"native-font-metric-source\",\"comparisonLabel\":\"Yoga synthetic 6px callback is query-source provenance only; Pibbl derives both Text dimensions from active Canvas ink bounds.\",\"textValue\":\"aaaa aaaa aaaa\",\"nativeMeasurementConstraints\":{\"width\":\"" << measureModeName(absoluteTextBothWidthMode) << "\",\"widthValue\":"; if (std::isfinite(absoluteTextBothWidth)) std::cout << absoluteTextBothWidth; else std::cout << "\"unbounded\""; std::cout << ",\"height\":\"" << measureModeName(absoluteTextBothHeightMode) << "\",\"heightValue\":"; if (std::isfinite(absoluteTextBothHeight)) std::cout << absoluteTextBothHeight; else std::cout << "\"unbounded\""; std::cout << "},\"boxes\":["; printBox(a); std::cout << ','; printBox(text); std::cout << ','; printBox(c); std::cout << "],\"itemStyles\":[{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"position\":\"absolute\",\"width\":\"auto\",\"height\":\"auto\",\"right\":18,\"bottom\":10,\"font\":\"10px monospace\",\"wrap\":false,\"minWidth\":0,\"minHeight\":0,\"flexGrow\":0,\"flexShrink\":0},{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
    YGNodeFreeRecursive(root); YGConfigFree(config);
  }
}


static const char* wrapAnchorName(YGWrap value) { return value == YGWrapWrapReverse ? "wrap-reverse" : "wrap"; }
static const char* wrapAnchorDirectionName(YGFlexDirection value) { return value == YGFlexDirectionRow ? "row" : value == YGFlexDirectionRowReverse ? "row-reverse" : value == YGFlexDirectionColumn ? "column" : "column-reverse"; }
static void absoluteAnchoredWrapRecord(YGFlexDirection direction, YGWrap wrap, YGDirection writing, bool trailing, bool resized) {
  auto config = YGConfigNew(); YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
  auto root = YGNodeNewWithConfig(config); YGNodeStyleSetPositionType(root, YGPositionTypeRelative); YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox);
  YGNodeStyleSetWidth(root, resized ? 244 : 164); YGNodeStyleSetHeight(root, resized ? 124 : 84); YGNodeStyleSetFlexDirection(root, direction); YGNodeStyleSetFlexWrap(root, wrap); YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetAlignContent(root, YGAlignFlexStart); YGNodeStyleSetGap(root, YGGutterAll, 10); YGNodeStyleSetPadding(root, YGEdgeAll, 10); YGNodeStyleSetBorder(root, YGEdgeAll, 2);
  auto a = YGNodeNewWithConfig(config), absolute = YGNodeNewWithConfig(config), c = YGNodeNewWithConfig(config), d = YGNodeNewWithConfig(config);
  for (auto flow : {a, c, d}) { YGNodeStyleSetWidth(flow, 60); YGNodeStyleSetHeight(flow, 20); YGNodeStyleSetFlexGrow(flow, 0); YGNodeStyleSetFlexShrink(flow, 0); setMinZero(flow); }
  YGNodeStyleSetPositionType(absolute, YGPositionTypeAbsolute); YGNodeStyleSetWidth(absolute, 50); YGNodeStyleSetHeight(absolute, 30); YGNodeStyleSetFlexGrow(absolute, 0); YGNodeStyleSetFlexShrink(absolute, 0); setMinZero(absolute);
  if (trailing) { YGNodeStyleSetPosition(absolute, YGEdgeRight, 18); YGNodeStyleSetPosition(absolute, YGEdgeBottom, 10); } else { YGNodeStyleSetPosition(absolute, YGEdgeLeft, 12); YGNodeStyleSetPosition(absolute, YGEdgeTop, 8); }
  YGNodeInsertChild(root, a, 0); YGNodeInsertChild(root, absolute, 1); YGNodeInsertChild(root, c, 2); YGNodeInsertChild(root, d, 3); YGNodeCalculateLayout(root, YGUndefined, YGUndefined, writing);
  std::cout << ",{\"name\":\"position-absolute-anchored-wrap-" << wrapAnchorDirectionName(direction) << '-' << wrapAnchorName(wrap) << '-' << (writing == YGDirectionRTL ? "rtl" : "ltr") << '-' << (trailing ? "right-bottom" : "left-top") << (resized ? "-resized" : "") << "\",\"width\":" << (resized ? 244 : 164) << ",\"height\":" << (resized ? 124 : 84) << ",\"gap\":10,\"flexDirection\":\"" << wrapAnchorDirectionName(direction) << "\",\"flexWrap\":\"" << wrapAnchorName(wrap) << "\",\"layoutDirection\":\"" << (writing == YGDirectionRTL ? "rtl" : "ltr") << "\",\"containerStyle\":{\"position\":\"relative\",\"boxSizing\":\"border-box\",\"padding\":10,\"borderWidth\":2,\"alignItems\":\"flex-start\",\"alignContent\":\"flex-start\"},\"absoluteAnchoredWrapFixture\":true,\"boxes\":["; printBox(a); std::cout << ','; printBox(absolute); std::cout << ','; printBox(c); std::cout << ','; printBox(d); std::cout << "],\"itemStyles\":[{\"width\":60,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"position\":\"absolute\",\"width\":50,\"height\":30,\"" << (trailing ? "right\":18,\"bottom\":10" : "left\":12,\"top\":8") << ",\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"width\":60,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"width\":60,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
  YGNodeFreeRecursive(root); YGConfigFree(config);
}
static const char* relativeWrappedDirectionName(YGFlexDirection value) { return value == YGFlexDirectionRow ? "row" : value == YGFlexDirectionRowReverse ? "row-reverse" : value == YGFlexDirectionColumn ? "column" : "column-reverse"; }
static const char* relativeWrappedWrapName(YGWrap value) { return value == YGWrapWrapReverse ? "wrap-reverse" : "wrap"; }
static void relativeWrappedDirectionRecord(YGFlexDirection direction, YGWrap wrap, YGDirection writing, bool relative) {
  auto config = YGConfigNew(); YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
  auto root = YGNodeNewWithConfig(config); YGNodeStyleSetPositionType(root, YGPositionTypeRelative); YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox); YGNodeStyleSetWidth(root, 164); YGNodeStyleSetHeight(root, 84); YGNodeStyleSetFlexDirection(root, direction); YGNodeStyleSetFlexWrap(root, wrap); YGNodeStyleSetGap(root, YGGutterAll, 10); YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetAlignContent(root, YGAlignFlexStart); YGNodeStyleSetPadding(root, YGEdgeAll, 10); YGNodeStyleSetBorder(root, YGEdgeAll, 2);
  auto a = YGNodeNewWithConfig(config), b = YGNodeNewWithConfig(config), c = YGNodeNewWithConfig(config);
  for (auto flow : {a, b, c}) { YGNodeStyleSetWidth(flow, 60); YGNodeStyleSetHeight(flow, 20); YGNodeStyleSetFlexGrow(flow, 0); YGNodeStyleSetFlexShrink(flow, 0); setMinZero(flow); }
  YGNodeStyleSetPositionType(b, relative ? YGPositionTypeRelative : YGPositionTypeStatic); YGNodeStyleSetPosition(b, YGEdgeLeft, 12); YGNodeStyleSetPosition(b, YGEdgeRight, 18); YGNodeStyleSetPosition(b, YGEdgeTop, 8); YGNodeStyleSetPosition(b, YGEdgeBottom, 10);
  YGNodeInsertChild(root, a, 0); YGNodeInsertChild(root, b, 1); YGNodeInsertChild(root, c, 2); YGNodeCalculateLayout(root, YGUndefined, YGUndefined, writing);
  auto baseline = YGNodeNewWithConfig(config); YGNodeStyleSetPositionType(baseline, YGPositionTypeRelative); YGNodeStyleSetBoxSizing(baseline, YGBoxSizingBorderBox); YGNodeStyleSetWidth(baseline, 164); YGNodeStyleSetHeight(baseline, 84); YGNodeStyleSetFlexDirection(baseline, direction); YGNodeStyleSetFlexWrap(baseline, wrap); YGNodeStyleSetGap(baseline, YGGutterAll, 10); YGNodeStyleSetAlignItems(baseline, YGAlignFlexStart); YGNodeStyleSetAlignContent(baseline, YGAlignFlexStart); YGNodeStyleSetPadding(baseline, YGEdgeAll, 10); YGNodeStyleSetBorder(baseline, YGEdgeAll, 2);
  for (int item = 0; item < 3; ++item) { auto flow = YGNodeNewWithConfig(config); YGNodeStyleSetWidth(flow, 60); YGNodeStyleSetHeight(flow, 20); YGNodeStyleSetFlexGrow(flow, 0); YGNodeStyleSetFlexShrink(flow, 0); setMinZero(flow); YGNodeInsertChild(baseline, flow, item); }
  YGNodeCalculateLayout(baseline, YGUndefined, YGUndefined, writing);
  const auto baseB = YGNodeGetChild(baseline, 1); const float physicalX = YGNodeLayoutGetLeft(baseB) + (writing == YGDirectionRTL ? -18 : 12); const float physicalY = YGNodeLayoutGetTop(baseB) + 8;
  const bool sameNative = std::fabs(YGNodeLayoutGetLeft(b) - physicalX) < .001f && std::fabs(YGNodeLayoutGetTop(b) - physicalY) < .001f;
  const bool classified = !relative || !sameNative;
  std::cout << ",{\"name\":\"position-relative-wrapped-" << relativeWrappedDirectionName(direction) << '-' << relativeWrappedWrapName(wrap) << '-' << (relative ? "relative" : "static") << '-' << (writing == YGDirectionRTL ? "rtl" : "ltr") << "\",\"width\":164,\"height\":84,\"gap\":10,\"flexDirection\":\"" << relativeWrappedDirectionName(direction) << "\",\"flexWrap\":\"" << relativeWrappedWrapName(wrap) << "\",\"layoutDirection\":\"" << (writing == YGDirectionRTL ? "rtl" : "ltr") << "\",\"containerStyle\":{\"position\":\"relative\",\"boxSizing\":\"border-box\",\"padding\":10,\"borderWidth\":2,\"alignItems\":\"flex-start\",\"alignContent\":\"flex-start\"},\"relativeWrappedDirectionFixture\":true,\"boxes\":["; printBox(a); std::cout << ','; printBox(b); std::cout << ','; printBox(c); std::cout << ']';
  if (classified) { std::cout << ",\"classification\":\"" << (relative ? "preserved-physical-relative-offset" : "preserved-static-ignores-insets") << "\",\"comparisonLabel\":\"" << (relative ? "Pibbl preserves physical final-world relative offsets; Yoga reverses offsets with main or wrap reversal." : "Pibbl static ignores physical insets; Yoga applies the cross-axis inset in this wrapped owner.") << "\",\"pibblBoxes\":["; printBox(a); std::cout << ",{\"x\":" << (relative ? physicalX : YGNodeLayoutGetLeft(baseB)) << ",\"y\":" << (relative ? physicalY : YGNodeLayoutGetTop(baseB)) << ",\"width\":60,\"height\":20},"; printBox(c); std::cout << ']'; }
  std::cout << ",\"itemStyles\":[{\"width\":60,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"width\":60,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"position\":\"" << (relative ? "relative" : "static") << "\",\"left\":12,\"right\":18,\"top\":8,\"bottom\":10},{\"width\":60,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
  YGNodeFreeRecursive(root); YGNodeFreeRecursive(baseline); YGConfigFree(config);
}
static void relativeWrappedDirectionCases() {
  const YGFlexDirection directions[] = {YGFlexDirectionRow, YGFlexDirectionRowReverse, YGFlexDirectionColumn, YGFlexDirectionColumnReverse}; const YGWrap wraps[] = {YGWrapWrap, YGWrapWrapReverse};
  for (const auto direction : directions) for (const auto wrap : wraps) for (int rtl = 0; rtl < 2; ++rtl) for (int relative = 0; relative < 2; ++relative) relativeWrappedDirectionRecord(direction, wrap, rtl ? YGDirectionRTL : YGDirectionLTR, relative != 0);
}

static const char* absoluteWrappedAlignmentDirectionName(YGFlexDirection value) { return value == YGFlexDirectionRow ? "row" : value == YGFlexDirectionRowReverse ? "row-reverse" : value == YGFlexDirectionColumn ? "column" : "column-reverse"; }
static const char* absoluteWrappedAlignmentWrapName(YGWrap value) { return value == YGWrapWrapReverse ? "wrap-reverse" : "wrap"; }
static void absoluteWrappedAlignmentRecord(YGFlexDirection direction, YGWrap wrap, YGDirection writing, int profile) {
  auto config = YGConfigNew(); YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
  auto root = YGNodeNewWithConfig(config); YGNodeStyleSetPositionType(root, YGPositionTypeRelative); YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox); YGNodeStyleSetWidth(root, 164); YGNodeStyleSetHeight(root, 84); YGNodeStyleSetFlexDirection(root, direction); YGNodeStyleSetFlexWrap(root, wrap); YGNodeStyleSetGap(root, YGGutterAll, 10); YGNodeStyleSetJustifyContent(root, YGJustifyCenter); YGNodeStyleSetAlignItems(root, YGAlignFlexEnd); YGNodeStyleSetAlignContent(root, YGAlignFlexStart); YGNodeStyleSetPadding(root, YGEdgeAll, 10); YGNodeStyleSetBorder(root, YGEdgeAll, 2);
  auto a = YGNodeNewWithConfig(config), absolute = YGNodeNewWithConfig(config), c = YGNodeNewWithConfig(config), d = YGNodeNewWithConfig(config);
  for (auto flow : {a, c, d}) { YGNodeStyleSetWidth(flow, 60); YGNodeStyleSetHeight(flow, 20); YGNodeStyleSetFlexGrow(flow, 0); YGNodeStyleSetFlexShrink(flow, 0); setMinZero(flow); }
  YGNodeStyleSetPositionType(absolute, YGPositionTypeAbsolute); YGNodeStyleSetWidth(absolute, 50); YGNodeStyleSetHeight(absolute, 20); YGNodeStyleSetFlexGrow(absolute, 0); YGNodeStyleSetFlexShrink(absolute, 0); setMinZero(absolute);
  const char* profileName = profile == 0 ? "none" : profile == 1 ? "left-only" : profile == 2 ? "top-only" : "right-bottom";
  if (profile == 1) YGNodeStyleSetPosition(absolute, YGEdgeLeft, 12); else if (profile == 2) YGNodeStyleSetPosition(absolute, YGEdgeTop, 8); else if (profile == 3) { YGNodeStyleSetPosition(absolute, YGEdgeRight, 18); YGNodeStyleSetPosition(absolute, YGEdgeBottom, 10); }
  YGNodeInsertChild(root, a, 0); YGNodeInsertChild(root, absolute, 1); YGNodeInsertChild(root, c, 2); YGNodeInsertChild(root, d, 3); YGNodeCalculateLayout(root, YGUndefined, YGUndefined, writing);
  std::cout << ",{\"name\":\"position-absolute-wrapped-alignment-" << absoluteWrappedAlignmentDirectionName(direction) << '-' << absoluteWrappedAlignmentWrapName(wrap) << '-' << (writing == YGDirectionRTL ? "rtl" : "ltr") << '-' << profileName << "\",\"width\":164,\"height\":84,\"gap\":10,\"flexDirection\":\"" << absoluteWrappedAlignmentDirectionName(direction) << "\",\"flexWrap\":\"" << absoluteWrappedAlignmentWrapName(wrap) << "\",\"layoutDirection\":\"" << (writing == YGDirectionRTL ? "rtl" : "ltr") << "\",\"containerStyle\":{\"position\":\"relative\",\"boxSizing\":\"border-box\",\"padding\":10,\"borderWidth\":2,\"justifyContent\":\"center\",\"alignItems\":\"flex-end\",\"alignContent\":\"flex-start\"},\"absoluteWrappedAlignmentFixture\":true,\"boxes\":["; printBox(a); std::cout << ','; printBox(absolute); std::cout << ','; printBox(c); std::cout << ','; printBox(d); std::cout << "],\"itemStyles\":[{\"width\":60,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"position\":\"absolute\",\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0";
  if (profile == 1) std::cout << ",\"left\":12"; else if (profile == 2) std::cout << ",\"top\":8"; else if (profile == 3) std::cout << ",\"right\":18,\"bottom\":10";
  std::cout << "},{\"width\":60,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"width\":60,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
  YGNodeFreeRecursive(root); YGConfigFree(config);
}
static void absoluteWrappedAlignmentCases() {
  const YGFlexDirection directions[] = {YGFlexDirectionRow, YGFlexDirectionRowReverse, YGFlexDirectionColumn, YGFlexDirectionColumnReverse}; const YGWrap wraps[] = {YGWrapWrap, YGWrapWrapReverse};
  for (const auto direction : directions) for (const auto wrap : wraps) for (int rtl = 0; rtl < 2; ++rtl) for (int profile = 0; profile < 4; ++profile) absoluteWrappedAlignmentRecord(direction, wrap, rtl ? YGDirectionRTL : YGDirectionLTR, profile);
}

static void absoluteAnchoredWrapCases() {
  const YGFlexDirection directions[] = {YGFlexDirectionRow, YGFlexDirectionRowReverse, YGFlexDirectionColumn, YGFlexDirectionColumnReverse}; const YGWrap wraps[] = {YGWrapWrap, YGWrapWrapReverse};
  for (const auto direction : directions) for (const auto wrap : wraps) for (int rtl = 0; rtl < 2; ++rtl) for (int trailing = 0; trailing < 2; ++trailing) absoluteAnchoredWrapRecord(direction, wrap, rtl ? YGDirectionRTL : YGDirectionLTR, trailing, false);
  absoluteAnchoredWrapRecord(YGFlexDirectionRow, YGWrapWrap, YGDirectionLTR, false, true);
  absoluteAnchoredWrapRecord(YGFlexDirectionColumnReverse, YGWrapWrapReverse, YGDirectionRTL, true, true);
}

static const char* percentageInsetDirectionName(YGFlexDirection value) { return value == YGFlexDirectionRow ? "row" : value == YGFlexDirectionRowReverse ? "row-reverse" : value == YGFlexDirectionColumn ? "column" : "column-reverse"; }
static const char* percentageInsetWrapName(YGWrap value) { return value == YGWrapWrapReverse ? "wrap-reverse" : "wrap"; }
static void absolutePercentageInsetRecord(YGFlexDirection direction, YGWrap wrap, YGDirection writing, int profile, bool resized) {
  const float width = resized ? 264 : 204, height = resized ? 154 : 104;
  auto config = YGConfigNew(); YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
  auto root = YGNodeNewWithConfig(config); YGNodeStyleSetPositionType(root, YGPositionTypeRelative); YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox); YGNodeStyleSetWidth(root, width); YGNodeStyleSetHeight(root, height); YGNodeStyleSetFlexDirection(root, direction); YGNodeStyleSetFlexWrap(root, wrap); YGNodeStyleSetGap(root, YGGutterAll, 10); YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetAlignContent(root, YGAlignFlexStart); YGNodeStyleSetPadding(root, YGEdgeLeft, 10); YGNodeStyleSetPadding(root, YGEdgeRight, 30); YGNodeStyleSetPadding(root, YGEdgeTop, 20); YGNodeStyleSetPadding(root, YGEdgeBottom, 20); YGNodeStyleSetBorder(root, YGEdgeAll, 2);
  auto a = YGNodeNewWithConfig(config), absolute = YGNodeNewWithConfig(config), c = YGNodeNewWithConfig(config);
  for (auto flow : {a, c}) { YGNodeStyleSetWidth(flow, 50); YGNodeStyleSetHeight(flow, 20); YGNodeStyleSetFlexGrow(flow, 0); YGNodeStyleSetFlexShrink(flow, 0); setMinZero(flow); }
  YGNodeStyleSetPositionType(absolute, YGPositionTypeAbsolute); YGNodeStyleSetFlexGrow(absolute, 0); YGNodeStyleSetFlexShrink(absolute, 0); setMinZero(absolute);
  const char* profileName = profile == 0 ? "left-top" : profile == 1 ? "right-bottom" : profile == 2 ? "paired-auto" : profile == 3 ? "aspect" : "overflow";
  if (profile == 0) { YGNodeStyleSetWidth(absolute, 50); YGNodeStyleSetHeight(absolute, 20); YGNodeStyleSetPositionPercent(absolute, YGEdgeLeft, 10); YGNodeStyleSetPositionPercent(absolute, YGEdgeTop, 20); }
  else if (profile == 1) { YGNodeStyleSetWidth(absolute, 50); YGNodeStyleSetHeight(absolute, 20); YGNodeStyleSetPositionPercent(absolute, YGEdgeRight, 10); YGNodeStyleSetPositionPercent(absolute, YGEdgeBottom, 20); }
  else if (profile == 2) { YGNodeStyleSetWidthAuto(absolute); YGNodeStyleSetHeightAuto(absolute); YGNodeStyleSetPositionPercent(absolute, YGEdgeLeft, 10); YGNodeStyleSetPositionPercent(absolute, YGEdgeRight, 15); YGNodeStyleSetPositionPercent(absolute, YGEdgeTop, 10); YGNodeStyleSetPositionPercent(absolute, YGEdgeBottom, 20); }
  else if (profile == 3) { YGNodeStyleSetWidth(absolute, 80); YGNodeStyleSetHeightAuto(absolute); YGNodeStyleSetAspectRatio(absolute, 2); YGNodeStyleSetPositionPercent(absolute, YGEdgeLeft, 10); YGNodeStyleSetPositionPercent(absolute, YGEdgeTop, 20); }
  else { YGNodeStyleSetWidth(absolute, 50); YGNodeStyleSetHeight(absolute, 20); YGNodeStyleSetPositionPercent(absolute, YGEdgeLeft, -10); YGNodeStyleSetPositionPercent(absolute, YGEdgeTop, 120); }
  YGNodeInsertChild(root, a, 0); YGNodeInsertChild(root, absolute, 1); YGNodeInsertChild(root, c, 2); YGNodeCalculateLayout(root, YGUndefined, YGUndefined, writing);
  const bool preservedReflection = (direction == YGFlexDirectionColumn || direction == YGFlexDirectionColumnReverse) && wrap == YGWrapWrapReverse;
  const double reflectionDelta = -20; // Physical L10/R30 content-box reflection, independent of writing direction.
  std::cout << ",{\"name\":\"position-absolute-percent-" << percentageInsetDirectionName(direction) << '-' << percentageInsetWrapName(wrap) << '-' << (writing == YGDirectionRTL ? "rtl" : "ltr") << '-' << profileName << (resized ? "-resized" : "") << "\",\"width\":" << width << ",\"height\":" << height << ",\"gap\":10,\"flexDirection\":\"" << percentageInsetDirectionName(direction) << "\",\"flexWrap\":\"" << percentageInsetWrapName(wrap) << "\",\"layoutDirection\":\"" << (writing == YGDirectionRTL ? "rtl" : "ltr") << "\",\"containerStyle\":{\"position\":\"relative\",\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":20},\"borderWidth\":2,\"alignItems\":\"flex-start\",\"alignContent\":\"flex-start\"},\"absolutePercentageInsetFixture\":true,\"boxes\":["; printBox(a); std::cout << ','; printBox(absolute); std::cout << ','; printBox(c); std::cout << ']';
  if (preservedReflection) {
    std::cout << ",\"classification\":\"preserved-content-box-reflection\",\"comparisonLabel\":\"Preserved Pibbl content-box wrap reflection moves flow leaves; physical percentage absolute insets still match Yoga.\",\"pibblBoxes\":[{\"x\":" << YGNodeLayoutGetLeft(a) + reflectionDelta << ",\"y\":" << YGNodeLayoutGetTop(a) << ",\"width\":" << YGNodeLayoutGetWidth(a) << ",\"height\":" << YGNodeLayoutGetHeight(a) << "},";
    printBox(absolute);
    std::cout << ",{\"x\":" << YGNodeLayoutGetLeft(c) + reflectionDelta << ",\"y\":" << YGNodeLayoutGetTop(c) << ",\"width\":" << YGNodeLayoutGetWidth(c) << ",\"height\":" << YGNodeLayoutGetHeight(c) << "}]";
  }
  std::cout << ",\"itemStyles\":[{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"position\":\"absolute\",";
  if (profile == 0) std::cout << "\"width\":50,\"height\":20,\"left\":\"10%\",\"top\":\"20%\"";
  else if (profile == 1) std::cout << "\"width\":50,\"height\":20,\"right\":\"10%\",\"bottom\":\"20%\"";
  else if (profile == 2) std::cout << "\"width\":\"auto\",\"height\":\"auto\",\"left\":\"10%\",\"right\":\"15%\",\"top\":\"10%\",\"bottom\":\"20%\"";
  else if (profile == 3) std::cout << "\"width\":80,\"height\":\"auto\",\"aspectRatio\":2,\"left\":\"10%\",\"top\":\"20%\"";
  else std::cout << "\"width\":50,\"height\":20,\"left\":\"-10%\",\"top\":\"120%\"";
  std::cout << ",\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"width\":50,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
  YGNodeFreeRecursive(root); YGConfigFree(config);
}
static void absolutePercentageInsetCases() {
  const YGFlexDirection directions[] = {YGFlexDirectionRow, YGFlexDirectionRowReverse, YGFlexDirectionColumn, YGFlexDirectionColumnReverse}; const YGWrap wraps[] = {YGWrapWrap, YGWrapWrapReverse};
  // The 32 anchor records prove every direction/wrap/writing combination. The
  // remaining six records prove existing sizing composition and resize behavior.
  for (const auto direction : directions) for (const auto wrap : wraps) for (int rtl = 0; rtl < 2; ++rtl) for (int profile = 0; profile < 2; ++profile) absolutePercentageInsetRecord(direction, wrap, rtl ? YGDirectionRTL : YGDirectionLTR, profile, false);
  absolutePercentageInsetRecord(YGFlexDirectionRow, YGWrapWrap, YGDirectionLTR, 2, false);
  absolutePercentageInsetRecord(YGFlexDirectionColumnReverse, YGWrapWrapReverse, YGDirectionRTL, 3, false);
  absolutePercentageInsetRecord(YGFlexDirectionRowReverse, YGWrapWrapReverse, YGDirectionRTL, 4, false);
  absolutePercentageInsetRecord(YGFlexDirectionRow, YGWrapWrap, YGDirectionLTR, 0, true);
  absolutePercentageInsetRecord(YGFlexDirectionColumnReverse, YGWrapWrapReverse, YGDirectionRTL, 1, true);
  absolutePercentageInsetRecord(YGFlexDirectionRow, YGWrapWrap, YGDirectionLTR, 2, true);
}

static const char* relativePercentageDirectionName(YGFlexDirection value) { return value == YGFlexDirectionRow ? "row" : value == YGFlexDirectionRowReverse ? "row-reverse" : value == YGFlexDirectionColumn ? "column" : "column-reverse"; }
static const char* relativePercentageWrapName(YGWrap value) { return value == YGWrapWrapReverse ? "wrap-reverse" : "wrap"; }
static void relativePercentageInsetRecord(YGFlexDirection direction, YGWrap wrap, YGDirection writing, int profile, bool resized) {
  const float width = resized ? 264 : 204, height = resized ? 154 : 104;
  auto config = YGConfigNew(); YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
  auto root = YGNodeNewWithConfig(config); YGNodeStyleSetPositionType(root, YGPositionTypeRelative); YGNodeStyleSetBoxSizing(root, YGBoxSizingBorderBox); YGNodeStyleSetWidth(root, width); YGNodeStyleSetHeight(root, height); YGNodeStyleSetFlexDirection(root, direction); YGNodeStyleSetFlexWrap(root, wrap); YGNodeStyleSetGap(root, YGGutterAll, 10); YGNodeStyleSetAlignItems(root, YGAlignFlexStart); YGNodeStyleSetAlignContent(root, YGAlignFlexStart); YGNodeStyleSetPadding(root, YGEdgeLeft, 10); YGNodeStyleSetPadding(root, YGEdgeRight, 30); YGNodeStyleSetPadding(root, YGEdgeTop, 20); YGNodeStyleSetPadding(root, YGEdgeBottom, 20); YGNodeStyleSetBorder(root, YGEdgeAll, 2);
  auto a = YGNodeNewWithConfig(config), b = YGNodeNewWithConfig(config), c = YGNodeNewWithConfig(config);
  for (auto child : {a,b,c}) { YGNodeStyleSetWidth(child, 60); YGNodeStyleSetHeight(child, 20); YGNodeStyleSetFlexGrow(child, 0); YGNodeStyleSetFlexShrink(child, 0); setMinZero(child); }
  if (profile == 0) { YGNodeStyleSetPositionType(b, YGPositionTypeStatic); YGNodeStyleSetPositionPercent(b,YGEdgeLeft,10); YGNodeStyleSetPositionPercent(b,YGEdgeRight,15); YGNodeStyleSetPositionPercent(b,YGEdgeTop,20); YGNodeStyleSetPositionPercent(b,YGEdgeBottom,10); }
  else { YGNodeStyleSetPositionType(b, YGPositionTypeRelative); if (profile == 1) { YGNodeStyleSetPositionPercent(b,YGEdgeLeft,10); YGNodeStyleSetPositionPercent(b,YGEdgeRight,15); YGNodeStyleSetPositionPercent(b,YGEdgeTop,20); YGNodeStyleSetPositionPercent(b,YGEdgeBottom,10); } else { YGNodeStyleSetPositionPercent(b,YGEdgeRight,15); YGNodeStyleSetPositionPercent(b,YGEdgeBottom,10); } }
  YGNodeInsertChild(root,a,0); YGNodeInsertChild(root,b,1); YGNodeInsertChild(root,c,2); YGNodeCalculateLayout(root,YGUndefined,YGUndefined,writing);
  const bool row = direction == YGFlexDirectionRow || direction == YGFlexDirectionRowReverse;
  const bool mainReverse = row ? ((direction == YGFlexDirectionRowReverse) != (writing == YGDirectionRTL)) : direction == YGFlexDirectionColumnReverse;
  const bool crossReverse = wrap == YGWrapWrapReverse;
  const float contentX = 12, contentY = 22, contentWidth = width - 44, contentHeight = height - 44;
  const bool wraps = row ? contentWidth < 200 : contentHeight < 80;
  float xs[3], ys[3];
  for (int index=0; index<3; ++index) {
    const int line = wraps ? index / 2 : 0, within = wraps ? index % 2 : index;
    if (row) {
      const float mainOrigin = mainReverse ? contentX + contentWidth - 60 : contentX;
      xs[index] = mainOrigin + (mainReverse ? -70 * within : 70 * within);
      const float crossOrigin = crossReverse ? contentY + contentHeight - 20 : contentY;
      ys[index] = crossOrigin + (crossReverse ? -30 * line : 30 * line);
    } else {
      const float mainOrigin = mainReverse ? contentY + contentHeight - 20 : contentY;
      ys[index] = mainOrigin + (mainReverse ? -30 * within : 30 * within);
      const bool ltr = writing != YGDirectionRTL;
      const bool crossPhysicalReverse = crossReverse != !ltr;
      const float crossOrigin = crossPhysicalReverse ? contentX + contentWidth - 60 : contentX;
      xs[index] = crossOrigin + (crossPhysicalReverse ? -70 * line : 70 * line);
    }
  }
  if (profile == 1) { xs[1] += writing == YGDirectionRTL ? -contentWidth * .15f : contentWidth * .10f; ys[1] += contentHeight * .20f; }
  else if (profile == 2) { xs[1] -= contentWidth * .15f; ys[1] -= contentHeight * .10f; }
  const char* profileName = profile == 0 ? "static" : profile == 1 ? "relative-leading" : "relative-trailing";
  std::cout << ",{\"name\":\"position-relative-percent-" << relativePercentageDirectionName(direction) << '-' << relativePercentageWrapName(wrap) << '-' << (writing == YGDirectionRTL ? "rtl" : "ltr") << '-' << profileName << (resized ? "-resized" : "") << "\",\"width\":" << width << ",\"height\":" << height << ",\"gap\":10,\"flexDirection\":\"" << relativePercentageDirectionName(direction) << "\",\"flexWrap\":\"" << relativePercentageWrapName(wrap) << "\",\"layoutDirection\":\"" << (writing == YGDirectionRTL ? "rtl" : "ltr") << "\",\"containerStyle\":{\"position\":\"relative\",\"boxSizing\":\"border-box\",\"padding\":{\"left\":10,\"right\":30,\"top\":20,\"bottom\":20},\"borderWidth\":2,\"alignItems\":\"flex-start\",\"alignContent\":\"flex-start\"},\"relativePercentageInsetFixture\":true,\"boxes\":["; printBox(a); std::cout << ','; printBox(b); std::cout << ','; printBox(c); std::cout << ']';
  const bool differs = YGNodeLayoutGetLeft(a) != xs[0] || YGNodeLayoutGetTop(a) != ys[0] || YGNodeLayoutGetLeft(b) != xs[1] || YGNodeLayoutGetTop(b) != ys[1] || YGNodeLayoutGetLeft(c) != xs[2] || YGNodeLayoutGetTop(c) != ys[2];
  if (differs) std::cout << ",\"classification\":\"pibbl-physical-relative-percent\",\"comparisonLabel\":\"Pibbl keeps static percentage insets inert and translates relative leaves from physical content-box flow slots; pinned Yoga differs for this direction/wrap profile.\",\"pibblBoxes\":[{\"x\":" << xs[0] << ",\"y\":" << ys[0] << ",\"width\":60,\"height\":20},{\"x\":" << xs[1] << ",\"y\":" << ys[1] << ",\"width\":60,\"height\":20},{\"x\":" << xs[2] << ",\"y\":" << ys[2] << ",\"width\":60,\"height\":20}]";
  std::cout << ",\"itemStyles\":[{\"width\":60,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0},{\"width\":60,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0,\"position\":\"" << (profile == 0 ? "static" : "relative") << "\",";
  if (profile == 0 || profile == 1) std::cout << "\"left\":\"10%\",\"right\":\"15%\",\"top\":\"20%\",\"bottom\":\"10%\""; else std::cout << "\"right\":\"15%\",\"bottom\":\"10%\"";
  std::cout << "},{\"width\":60,\"height\":20,\"flexGrow\":0,\"flexShrink\":0,\"minWidth\":0,\"minHeight\":0}]}";
  YGNodeFreeRecursive(root); YGConfigFree(config);
}
static void relativePercentageInsetCases() { const YGFlexDirection directions[] = {YGFlexDirectionRow,YGFlexDirectionRowReverse,YGFlexDirectionColumn,YGFlexDirectionColumnReverse}; const YGWrap wraps[] = {YGWrapWrap,YGWrapWrapReverse}; for (auto direction:directions) for (auto wrap:wraps) for (int rtl=0;rtl<2;++rtl) for (int profile=0;profile<3;++profile) relativePercentageInsetRecord(direction,wrap,rtl?YGDirectionRTL:YGDirectionLTR,profile,false); relativePercentageInsetRecord(YGFlexDirectionRow,YGWrapWrap,YGDirectionLTR,1,true); relativePercentageInsetRecord(YGFlexDirectionColumnReverse,YGWrapWrapReverse,YGDirectionRTL,2,true); }

int main() {
  const char* names[] = {"grow", "cap", "shrink", "rectangle-shrink", "rectangle-percent-content-box", "column-grow", "column-cap", "column-shrink", "row-reverse-cap", "column-reverse-cap", "row-wrap", "row-wrap-reverse", "border-box-floor-bounds", "border-box-percentage", "border-box-asymmetric-row", "border-box-asymmetric-column", "zero-fractional-grow", "fractional-shrink", "grow-freeze-release", "shrink-freeze-release", "large-finite-differential", "subunit-zero-grow", "subunit-shrink-policy", "initial-freeze-grow-policy", "initial-freeze-shrink-policy"};
  std::cout << "[";
  for (int i = 0; i < 25; i++) {
    auto config = YGConfigNew();
    YGConfigSetUseWebDefaults(config, false);
    YGConfigSetPointScaleFactor(config, 0);
    YGConfigSetErrata(config, YGErrataNone);
    const bool column = (i >= 5 && i <= 7) || i == 9 || i == 15;
    const bool reverse = i == 8 || i == 9;
    const bool wrapped = i == 10 || i == 11;
    const bool boxed = i >= 12 && i <= 15;
    const int count = wrapped ? 3 : 2;
    const auto width = i >= 16 ? (i == 18 || i == 20 ? 312 : 112) : i == 14 ? 200 : i == 12 ? 160 : i == 13 ? 200 : wrapped ? 150 : column ? 100 : i == 2 ? 220 : i == 3 ? 100 : i == 4 ? 200 : 300;
    const auto height = i == 15 ? 160 : i == 12 ? 80 : 100;
    const auto gap = i >= 16 ? 12 : i == 13 ? 0 : i < 3 || column || reverse || wrapped || boxed ? 12 : 0;
    auto root = YGNodeNewWithConfig(config);
    YGNodeStyleSetWidth(root, width);
    YGNodeStyleSetHeight(root, height);
    YGNodeStyleSetFlexDirection(root, column ? (reverse ? YGFlexDirectionColumnReverse : YGFlexDirectionColumn) : (reverse ? YGFlexDirectionRowReverse : YGFlexDirectionRow));
    YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
    YGNodeStyleSetAlignContent(root, YGAlignFlexStart);
    YGNodeStyleSetFlexWrap(root, i == 11 ? YGWrapWrapReverse : wrapped ? YGWrapWrap : YGWrapNoWrap);
    YGNodeStyleSetGap(root, YGGutterAll, gap);
    for (int j = 0; j < count; j++) {
      auto child = YGNodeNewWithConfig(config);
      YGNodeStyleSetFlexShrink(child, 1);
      if (i >= 16) {
        const auto style = numericStyle(i,j);
        YGNodeStyleSetWidth(child, style.basis); YGNodeStyleSetFlexBasis(child, style.basis);
        YGNodeStyleSetFlexGrow(child, style.grow); YGNodeStyleSetFlexShrink(child, style.shrink);
        YGNodeStyleSetMinWidth(child, style.minimum); YGNodeStyleSetMaxWidth(child, style.maximum);
      } else if (i >= 14) {
        YGNodeStyleSetBoxSizing(child, YGBoxSizingBorderBox);
        YGNodeStyleSetPadding(child, YGEdgeLeft, 3); YGNodeStyleSetPadding(child, YGEdgeRight, 5);
        YGNodeStyleSetPadding(child, YGEdgeTop, 7); YGNodeStyleSetPadding(child, YGEdgeBottom, 11);
        YGNodeStyleSetBorder(child, YGEdgeLeft, 2); YGNodeStyleSetBorder(child, YGEdgeRight, 4);
        YGNodeStyleSetBorder(child, YGEdgeTop, 6); YGNodeStyleSetBorder(child, YGEdgeBottom, 8);
        YGNodeStyleSetFlexGrow(child, 0); YGNodeStyleSetFlexShrink(child, 0);
        YGNodeStyleSetFlexBasis(child, column ? 62 : 54);
        if (column) YGNodeStyleSetWidth(child, 54);
      } else if (boxed) {
        YGNodeStyleSetBoxSizing(child, YGBoxSizingBorderBox);
        YGNodeStyleSetPadding(child, YGEdgeAll, 10);
        YGNodeStyleSetFlexGrow(child, 0);
        YGNodeStyleSetMinWidth(child, 0);
        if (i == 12) {
          YGNodeStyleSetFlexShrink(child, 0);
          YGNodeStyleSetFlexBasis(child, j == 0 ? 8 : 80);
          YGNodeStyleSetMaxWidth(child, j == 0 ? 8 : 110);
          if (j == 1) YGNodeStyleSetMinWidth(child, 100);
        } else {
          YGNodeStyleSetFlexBasisPercent(child, 70);
          if (j == 0) { YGNodeStyleSetMinWidth(child, 110); YGNodeStyleSetMaxWidthPercent(child, 60); }
        }
      } else if (wrapped) {
        YGNodeStyleSetWidth(child, 60);
        YGNodeStyleSetFlexBasis(child, 60);
        YGNodeStyleSetFlexGrow(child, 0);
        YGNodeStyleSetMinWidth(child, 0);
      } else if (column) {
        YGNodeStyleSetWidth(child, 80);
        YGNodeStyleSetFlexBasis(child, i == 7 ? 80 : 20);
        YGNodeStyleSetFlexGrow(child, i == 7 ? 0 : 1);
        YGNodeStyleSetMinHeight(child, i == 7 && j == 0 ? 60 : 0);
        if ((i == 6 || i == 9) && j == 0) YGNodeStyleSetMaxHeight(child, 30);
      } else if (i < 3 || i == 8) {
        YGNodeStyleSetFlexBasis(child, i == 2 ? 180 : 60);
        YGNodeStyleSetFlexGrow(child, i == 2 ? 0 : 1);
        YGNodeStyleSetMinWidth(child, i == 2 && j == 0 ? 120 : 0);
        if ((i == 1 || i == 8) && j == 0) YGNodeStyleSetMaxWidth(child, 80);
      } else {
        YGNodeStyleSetWidth(child, 80);
        if (i == 4) {
          YGNodeStyleSetBoxSizing(child, YGBoxSizingContentBox);
          YGNodeStyleSetFlexBasisPercent(child, 70);
          YGNodeStyleSetPadding(child, YGEdgeAll, 10);
          if (j == 0) YGNodeStyleSetMinWidth(child, 90);
        }
      }
      if (i == 15) {}
      else if (i == 14) YGNodeStyleSetHeight(child, 62);
      else if (i == 13) YGNodeStyleSetHeightPercent(child, 60);
      else YGNodeStyleSetHeight(child, boxed ? 60 : wrapped ? 20 : 80);
      YGNodeInsertChild(root, child, j);
    }
    YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionLTR);
    if (i) std::cout << ",";
    std::cout << "{\"name\":\"" << names[i] << "\",\"width\":" << width << ",\"height\":" << height << ",\"gap\":" << gap << ",\"flexDirection\":\"" << (column ? (reverse ? "column-reverse" : "column") : (reverse ? "row-reverse" : "row")) << "\",\"flexWrap\":\"" << (i == 11 ? "wrap-reverse" : wrapped ? "wrap" : "nowrap") << "\",\"boxes\":[";
    for (int j = 0; j < count; j++) {
      auto child = YGNodeGetChild(root, j);
      if (j) std::cout << ",";
      std::cout << "{\"x\":" << YGNodeLayoutGetLeft(child) << ",\"y\":" << YGNodeLayoutGetTop(child) << ",\"width\":" << YGNodeLayoutGetWidth(child) << ",\"height\":" << YGNodeLayoutGetHeight(child) << "}";
    }
    std::cout << "]";
    if (i >= 16) {
      std::cout << ",\"itemStyles\":[";
      for (int j = 0; j < 2; j++) {
        const auto style = numericStyle(i,j);
        if (j) std::cout << ",";
        std::cout << "{\"width\":" << style.basis << ",\"height\":80,\"flexBasis\":" << style.basis << ",\"flexGrow\":" << style.grow << ",\"flexShrink\":" << style.shrink << ",\"minWidth\":" << style.minimum << ",\"maxWidth\":" << style.maximum << "}";
      }
      std::cout << "]";
    }
    if (i == 22) std::cout << ",\"classification\":\"preserved-css-partial-shrink\",\"pibblBoxes\":[{\"x\":0,\"y\":0,\"width\":65,\"height\":80},{\"x\":77,\"y\":0,\"width\":65,\"height\":80}]";
    if (i == 22) std::cout << ",\"comparisonLabel\":\"CSS partial shrink: Yoga50/50 vs Pibbl65/65\"";
    if (i == 23) std::cout << ",\"classification\":\"css-initial-freeze-grow\",\"comparisonLabel\":\"CSS freeze grow: Yoga43.3333 vs Pibbl37.5\",\"pibblBoxes\":[{\"x\":0,\"y\":0,\"width\":10,\"height\":80},{\"x\":22,\"y\":0,\"width\":37.5,\"height\":80}]";
    if (i == 24) std::cout << ",\"classification\":\"css-initial-freeze-shrink\",\"comparisonLabel\":\"CSS freeze shrink: Yoga10 vs Pibbl62.5\",\"pibblBoxes\":[{\"x\":0,\"y\":0,\"width\":90,\"height\":80},{\"x\":102,\"y\":0,\"width\":62.5,\"height\":80}]";
    std::cout << "}";
    YGNodeFreeRecursive(root); YGConfigFree(config);
  }
  distributionCases();
  percentageBoundsCases();
  wrappedAspectCases();
  percentageGapCases();
  percentagePaddingCases();
  wrappedCrossPercentageCases();
  percentageMarginCases();
  wrappedPercentageMarginCases();
  wrappedReversePercentageMarginCases();
  nestedPercentageGapCases();
  layoutDirectionCases();
  logicalMarginCases();
  logicalPaddingCases();
  logicalBorderCases();
  intrinsicRowWrapAutoHeightCases();
  directionMatrixCases();
  directionIsolationCases();
  autoMarginCases();
  autoMainDirectionCases();
  autoWrappedMarginCases();
  autoCrossMarginCases();
  autoCrossDirectionCases();
  autoShorthandMarginCases();
  autoOpposingMarginCases();
  textCrossAutoCases();
  customCrossAutoCases();
  ownerCrossAutoCases();
  roundingCases();
  nestedCrossMinimumCases();
  nestedCrossMinimumDecoratedReverseCases();
  nestedCrossMaximumDecoratedReverseCases();
  nestedCrossMaximumDecoratedColumnReverseCases();
  nestedCrossMinimumDecoratedColumnReverseCases();
  customColumnMeasureCases();
  relativeStaticCases();
  decoratedRelativeStaticCases();
  absoluteParticipationCases();
  absoluteAlignmentCases();
  absoluteDerivedSizeCases();
  nestedContainingBlockCases();
  absoluteBoundsCases();
  absoluteAspectCases();
  absoluteMeasuredWidthCases();
  absoluteMeasuredHeightCases();
  absoluteMainDirectionCases();
  relativeMainDirectionCases();
  absoluteMainBoundsCases();
  absoluteMainAspectCases();
  absoluteMeasuredMainCases();
  nestedContainingBlockDirectionCases();
  absoluteWrapCases();
  absoluteTextHeightCases();
  absoluteTextWidthCases();
  absoluteTextBothCases();
  absoluteAnchoredWrapCases();
  relativeWrappedDirectionCases();
  absoluteWrappedAlignmentCases();
  absolutePercentageInsetCases();
  relativePercentageInsetCases();
  std::cout << "]\n";
}
