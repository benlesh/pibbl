import { beforeAll, expect, it, vi } from "vitest";
import {
  createElement,
  definePrimitive,
  Flex,
  measureElement,
  type Length,
  type SystemStyle,
} from "@pibbl/core";
import { experimentalLayout } from "../src/lib/layout/wasm/region";
import { prepareLayoutEngineSync } from "../src/lib/layout/wasm/embedded";

const service = {
  measureText: (value: string) => ({ width: value.length * 10 }) as TextMetrics,
};
beforeAll(() => {
  if (experimentalLayout) prepareLayoutEngineSync();
});

it.runIf(experimentalLayout)(
  "uses only an exact finite row constraint to resolve child percentage bounds during Flex measurement",
  () => {
    interface ExactStyle extends SystemStyle {
      width?: Length;
      height?: Length;
      minWidth?: Exclude<Length, "auto">;
      maxWidth?: Exclude<Length, "auto">;
      minHeight?: Exclude<Length, "auto">;
      flexBasis?: number;
      flexGrow?: number;
      flexShrink?: number;
    }
    const measure = vi.fn(() => ({
      status: "measured" as const,
      size: { width: 999, height: 999 },
    }));
    const Direct = definePrimitive<{}, ExactStyle, ExactStyle, SystemStyle>(
      () => undefined,
      { resolveStyle: () => ({}), measure },
    );
    const child = createElement(Direct, {
      style: {
        width: 100,
        height: 20,
        minWidth: "50%",
        maxWidth: "75%",
        minHeight: 0,
        flexBasis: 100,
        flexGrow: 0,
        flexShrink: 0,
      },
    });
    const flex = createElement(Flex, {
      style: { flexDirection: "row", flexWrap: "nowrap" },
      children: [child],
    });
    const exact = {
      minWidth: 160,
      maxWidth: 160,
      minHeight: 0,
      maxHeight: Number.POSITIVE_INFINITY,
    };
    expect(measureElement(flex, exact, service)).toEqual({
      status: "measured",
      size: { width: 160, height: 20 },
    });
    expect(measure).not.toHaveBeenCalled();

    for (const constraints of [
      {
        minWidth: 0,
        maxWidth: 160,
        minHeight: 0,
        maxHeight: Number.POSITIVE_INFINITY,
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
        reason: expect.stringMatching(/exact finite row width/i),
      });
    }
    expect(measure).not.toHaveBeenCalled();

    const contradictory = createElement(Flex, {
      style: { flexDirection: "row", flexWrap: "nowrap" },
      children: [
        createElement(Direct, {
          style: {
            width: 100,
            height: 20,
            minWidth: "70%",
            maxWidth: "25%",
            minHeight: 0,
            flexBasis: 100,
            flexGrow: 0,
            flexShrink: 0,
          },
        }),
      ],
    });
    expect(() => measureElement(contradictory, exact, service)).toThrow(
      /minimum must not exceed maximum/i,
    );
  },
);

it.runIf(experimentalLayout)(
  "treats an exact zero row width as a definite percentage basis",
  () => {
    interface ExactStyle extends SystemStyle {
      width?: Length;
      height?: Length;
      minWidth?: Exclude<Length, "auto">;
      maxWidth?: Exclude<Length, "auto">;
      minHeight?: Exclude<Length, "auto">;
      flexBasis?: number;
      flexGrow?: number;
      flexShrink?: number;
    }
    const measure = vi.fn(() => ({
      status: "measured" as const,
      size: { width: 999, height: 999 },
    }));
    const Direct = definePrimitive<{}, ExactStyle, ExactStyle, SystemStyle>(
      () => undefined,
      { resolveStyle: () => ({}), measure },
    );
    const flex = createElement(Flex, {
      style: { flexDirection: "row", flexWrap: "nowrap" },
      children: [
        createElement(Direct, {
          style: {
            width: 100,
            height: 20,
            minWidth: "50%",
            maxWidth: "75%",
            minHeight: 0,
            flexBasis: 100,
            flexGrow: 0,
            flexShrink: 0,
          },
        }),
      ],
    });
    expect(
      measureElement(
        flex,
        {
          minWidth: 0,
          maxWidth: 0,
          minHeight: 0,
          maxHeight: Number.POSITIVE_INFINITY,
        },
        service,
      ),
    ).toEqual({ status: "measured", size: { width: 0, height: 20 } });
    expect(measure).not.toHaveBeenCalled();
  },
);
