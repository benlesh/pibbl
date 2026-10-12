/** @jsxImportSource @pibbl/core */
import {
  pibbl,
  Rectangle,
  Text,
  HtmlBox,
  signal,
  useTexture,
  type PibblController,
  type HtmlMountCallback,
  type TextureRecipe,
} from "@pibbl/core";
import {
  polkaDots,
  halftone,
  plaid,
  truchet,
  plaidPresets,
  type PlaidBand,
} from "@pibbl/core/textures";

type Model = "Dots" | "Halftone" | "Plaid" | "Truchet";
const defaults = {
  Dots: { columns: 12, rows: 12, radius: 0.3, stagger: 0, jitter: 0, seed: 42 },
  Halftone: {
    columns: 24,
    rows: 24,
    minRadius: 0.05,
    maxRadius: 0.45,
    cyclesX: 1,
    cyclesY: 1,
    contrast: 0.7,
    stagger: 0.5,
  },
  Truchet: {
    columns: 8,
    rows: 8,
    lineWidth: 0.12,
    orientationBias: 0.5,
    seed: 42,
  },
  Plaid: { crossing: 0.5 },
};
type Setting = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
};
const count = (key: string, label: string, even = false): Setting => ({
  key,
  label,
  min: even ? 2 : 1,
  max: 64,
  step: even ? 2 : 1,
});
const fraction = (key: string, label: string, max = 1): Setting => ({
  key,
  label,
  min: 0,
  max,
  step: 0.01,
});
const fields: Record<Model, Setting[]> = {
  Dots: [
    count("columns", "Columns"),
    count("rows", "Rows", true),
    fraction("radius", "Dot radius", 0.5),
    fraction("stagger", "Row stagger"),
    fraction("jitter", "Jitter", 0.5),
    { key: "seed", label: "Seed", min: 0, max: 4294967295, step: 1 },
  ],
  Halftone: [
    count("columns", "Columns"),
    count("rows", "Rows", true),
    fraction("minRadius", "Minimum radius", 0.5),
    fraction("maxRadius", "Maximum radius", 0.5),
    { key: "cyclesX", label: "Horizontal waves", min: 0, max: 16, step: 1 },
    { key: "cyclesY", label: "Vertical waves", min: 0, max: 16, step: 1 },
    fraction("contrast", "Contrast"),
    fraction("stagger", "Row stagger"),
  ],
  Truchet: [
    count("columns", "Columns"),
    count("rows", "Rows"),
    fraction("lineWidth", "Line width", 0.5),
    fraction("orientationBias", "Orientation balance"),
    { key: "seed", label: "Seed", min: 0, max: 4294967295, step: 1 },
  ],
  Plaid: [fraction("crossing", "Horizontal color balance")],
};
export default function mount(canvas: HTMLCanvasElement): PibblController {
  const revision = signal(0);
  let model: Model = "Dots",
    settings: Record<string, number> = { ...defaults.Dots },
    phase = 0,
    speed = 0,
    tileWidth = 160,
    tileHeight = 160,
    rotation = 0,
    resolution = 256;
  let colors: Record<string, string> = { ...plaidPresets.gingham.colors };
  let horizontal: PlaidBand[] = [...plaidPresets.gingham.horizontal],
    vertical: PlaidBand[] = [...plaidPresets.gingham.vertical];
  let ramp = ["#f5e9d3", "#304c48"];
  const publish = () => revision.update((n) => n + 1);
  const controls: HtmlMountCallback<null> = (element, _data, lifetime) => {
    element.style.cssText +=
      ";box-sizing:border-box;padding:16px;background:#302d3b;border:1px solid #494354;border-radius:12px;color:#eee5d9;font:13px system-ui;overflow:auto;scrollbar-width:thin";
    let active: AbortController;
    const build = () => {
      active?.abort();
      active = new AbortController();
      element.replaceChildren();
      const events = { signal: active.signal };
      const row = (label: string) => {
        const wrapper = document.createElement("label");
        wrapper.style.cssText = "display:grid;gap:6px;margin:0 0 13px";
        const caption = document.createElement("span");
        caption.textContent = label;
        wrapper.append(caption);
        element.append(wrapper);
        return wrapper;
      };
      const style =
        "box-sizing:border-box;width:100%;padding:7px 9px;border:1px solid #625a70;border-radius:6px;background:#24212e;color:#f5e9d3;font:inherit";
      const button = (
        parent: HTMLElement,
        label: string,
        action: () => void,
      ) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.style.cssText =
          "padding:6px 9px;border:1px solid #625a70;border-radius:6px;background:#494151;color:#f5e9d3;font:inherit;cursor:pointer";
        b.addEventListener("click", action, events);
        parent.append(b);
        return b;
      };
      const select = (
        label: string,
        values: readonly string[],
        value: string,
        change: (v: string) => void,
      ) => {
        const s = document.createElement("select");
        s.style.cssText = style;
        s.setAttribute("aria-label", label);
        if (value === "") {
          const placeholder = document.createElement("option");
          placeholder.value = "";
          placeholder.textContent = "Choose preset…";
          placeholder.disabled = true;
          s.append(placeholder);
        }
        for (const v of values) {
          const o = document.createElement("option");
          o.value = v;
          o.textContent = v;
          s.append(o);
        }
        s.value = value;
        s.addEventListener("change", () => change(s.value), events);
        row(label).append(s);
        return s;
      };
      select(
        "Texture",
        ["Dots", "Halftone", "Plaid", "Truchet"],
        model,
        (v) => {
          model = v as Model;
          settings = { ...defaults[model] };
          phase = speed = 0;
          build();
          publish();
        },
      );
      const presets: Record<Model, readonly string[]> = {
        Dots: ["Regular", "Staggered", "Scattered"],
        Halftone: ["Soft waves", "High contrast", "Horizontal sweep"],
        Plaid: ["gingham", "tartan", "windowpane"],
        Truchet: ["Winding paths", "All one way", "Fine loops"],
      };
      select("Preset", presets[model], "", (v) => {
        settings = { ...defaults[model] };
        phase = speed = 0;
        if (model === "Dots") {
          if (v === "Staggered") settings.stagger = 0.5;
          if (v === "Scattered") {
            settings.stagger = 0.5;
            settings.jitter = 0.35;
            settings.seed = 91;
          }
        }
        if (model === "Halftone") {
          if (v === "High contrast") settings.contrast = 1;
          if (v === "Horizontal sweep") {
            settings.cyclesY = 0;
            settings.cyclesX = 2;
          }
        }
        if (model === "Truchet") {
          if (v === "All one way") settings.orientationBias = 1;
          if (v === "Fine loops") {
            settings.lineWidth = 0.06;
            settings.columns = settings.rows = 16;
          }
        }
        if (model === "Plaid") {
          const p = plaidPresets[v as keyof typeof plaidPresets];
          colors = { ...p.colors };
          horizontal = p.horizontal.map((b) => ({ ...b }));
          vertical = p.vertical.map((b) => ({ ...b }));
        }
        build();
        (
          element.querySelector('[aria-label="Preset"]') as HTMLSelectElement
        ).value = v;
        publish();
      });
      const status = document.createElement("p");
      status.setAttribute("role", "status");
      status.style.cssText = "color:#ffba99;min-height:0;margin:0 0 8px";
      const numeric = (
        f: Setting,
        value: number,
        change: (n: number) => void,
        slider = true,
      ) => {
        const wrapper = row(f.label),
          line = document.createElement("div");
        line.style.cssText = "display:flex;align-items:center;gap:8px";
        wrapper.append(line);
        const number = document.createElement("input");
        number.type = "number";
        number.value = String(value);
        number.min = String(f.min);
        number.max = String(f.max);
        number.step = String(f.step);
        number.style.cssText = style + ";width:86px";
        number.setAttribute("aria-label", f.label);
        const range = document.createElement("input");
        range.type = "range";
        range.min = number.min;
        range.max = number.max;
        range.step = number.step;
        range.value = number.value;
        range.style.cssText = "min-width:0;flex:1;accent-color:#edbd91";
        range.setAttribute("aria-label", `${f.label} slider`);
        const update = (input: HTMLInputElement) => {
          const n = Number(input.value);
          if (
            input.value === "" ||
            !input.checkValidity() ||
            !Number.isFinite(n)
          ) {
            status.textContent = `${f.label}: choose ${f.min}–${f.max}.`;
            return;
          }
          if (
            model === "Halftone" &&
            ((f.key === "minRadius" && n > settings.maxRadius) ||
              (f.key === "maxRadius" && n < settings.minRadius))
          ) {
            status.textContent =
              "Minimum radius must not exceed maximum radius.";
            return;
          }
          number.value = range.value = String(n);
          status.textContent = "";
          change(n);
          publish();
        };
        number.addEventListener("input", () => update(number), events);
        range.addEventListener("input", () => update(range), events);
        if (slider) line.append(range);
        line.append(number);
      };
      for (const field of fields[model])
        numeric(
          field,
          settings[field.key],
          (n) => {
            settings[field.key] = n;
          },
          field.key !== "seed",
        );
      numeric(fraction("phase", "Phase"), phase, (n) => {
        phase = n;
      });
      numeric(
        {
          key: "speed",
          label: "Speed (cycles/sec)",
          min: 0,
          max: 20,
          step: 0.01,
        },
        speed,
        (n) => {
          speed = n;
        },
      );
      const pauseRow = document.createElement("div");
      pauseRow.style.cssText = "display:flex;gap:8px;margin-bottom:16px";
      element.append(pauseRow);
      button(pauseRow, "Stop motion", () => {
        speed = 0;
        build();
        publish();
      });
      button(pauseRow, "Reset texture", () => {
        settings = { ...defaults[model] };
        phase = speed = 0;
        if (model === "Plaid") {
          colors = { ...plaidPresets.gingham.colors };
          horizontal = plaidPresets.gingham.horizontal.map((b) => ({ ...b }));
          vertical = plaidPresets.gingham.vertical.map((b) => ({ ...b }));
        }
        build();
        publish();
      });
      const colorInput = (
        parent: HTMLElement,
        label: string,
        value: string,
        change: (v: string) => void,
      ) => {
        const input = document.createElement("input");
        input.type = "color";
        input.value = value;
        input.setAttribute("aria-label", label);
        input.style.cssText =
          "width:100%;height:32px;padding:0;border:0;background:none;cursor:pointer";
        input.addEventListener(
          "input",
          () => {
            change(input.value);
            publish();
          },
          events,
        );
        parent.append(input);
      };
      if (model !== "Plaid") {
        const palette = row("Ordered color ramp");
        palette.style.display = "block";
        ramp.forEach((color, i) => {
          const line = document.createElement("div");
          line.style.cssText = "display:flex;gap:6px;margin-bottom:5px";
          palette.append(line);
          colorInput(line, `Ramp color ${i + 1}`, color, (v) => {
            ramp[i] = v;
          });
          const remove = button(line, "−", () => {
            ramp.splice(i, 1);
            build();
            publish();
          });
          remove.setAttribute("aria-label", `Remove ramp color ${i + 1}`);
          remove.disabled = ramp.length === 2;
        });
        const add = button(palette, "+ Color stop", () => {
          ramp.push("#c56948");
          build();
          publish();
        });
        add.disabled = ramp.length === 16;
      } else {
        const dictionary = row("Named colors");
        dictionary.style.display = "block";
        Object.entries(colors).forEach(([key, value]) => {
          const line = document.createElement("div");
          line.style.cssText =
            "display:grid;grid-template-columns:1fr 55px 27px;gap:6px;margin-bottom:7px";
          dictionary.append(line);
          const name = document.createElement("input");
          name.type = "text";
          name.value = key;
          name.style.cssText = style;
          name.setAttribute("aria-label", `Rename color ${key}`);
          name.addEventListener(
            "change",
            () => {
              const next = name.value.trim();
              if (!next || (next !== key && Object.hasOwn(colors, next))) {
                status.textContent = "Use a unique nonempty color name.";
                name.value = key;
                return;
              }
              if (next === key) return;
              const value = colors[key];
              colors = Object.fromEntries(
                Object.entries(colors).map(([name, color]) => [
                  name === key ? next : name,
                  name === key ? value : color,
                ]),
              );
              horizontal = horizontal.map((b) => ({
                ...b,
                color: b.color === key ? next : b.color,
              }));
              vertical = vertical.map((b) => ({
                ...b,
                color: b.color === key ? next : b.color,
              }));
              build();
              publish();
            },
            events,
          );
          line.append(name);
          colorInput(line, `Color ${key}`, value, (v) => {
            colors[key] = v;
          });
          const remove = button(line, "−", () => {
            delete colors[key];
            const fallback = Object.keys(colors)[0];
            horizontal = horizontal.map((b) => ({
              ...b,
              color: b.color === key ? fallback : b.color,
            }));
            vertical = vertical.map((b) => ({
              ...b,
              color: b.color === key ? fallback : b.color,
            }));
            build();
            publish();
          });
          remove.setAttribute("aria-label", `Remove color ${key}`);
          remove.disabled = Object.keys(colors).length === 1;
        });
        const addColor = button(dictionary, "+ Named color", () => {
          let n = 1;
          while (Object.hasOwn(colors, `color${n}`)) n++;
          colors[`color${n}`] = "#c56948";
          build();
          publish();
        });
        addColor.disabled = Object.keys(colors).length === 16;
        for (const axis of ["horizontal", "vertical"] as const) {
          const wrapper = row(
            `${axis === "horizontal" ? "Horizontal" : "Vertical"} bands`,
          );
          wrapper.style.display = "block";
          const list = axis === "horizontal" ? horizontal : vertical;
          list.forEach((band, i) => {
            const line = document.createElement("div");
            line.style.cssText =
              "display:grid;grid-template-columns:58px 1fr 27px 27px;gap:5px;margin-bottom:6px";
            wrapper.append(line);
            const width = document.createElement("input");
            width.type = "number";
            width.min = ".01";
            width.max = "1000000";
            width.step = "any";
            width.value = String(band.width);
            width.style.cssText = style + ";padding:6px";
            width.setAttribute("aria-label", `${axis} band ${i + 1} width`);
            width.addEventListener(
              "input",
              () => {
                if (width.value && width.checkValidity()) {
                  list[i] = { ...list[i], width: Number(width.value) };
                  publish();
                }
              },
              events,
            );
            line.append(width);
            const key = document.createElement("select");
            key.style.cssText = style + ";padding:6px";
            key.setAttribute("aria-label", `${axis} band ${i + 1} color`);
            for (const name of Object.keys(colors)) {
              const option = document.createElement("option");
              option.value = option.textContent = name;
              key.append(option);
            }
            key.value = band.color;
            key.addEventListener(
              "change",
              () => {
                list[i] = { ...list[i], color: key.value };
                publish();
              },
              events,
            );
            line.append(key);
            const up = button(line, "↑", () => {
              [list[i - 1], list[i]] = [list[i], list[i - 1]];
              build();
              publish();
            });
            up.setAttribute("aria-label", `Move ${axis} band ${i + 1} up`);
            up.disabled = i === 0;
            const remove = button(line, "−", () => {
              list.splice(i, 1);
              build();
              publish();
            });
            remove.setAttribute("aria-label", `Remove ${axis} band ${i + 1}`);
            remove.disabled = list.length === 1;
          });
          const add = button(wrapper, `+ ${axis} band`, () => {
            list.push({ width: 1, color: Object.keys(colors)[0] });
            build();
            publish();
          });
          add.disabled = list.length === 32;
        }
      }
      numeric(
        { key: "tileWidth", label: "Tile width", min: 16, max: 1024, step: 1 },
        tileWidth,
        (n) => {
          tileWidth = n;
        },
      );
      numeric(
        {
          key: "tileHeight",
          label: "Tile height",
          min: 16,
          max: 1024,
          step: 1,
        },
        tileHeight,
        (n) => {
          tileHeight = n;
        },
      );
      numeric(
        { key: "rotation", label: "Rotation", min: -180, max: 180, step: 1 },
        rotation,
        (n) => {
          rotation = n;
        },
      );
      select("Resolution", ["128", "256", "512"], String(resolution), (v) => {
        resolution = Number(v);
        publish();
      });
      element.append(status);
    };
    lifetime.addEventListener("abort", () => active.abort(), { once: true });
    build();
    return () => {};
  };
  function Preview() {
    revision.get();
    let recipe: TextureRecipe;
    const options = { ...settings, phase, speed };
    if (model === "Dots") recipe = polkaDots(options);
    else if (model === "Halftone") recipe = halftone(options);
    else if (model === "Truchet") recipe = truchet(options);
    else
      recipe = plaid({
        colors,
        horizontal,
        vertical,
        crossing: settings.crossing,
        phase,
        speed,
      });
    const texture = useTexture(recipe, {
      resolution: { width: resolution, height: resolution },
      palette: model === "Plaid" ? undefined : ramp,
    });
    return (
      <>
        <Text
          pointerEvents="none"
          style={{
            left: 344,
            top: 120,
            font: "700 18px Arial",
            fill: "#fff1d9",
          }}
        >{`${model} · one seamless tile`}</Text>
        <Rectangle
          pointerEvents="none"
          style={{
            left: 344,
            top: 150,
            width: 300,
            height: 300,
            fill: texture.paint({ mode: "stretch" }),
          }}
        />
        <Text
          pointerEvents="none"
          style={{ left: 664, top: 174, font: "14px Arial", fill: "#edbd91" }}
        >
          Made to repeat.
        </Text>
        <Text
          pointerEvents="none"
          style={{ left: 664, top: 205, font: "12px Arial", fill: "#c1bccc" }}
        >
          Colors and geometry update live.
        </Text>
        <Text
          pointerEvents="none"
          style={{ left: 664, top: 231, font: "12px Arial", fill: "#c1bccc" }}
        >
          Zero speed stops scheduling.
        </Text>
        <Text
          pointerEvents="none"
          style={{ left: 664, top: 257, font: "12px Arial", fill: "#c1bccc" }}
        >
          Scroll the settings for more.
        </Text>
        <Text
          pointerEvents="none"
          style={{
            left: 344,
            top: 492,
            font: "700 18px Arial",
            fill: "#fff1d9",
          }}
        >
          Repeated surface
        </Text>
        <Rectangle
          pointerEvents="none"
          style={{
            left: 344,
            top: 522,
            width: 612,
            height: 350,
            fill: texture.paint({
              mode: "repeat",
              tileWidth,
              tileHeight,
              rotation,
            }),
          }}
        />
        <Text
          pointerEvents="none"
          style={{ left: 344, top: 906, font: "12px Arial", fill: "#c1bccc" }}
        >
          Plaid bands reference named colors. Other recipes use an ordered color
          ramp.
        </Text>
      </>
    );
  }
  function Scene() {
    revision.get();
    return (
      <>
        <Rectangle
          pointerEvents="none"
          style={{ width: 980, height: 940, fill: "#231f2b" }}
        />
        <Text
          pointerEvents="none"
          style={{ left: 24, top: 30, font: "700 30px Arial", fill: "#fff1d9" }}
        >
          Patterns, your way.
        </Text>
        <Text
          pointerEvents="none"
          style={{ left: 24, top: 75, font: "14px Arial", fill: "#c1bccc" }}
        >
          Dots, tonal fields, named-color plaids, and winding curves. Every
          control is yours.
        </Text>
        <HtmlBox
          mount={controls}
          data={null}
          style={{ left: 24, top: 112, width: 292, height: 800 }}
        />
        <Preview key={model} />
      </>
    );
  }
  const placeholder = document.createComment("geometric explorer canvas");
  canvas.before(placeholder);
  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "position:relative;width:100%;height:100%;isolation:isolate";
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:absolute;inset:0;z-index:1;pointer-events:none";
  const previousStyle = canvas.getAttribute("style");
  canvas.style.cssText =
    "display:block;width:100%;height:100%;border:0;padding:0";
  const ownedStyle = canvas.getAttribute("style");
  placeholder.after(wrapper);
  wrapper.append(canvas, overlay);
  const restore = () => {
    if (canvas.parentElement === wrapper) placeholder.after(canvas);
    if (canvas.getAttribute("style") === ownedStyle) {
      if (previousStyle === null) canvas.removeAttribute("style");
      else canvas.setAttribute("style", previousStyle);
    }
    wrapper.remove();
    placeholder.remove();
  };
  let controller: PibblController;
  try {
    controller = pibbl(canvas, <Scene />, {
      viewport: { width: 980, height: 940 },
      htmlOverlay: overlay,
    });
  } catch (error) {
    restore();
    throw error;
  }
  let disposed = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        controller.dispose();
      } finally {
        restore();
      }
    },
  };
}
