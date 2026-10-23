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
  std::cout << "]\n";
}
