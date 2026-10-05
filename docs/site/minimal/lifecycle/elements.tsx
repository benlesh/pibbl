/** @jsxImportSource @crc/core */
import {
  crc,
  createElement,
  Fragment,
  Text,
  type CRCComponent,
  type CRCElement,
  type CRCElementType,
  type CRCKey,
  type CRCNode,
  type CRCNodeInput,
  type CRCContainerChild,
  type CRCEmptyNode,
  type CRCTextChild,
  type CRCTextInput,
  type CRCRenderResult,
} from "@crc/core";

const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 120;
document.body.append(canvas);
const Label: CRCComponent<{ value: string }> = ({ value }): CRCRenderResult => {
  const words: CRCTextChild = ["Hello ", value];
  const text: CRCTextInput = words;
  return (
    <Text
      style={{ left: 20, top: 50, font: "24px sans-serif", fill: "#267d7c" }}
    >
      {text}
    </Text>
  );
};
const component: CRCElementType<{ value: string }> = Label;
const key: CRCKey = "greeting";
const element: CRCElement<{ value: string }> = createElement(component, {
  value: "CRC",
  key,
});
const empty: CRCEmptyNode = null;
const nodes: CRCNode = [element, empty];
const input: CRCNodeInput = nodes;
const children: CRCContainerChild = input;
const controller = crc(canvas, <Fragment>{children}</Fragment>);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
