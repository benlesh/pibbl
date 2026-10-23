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
  std::cout << "]\n";
}
