import { beforeAll, expect, it, vi } from "vitest";
import {
  createElement,
  definePrimitive,
  Flex,
  measureElement,
  type Length,
  type SystemStyle,
} from "@pibbl/core";
import { nativeLayout } from "../src/lib/layout/wasm/region";
import { prepareLayoutEngineSync } from "../src/lib/layout/wasm/embedded";

const service = {
  measureText: (value: string) => ({ width: value.length * 10 }) as TextMetrics,
};
beforeAll(() => {
  if (nativeLayout) prepareLayoutEngineSync();
});

interface ExactColumnStyle extends SystemStyle {
  width?: Length;
  height?: Length;
  minWidth?: Exclude<Length, "auto">;
  minHeight?: Exclude<Length, "auto">;
  maxHeight?: Exclude<Length, "auto">;
  flexBasis?: number;
  flexGrow?: number;
  flexShrink?: number;
}

function exactColumnChild(
  Direct: ReturnType<
    typeof definePrimitive<{}, ExactColumnStyle, ExactColumnStyle, SystemStyle>
  >,
  bounds: Pick<ExactColumnStyle, "minHeight" | "maxHeight"> = {
    minHeight: "50%",
    maxHeight: "75%",
  },
) {
  return createElement(Direct, {
    style: {
      width: 20,
      height: 100,
      minWidth: 0,
      ...bounds,
      flexBasis: 100,
      flexGrow: 0,
      flexShrink: 0,
    },
  });
}

it.runIf(nativeLayout)(
  "uses only an exact finite column constraint to resolve child percentage main bounds during Flex measurement",
  () => {
    const measure = vi.fn(() => ({
      status: "measured" as const,
      size: { width: 999, height: 999 },
    }));
    const Direct = definePrimitive<
      {},
      ExactColumnStyle,
      ExactColumnStyle,
      SystemStyle
    >(() => undefined, { resolveStyle: () => ({}), measure });
    const flex = createElement(Flex, {
      style: { flexDirection: "column", flexWrap: "nowrap" },
      children: [exactColumnChild(Direct)],
    });
    const exact = {
      minWidth: 0,
      maxWidth: Number.POSITIVE_INFINITY,
      minHeight: 160,
      maxHeight: 160,
    };
    expect(measureElement(flex, exact, service)).toEqual({
      status: "measured",
      size: { width: 20, height: 160 },
    });
    expect(measure).not.toHaveBeenCalled();

    for (const constraints of [
      {
        minWidth: 0,
        maxWidth: Number.POSITIVE_INFINITY,
        minHeight: 0,
        maxHeight: 160,
      },
      {
        minWidth: 0,
        maxWidth: Number.POSITIVE_INFINITY,
        minHeight: 0,
        maxHeight: Number.POSITIVE_INFINITY,
      },
    ]) {
      expect(measureElement(flex, constraints, service)).toEqual({
        status: "unsupported",
        reason: expect.stringMatching(/exact finite column height/i),
      });
    }
    expect(measure).not.toHaveBeenCalled();

    const contradictory = createElement(Flex, {
      style: { flexDirection: "column", flexWrap: "nowrap" },
      children: [
        exactColumnChild(Direct, { minHeight: "70%", maxHeight: "25%" }),
      ],
    });
    expect(() => measureElement(contradictory, exact, service)).toThrow(
      /minimum must not exceed maximum/i,
    );
  },
);

it.runIf(nativeLayout)(
  "treats an exact zero column height as a definite percentage basis",
  () => {
    const measure = vi.fn(() => ({
      status: "measured" as const,
      size: { width: 999, height: 999 },
    }));
    const Direct = definePrimitive<
      {},
      ExactColumnStyle,
      ExactColumnStyle,
      SystemStyle
    >(() => undefined, { resolveStyle: () => ({}), measure });
    const flex = createElement(Flex, {
      style: { flexDirection: "column", flexWrap: "nowrap" },
      children: [exactColumnChild(Direct)],
    });
    expect(
      measureElement(
        flex,
        {
          minWidth: 0,
          maxWidth: Number.POSITIVE_INFINITY,
          minHeight: 0,
          maxHeight: 0,
        },
        service,
      ),
    ).toEqual({ status: "measured", size: { width: 20, height: 0 } });
    expect(measure).not.toHaveBeenCalled();
  },
);
