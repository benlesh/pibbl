import { Rectangle, Text, pibbl } from "@pibbl/core";
import { Fragment, jsx, jsxs, type JSX } from "@pibbl/core/jsx-runtime";

const canvas = document.createElement("canvas");
canvas.width = 280;
canvas.height = 140;
document.body.append(canvas);

const component: JSX.ElementType = Rectangle;
const key: JSX.IntrinsicAttributes = { key: "background" };
const childSlot: keyof JSX.ElementChildrenAttribute = "children";
const background = jsx(
  component,
  { style: { width: 280, height: 140, fill: "#17324d" } },
  key.key,
);
const label = jsx(Text, {
  style: { left: 20, top: 48, font: "24px sans-serif", fill: "#fff" },
  [childSlot]: "Compiler output",
});
const root = jsxs(Fragment, { children: [background, label] });
const controller = pibbl(canvas, root);

// No lowercase Canvas tags exist in the module-scoped JSX vocabulary.
const hasIntrinsicTag = (_name: string): _name is keyof JSX.IntrinsicElements =>
  false;
const status = document.createElement("p");
status.textContent = hasIntrinsicTag("rectangle")
  ? "Intrinsic tag"
  : "Component values only";
document.body.append(status);

window.addEventListener("pagehide", () => controller.dispose(), { once: true });
