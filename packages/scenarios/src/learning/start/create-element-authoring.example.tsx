import {
  FocusManagement,
  Fragment,
  KeyboardNavigation,
  crc,
  createElement,
  useSignal,
  useReaction,
  Group,
  Rectangle,
  Text,
  type CRCController,
} from "@crc/core";

let liveLifecycleGenerations = 0;

function CreateElementPoster(_props: Record<never, never>) {
  const count = useSignal(0);
  const selection = useSignal("NONE");

  useReaction(() => {
    liveLifecycleGenerations += 1;
    return () => {
      liveLifecycleGenerations -= 1;
    };
  }, []);

  const choices = (count.get() === 0 ? ["A", "B"] : ["A", "B", "C"]).map(
    (label, index) =>
      createElement(
        Fragment,
        { key: label, children: null },
        createElement(Rectangle, {
          style: {
            x: 154 + index * 142,
            y: 208,
            width: 88,
            height: 60,
            fill: label === selection.get() ? "#74d3ae" : "#f7c948",
            stroke: "#17211d",
            strokeWidth: 3,
            cursor: "pointer",
          },
          keyboardFocusable: true,
          onClick: () => {
            selection.set(label);
            count.update((value) => value + 1);
          },
        }),
        createElement(
          Text,
          {
            style: {
              x: 198 + index * 142,
              y: 245,
              fill: "#17211d",
              font: "800 15px monospace",
              textAlign: "center",
            },
          },
          "CHOICE ",
          label,
        ),
      ),
  );

  return createElement(
    Fragment,
    { children: null },
    createElement(
      Group,
      null,
      createElement(Rectangle, {
        style: { width: 720, height: 420, fill: "#eef2ff" },
      }),
      createElement(Rectangle, {
        style: {
          x: 96,
          y: 58,
          width: 528,
          height: 304,
          fill: "#312e81",
          stroke: "#17211d",
          strokeWidth: 6,
        },
      }),
      createElement(
        Text,
        {
          style: {
            x: 360,
            y: 118,
            fill: "#f7c948",
            font: "900 31px sans-serif",
            textAlign: "center",
          },
        },
        "CREATE ELEMENT",
      ),
      createElement(
        Text,
        {
          style: {
            x: 360,
            y: 164,
            fill: "#ffffff",
            font: "700 16px monospace",
            textAlign: "center",
          },
          children: ["SELECTED ", selection.get(), " · COUNT ", count.get()],
        },
      ),
      choices,
      createElement(
        Text,
        {
          style: {
            x: 360,
            y: 322,
            fill: "#ffffff",
            font: "700 13px monospace",
            textAlign: "center",
          },
          children: ["LIFECYCLE ", liveLifecycleGenerations],
        },
      ),
    ),
  );
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(
    canvas,
    createElement(
      FocusManagement,
      null,
      createElement(
        KeyboardNavigation,
        { mode: "directional", children: null },
        createElement(CreateElementPoster, null),
      ),
    ),
  );
}
