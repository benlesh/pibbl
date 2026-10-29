// Pinned Yoga 3.2.1 reference-baseline characterization only.
#include <yoga/Yoga.h>
#include <iostream>
#include <cstdint>

static int aCalls = 0, rCalls = 0, pCalls = 0;
static float baseline(YGNodeConstRef node, float, float) {
  const auto tag = reinterpret_cast<uintptr_t>(YGNodeGetContext(node));
  if (tag == 1) { ++aCalls; return 5.0f; }
  if (tag == 2) { ++rCalls; return 25.0f; }
  ++pCalls; return 30.0f;
}
static void leaf(YGNodeRef node, uintptr_t tag, float width, float height) {
  YGNodeSetContext(node, reinterpret_cast<void*>(tag));
  YGNodeSetBaselineFunc(node, baseline);
  YGNodeStyleSetWidth(node, width); YGNodeStyleSetHeight(node, height);
}
static void run(const char* name, bool reference) {
  aCalls = rCalls = pCalls = 0;
  const auto config = YGConfigNew();
  YGConfigSetUseWebDefaults(config, false); YGConfigSetPointScaleFactor(config, 0); YGConfigSetErrata(config, YGErrataNone);
  const YGNodeRef outer = YGNodeNewWithConfig(config), inner = YGNodeNewWithConfig(config), a = YGNodeNewWithConfig(config), r = YGNodeNewWithConfig(config), p = YGNodeNewWithConfig(config);
  YGNodeStyleSetWidth(outer, 200); YGNodeStyleSetHeight(outer, 100);
  YGNodeStyleSetFlexDirection(outer, YGFlexDirectionRow); YGNodeStyleSetAlignItems(outer, YGAlignBaseline);
  YGNodeStyleSetWidth(inner, 80); YGNodeStyleSetHeight(inner, 40); YGNodeStyleSetFlexDirection(inner, YGFlexDirectionRow); YGNodeStyleSetAlignItems(inner, YGAlignFlexStart);
  leaf(a, 1, 40, 20); leaf(r, 2, 40, 30); leaf(p, 3, 40, 40);
  YGNodeSetIsReferenceBaseline(r, reference);
  YGNodeInsertChild(inner, a, 0); YGNodeInsertChild(inner, r, 1);
  YGNodeInsertChild(outer, inner, 0); YGNodeInsertChild(outer, p, 1);
  YGNodeCalculateLayout(outer, YGUndefined, YGUndefined, YGDirectionLTR);
  std::cout << name << " reference=" << (reference ? "true" : "false")
    << " inner=" << YGNodeLayoutGetLeft(inner) << ',' << YGNodeLayoutGetTop(inner)
    << " A=" << YGNodeLayoutGetLeft(a) << ',' << YGNodeLayoutGetTop(a)
    << " R=" << YGNodeLayoutGetLeft(r) << ',' << YGNodeLayoutGetTop(r)
    << " P=" << YGNodeLayoutGetLeft(p) << ',' << YGNodeLayoutGetTop(p)
    << " calls=A:" << aCalls << ",R:" << rCalls << ",P:" << pCalls << '\n';
  YGNodeFreeRecursive(outer); YGConfigFree(config);
}
int main() {
  run("default-source-order", false);
  run("reference-overrides-source-order", true);
}
