/** @jsxImportSource @pibbl/core */
import {
  pibbl,
  createElement,
  Fragment,
  Text,
  type PibblComponent,
  type PibblElement,
  type PibblElementType,
  type PibblKey,
  type PibblNode,
  type PibblNodeInput,
  type PibblContainerChild,
  type PibblEmptyNode,
  type PibblTextChild,
  type PibblTextInput,
  type PibblRenderResult,
} from "@pibbl/core";

const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 120;
document.body.append(canvas);
const Label: PibblComponent<{ value: string }> = ({ value }): PibblRenderResult => {
  const words: PibblTextChild = ["Hello ", value];
  const text: PibblTextInput = words;
  return (
    <Text
      style={{ left: 20, top: 50, font: "24px sans-serif", fill: "#267d7c" }}
    >
      {text}
    </Text>
  );
};
const component: PibblElementType<{ value: string }> = Label;
const key: PibblKey = "greeting";
const element: PibblElement<{ value: string }> = createElement(component, {
  value: "Pibbl",
  key,
});
const empty: PibblEmptyNode = null;
const nodes: PibblNode = [element, empty];
const input: PibblNodeInput = nodes;
const children: PibblContainerChild = input;
const controller = pibbl(canvas, <Fragment>{children}</Fragment>);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
