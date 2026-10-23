// Pibbl-authored policy probe against separately supplied MIT-licensed Yoga source.
// This is not part of the generated comparison corpus.
#include <yoga/Yoga.h>

#include <cmath>
#include <cstdlib>
#include <iostream>

namespace {

enum class OwnerMode { Exact, MaximumOnly, Unbounded };
enum class BoundMode { Cap, Floor };

struct Result {
  float owner;
  float first;
  float second;
};

const char* ownerName(OwnerMode mode) {
  switch (mode) {
    case OwnerMode::Exact: return "exact-160";
    case OwnerMode::MaximumOnly: return "max-only-160";
    case OwnerMode::Unbounded: return "unbounded";
  }
  std::abort();
}

const char* boundName(BoundMode mode) {
  return mode == BoundMode::Cap ? "cap-25" : "floor-50";
}

Result run(OwnerMode ownerMode, BoundMode boundMode) {
  auto config = YGConfigNew();
  YGConfigSetUseWebDefaults(config, false);
  YGConfigSetPointScaleFactor(config, 0);
  YGConfigSetErrata(config, YGErrataNone);

  auto root = YGNodeNewWithConfig(config);
  YGNodeStyleSetFlexDirection(root, YGFlexDirectionRow);
  YGNodeStyleSetAlignItems(root, YGAlignFlexStart);
  if (ownerMode == OwnerMode::Exact) {
    YGNodeStyleSetWidth(root, 160);
  } else if (ownerMode == OwnerMode::MaximumOnly) {
    YGNodeStyleSetMaxWidth(root, 160);
  }

  auto first = YGNodeNewWithConfig(config);
  YGNodeStyleSetHeight(first, 20);
  YGNodeStyleSetFlexGrow(first, 0);
  YGNodeStyleSetFlexShrink(first, 0);
  if (boundMode == BoundMode::Cap) {
    // Explicit zero prevents a default/inherited minimum from obscuring the cap.
    YGNodeStyleSetWidth(first, 80);
    YGNodeStyleSetFlexBasis(first, 80);
    YGNodeStyleSetMinWidth(first, 0);
    YGNodeStyleSetMaxWidthPercent(first, 25);
  } else {
    YGNodeStyleSetWidth(first, 20);
    YGNodeStyleSetFlexBasis(first, 20);
    YGNodeStyleSetMinWidthPercent(first, 50);
  }

  auto second = YGNodeNewWithConfig(config);
  YGNodeStyleSetWidth(second, 80);
  YGNodeStyleSetHeight(second, 20);
  YGNodeStyleSetFlexBasis(second, 80);
  YGNodeStyleSetFlexGrow(second, 0);
  YGNodeStyleSetFlexShrink(second, 0);
  YGNodeStyleSetMinWidth(second, 0);

  YGNodeInsertChild(root, first, 0);
  YGNodeInsertChild(root, second, 1);
  YGNodeCalculateLayout(root, YGUndefined, YGUndefined, YGDirectionLTR);
  const Result result{
    YGNodeLayoutGetWidth(root),
    YGNodeLayoutGetWidth(first),
    YGNodeLayoutGetWidth(second),
  };
  YGNodeFreeRecursive(root);
  YGConfigFree(config);
  return result;
}

bool same(Result left, Result right) {
  return left.owner == right.owner && left.first == right.first &&
      left.second == right.second;
}

} // namespace

int main() {
  for (const auto ownerMode : {OwnerMode::Exact, OwnerMode::MaximumOnly,
                               OwnerMode::Unbounded}) {
    for (const auto boundMode : {BoundMode::Cap, BoundMode::Floor}) {
      const auto first = run(ownerMode, boundMode);
      const auto repeated = run(ownerMode, boundMode);
      if (!same(first, repeated)) {
        std::cerr << "fresh Yoga configurations disagreed for "
                  << ownerName(ownerMode) << '/' << boundName(boundMode)
                  << '\n';
        return 1;
      }
      std::cout << ownerName(ownerMode) << '/' << boundName(boundMode)
                << " root=" << first.owner << " first=" << first.first
                << " second=" << first.second << '\n';
    }
  }
}
