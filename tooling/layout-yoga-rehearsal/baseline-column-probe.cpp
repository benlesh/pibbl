// Pinned Yoga 3.2.1 diagnostic only. This does not enter Pibbl's corpus.
#include <yoga/Yoga.h>
#include <iostream>

struct Box { float left; float top; };
struct Result { int calls; Box a; Box b; };
static int baselineCalls = 0;
static float baseline(YGNodeConstRef node, float, float) {
  ++baselineCalls;
  return YGNodeGetContext(node) == reinterpret_cast<void*>(1) ? 5.0f : 30.0f;
}
static Result run(YGFlexDirection direction, YGWrap wrap, YGDirection writing, YGAlign align) {
  baselineCalls = 0;
  YGNodeRef root = YGNodeNew(); YGNodeRef a = YGNodeNew(); YGNodeRef b = YGNodeNew();
  YGNodeStyleSetWidth(root, 100); YGNodeStyleSetHeight(root, 100);
  YGNodeStyleSetFlexDirection(root, direction); YGNodeStyleSetFlexWrap(root, wrap);
  YGNodeStyleSetAlignItems(root, align);
  YGNodeStyleSetWidth(a, 40); YGNodeStyleSetHeight(a, wrap == YGWrapNoWrap ? 20 : 60);
  YGNodeStyleSetWidth(b, 60); YGNodeStyleSetHeight(b, wrap == YGWrapNoWrap ? 40 : 60);
  YGNodeSetContext(a, reinterpret_cast<void*>(1)); YGNodeSetBaselineFunc(a, baseline);
  YGNodeSetBaselineFunc(b, baseline);
  YGNodeInsertChild(root, a, 0); YGNodeInsertChild(root, b, 1);
  YGNodeCalculateLayout(root, YGUndefined, YGUndefined, writing);
  Result result{baselineCalls,
    {YGNodeLayoutGetLeft(a), YGNodeLayoutGetTop(a)},
    {YGNodeLayoutGetLeft(b), YGNodeLayoutGetTop(b)}};
  YGNodeFreeRecursive(root);
  return result;
}
static bool same(const Result& left, const Result& right) {
  return left.a.left == right.a.left && left.a.top == right.a.top &&
    left.b.left == right.b.left && left.b.top == right.b.top;
}
static void report(const char* name, YGFlexDirection direction, YGWrap wrap, YGDirection writing) {
  const Result baseline = run(direction, wrap, writing, YGAlignBaseline);
  const Result start = run(direction, wrap, writing, YGAlignFlexStart);
  std::cout << name << " baseline-calls=" << baseline.calls
    << " baseline-A=" << baseline.a.left << ',' << baseline.a.top
    << " baseline-B=" << baseline.b.left << ',' << baseline.b.top
    << " flex-start-A=" << start.a.left << ',' << start.a.top
    << " flex-start-B=" << start.b.left << ',' << start.b.top
    << " boxes-equal=" << (same(baseline, start) ? "true" : "false") << '\n';
}
int main() {
  report("column-ltr-nowrap", YGFlexDirectionColumn, YGWrapNoWrap, YGDirectionLTR);
  report("column-rtl-nowrap", YGFlexDirectionColumn, YGWrapNoWrap, YGDirectionRTL);
  report("column-reverse-ltr-nowrap", YGFlexDirectionColumnReverse, YGWrapNoWrap, YGDirectionLTR);
  report("column-reverse-rtl-nowrap", YGFlexDirectionColumnReverse, YGWrapNoWrap, YGDirectionRTL);
  report("column-ltr-wrap", YGFlexDirectionColumn, YGWrapWrap, YGDirectionLTR);
  report("column-ltr-wrap-reverse", YGFlexDirectionColumn, YGWrapWrapReverse, YGDirectionLTR);
  report("column-rtl-wrap", YGFlexDirectionColumn, YGWrapWrap, YGDirectionRTL);
  report("column-rtl-wrap-reverse", YGFlexDirectionColumn, YGWrapWrapReverse, YGDirectionRTL);
  report("column-reverse-ltr-wrap", YGFlexDirectionColumnReverse, YGWrapWrap, YGDirectionLTR);
  report("column-reverse-ltr-wrap-reverse", YGFlexDirectionColumnReverse, YGWrapWrapReverse, YGDirectionLTR);
  report("column-reverse-rtl-wrap", YGFlexDirectionColumnReverse, YGWrapWrap, YGDirectionRTL);
  report("column-reverse-rtl-wrap-reverse", YGFlexDirectionColumnReverse, YGWrapWrapReverse, YGDirectionRTL);
}
