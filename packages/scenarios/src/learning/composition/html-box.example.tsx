import {
  HtmlBox,
  Manipulable,
  Group,
  Clip,
  FocusManagement,
  Rectangle,
  Text,
  PathGeometry,
  useSignal,
  useConst,
  type HtmlMountCallback,
} from "@pibbl/core";

const mountEditor: HtmlMountCallback<string> = (element, title, signal) => {
  element.style.cssText +=
    ";padding:22px;font:15px system-ui;color:#163a40;background:#e7f6ef";
  const label = document.createElement("label");
  label.style.cssText = "display:grid;gap:10px;font-weight:650";
  const caption = document.createElement("span");
  caption.textContent = title;
  const input = document.createElement("input");
  input.placeholder = "Type here, then move the box";
  input.style.cssText =
    "width:100%;padding:10px;border:1px solid #87b2a3;border-radius:5px;font:inherit;box-sizing:border-box";
  label.append(caption, input);
  const button = document.createElement("button");
  button.textContent = "Native clicks: 0";
  button.style.cssText =
    "margin-top:15px;padding:10px 16px;background:#164c45;color:white;border:0;border-radius:5px;font:inherit;cursor:pointer";
  let clicks = 0;
  button.addEventListener(
    "click",
    () => {
      button.textContent = `Native clicks: ${++clicks}`;
    },
    { signal },
  );
  element.append(label, button);
  return (next) => {
    caption.textContent = next;
  };
};

function HtmlBoxLesson() {
  const angle = useSignal(0);
  const box = useSignal({ left: 145, top: 174, width: 340, height: 190 });
  const edits = useSignal(0);
  const after = useSignal(0);
  const clip = useConst(() => {
    const path = new PathGeometry();
    path.roundRect(0, 0, 340, 190, 24);
    return path;
  });
  const controls = [
    {
      text: "ROTATE",
      action: () => angle.update((value) => value + Math.PI / 18),
    },
    {
      text: "MOVE",
      action: () => box.update((value) => ({ ...value, left: value.left >= 205 ? 145 : value.left + 20 })),
    },
    {
      text: "SCALE",
      action: () => box.update((value) => ({ ...value, width: value.width === 340 ? 272 : 340, height: value.width === 340 ? 152 : 190 })),
    },
  ];
  return (
    <FocusManagement>
      <Group>
        <Rectangle style={{ width: 720, height: 480, fill: "#fffdf6" }} />
        <Text
          style={{
            left: 32,
            top: 45,
            font: "700 28px system-ui",
            fill: "#163a40",
          }}
        >
          HTML, inside your canvas app
        </Text>
        <Text
          style={{ left: 32, top: 75, font: "14px system-ui", fill: "#42655f" }}
        >
          Native editing. Pibbl placement, transforms, clipping, and focus.
        </Text>
        {controls.map((control, index) => (
          <Group key={control.text}>
            <Rectangle
              style={{
                left: 32 + index * 135,
                top: 96,
                width: 120,
                height: 40,
                fill: "#164c45",
                cursor: "pointer",
              }}
              onClick={control.action}
            />
            <Text
              pointerEvents="none"
              style={{
                left: 92 + index * 135,
                top: 116,
                textBaseline: "middle",
                textAlign: "center",
                font: "700 12px system-ui",
                fill: "white",
              }}
            >
              {control.text}
            </Text>
          </Group>
        ))}
        <Manipulable style={box} rotation={angle} draggable rotatable
          resizable={{ minWidth: 220, maxWidth: 470, minHeight: 120, aspectRatio: { value: "initial" } }}
          resizeHandles="corners">
          <Group style={{ scaleX: box.get().width / 340, scaleY: box.get().height / 190 }}>
            <Clip style={{ d: clip }}>
              <HtmlBox
                mount={mountEditor}
                data="Your note"
                style={{ width: 340, height: 190 }}
                onInput={() => edits.update(value => value + 1)}
                onPointerDown={event => {
                  // Native controls keep editing and label activation; the panel's
                  // empty space bubbles to Manipulable's ordinary drag handler.
                  const target = event.originalEvent.target;
                  if (target instanceof Element && target.closest("input, button, label")) event.stopPropagation();
                }}
              />
            </Clip>
          </Group>
        </Manipulable>
        <Rectangle
          style={{
            left: 32,
            top: 404,
            width: 190,
            height: 40,
            fill: "#164c45",
            cursor: "pointer",
          }}
          onClick={() => after.update((n) => n + 1)}
        />
        <Text
          pointerEvents="none"
          style={{
            left: 127,
            top: 424,
            textBaseline: "middle",
            textAlign: "center",
            font: "700 12px system-ui",
            fill: "white",
          }}
        >{`CANVAS CLICKS: ${after.get()}`}</Text>
        <Text
          style={{
            left: 242,
            top: 424,
            textBaseline: "middle",
            font: "13px system-ui",
            fill: "#42655f",
          }}
        >
          {`Native edits: ${edits.get()}. Drag, resize, or rotate the panel.`}
        </Text>
      </Group>
    </FocusManagement>
  );
}

export function HtmlBoxExample() {
  return <HtmlBoxLesson />;
}
