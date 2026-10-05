import {
  crc,
  HtmlBox,
  Rectangle,
  signal,
  type HtmlBoxProps,
  type HtmlBoxStyle,
  type HtmlMountCallback,
  type HtmlUpdateFunction,
  type HtmlBoxFocusState,
} from "@crc/core";

const count = signal(0);
const output = document.createElement("output");
const canvas = document.createElement("canvas");
canvas.width = 360;
canvas.height = 180;
const host = document.createElement("div");
host.style.cssText = "position:relative;width:360px;max-width:100%";
const overlay = document.createElement("div");
overlay.style.cssText = "position:absolute;inset:0;pointer-events:none";
canvas.style.display = "block";
host.append(canvas, overlay);
document.body.append(host, output);
type Data = { label: string };
const mount: HtmlMountCallback<Data> = (element, initial, abort) => {
  const button = document.createElement("button");
  button.textContent = initial.label;
  button.addEventListener("click", () => count.update((n) => n + 1), {
    signal: abort,
  });
  element.append(button);
  const update: HtmlUpdateFunction<Data> = (data) => {
    button.textContent = data.label;
  };
  return update;
};
const style: HtmlBoxStyle = { left: 30, top: 50, width: 270, height: 70 };
function Scene() {
  const props: HtmlBoxProps<Data> = {
    data: { label: "Native clicks: " + count.get() },
    mount,
    onFocusChange(state: Readonly<HtmlBoxFocusState>) {
      output.textContent = state.isFocusWithin
        ? "HTML focused"
        : "HTML unfocused";
    },
  };
  return (
    <>
      <Rectangle style={{ width: 360, height: 180, fill: "#e5f2ef" }} />
      <HtmlBox {...props} style={style} />
    </>
  );
}
const controller = crc(canvas, <Scene />, { htmlOverlay: overlay });
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
