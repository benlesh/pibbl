import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(import.meta.dirname, "..");
const packedEntryArgument = process.argv.indexOf("--packed-entry");
const packedEntry =
  packedEntryArgument === -1
    ? undefined
    : process.argv[packedEntryArgument + 1];
if (packedEntryArgument !== -1 && !packedEntry)
  throw new Error("--packed-entry requires an installed public entry path.");
const directory = await mkdtemp(join(tmpdir(), "crc-positioning-env-"));

const browserProbe = String.raw`
import { Flex, Flow, Grid, Rectangle, createElement, crc } from '@crc/core';

const layouts = ['Flex', 'Flow', 'Grid'];

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function createTree(layout, includeOffsets, onClick) {
  const rectangle = createElement(Rectangle, {
    onClick,
    style: {
      ...(includeOffsets ? { left: 10, top: 440 } : {}),
      ...(layout === 'Grid' ? { gridColumnStart: 1, gridRowStart: 1 } : {}),
      width: 80,
      height: 40,
      minHeight: 0,
      fill: '#1473e6',
    },
  });
  if (layout === 'Flex') {
    return createElement(Flex, {
      style: { flexDirection: 'column', width: 200, height: 500 },
    }, rectangle);
  }
  if (layout === 'Flow') {
    return createElement(Flow, {
      style: { direction: 'vertical', width: 200, height: 500 },
    }, rectangle);
  }
  return createElement(Grid, {
    style: {
      width: 200,
      height: 500,
      gridTemplateColumns: [200],
      gridTemplateRows: [500],
    },
  }, rectangle);
}

function pixels(canvas) {
  const context = canvas.getContext('2d');
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  let left = canvas.width;
  let top = canvas.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (image.data[(y * canvas.width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return {
    data: Array.from(image.data),
    paint: right < 0 ? null : { left, top, right, bottom },
  };
}

function click(canvas, paint) {
  if (!paint) return;
  const bounds = canvas.getBoundingClientRect();
  const x = paint.left + Math.floor((paint.right - paint.left) / 2);
  const y = paint.top + Math.floor((paint.bottom - paint.top) / 2);
  for (const type of ['mousedown', 'mouseup', 'click']) {
    canvas.dispatchEvent(new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: bounds.left + x,
      clientY: bounds.top + y,
    }));
  }
}

async function render(layout, includeOffsets) {
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 500;
  canvas.style.cssText = 'display:block;width:200px;height:500px';
  document.body.append(canvas);
  const errors = [];
  const onError = event => {
    errors.push(String(event.error?.message ?? event.message));
    event.preventDefault();
  };
  window.addEventListener('error', onError);
  let controller;
  let clicks = 0;
  try {
    controller = crc(canvas, createTree(layout, includeOffsets, () => { clicks++; }), {
      pixelRatio: 1,
    });
    await nextFrame();
    await nextFrame();
    const snapshot = pixels(canvas);
    click(canvas, snapshot.paint);
    return { errors, clicks, ...snapshot };
  } catch (error) {
    errors.push(String(error?.message ?? error));
    return { errors, clicks, data: [], paint: null };
  } finally {
    window.removeEventListener('error', onError);
    controller?.dispose();
    canvas.remove();
  }
}

globalThis.__crcPositioningProbe = async () => {
  const result = {};
  for (const layout of layouts) {
    const omitted = await render(layout, false);
    const supplied = await render(layout, true);
    result[layout] = {
      omitted: {
        errors: omitted.errors,
        clicks: omitted.clicks,
        paint: omitted.paint,
      },
      supplied: {
        errors: supplied.errors,
        clicks: supplied.clicks,
        paint: supplied.paint,
      },
      pixelsMatch: omitted.data.length === supplied.data.length &&
        omitted.data.every((value, index) => value === supplied.data[index]),
    };
  }
  return result;
};
`;

function publicCoreEntry(kind) {
  if (kind === "packed") return resolve(packedEntry);
  return kind === "source"
    ? resolve(root, "packages/core/src/index.ts")
    : resolve(root, "packages/core/dist/index.mjs");
}

async function bundleProbe(kind, development) {
  const output = join(directory, `${kind}-dev-${development}.js`);
  await build({
    absWorkingDir: root,
    bundle: true,
    define: { "import.meta.env.DEV": String(development) },
    format: "iife",
    outfile: output,
    platform: "browser",
    stdin: {
      contents: browserProbe,
      loader: "ts",
      resolveDir: root,
      sourcefile: "positioning-public-runtime-probe.ts",
    },
    target: "es2022",
    plugins: [
      {
        name: "public-core-entry",
        setup(buildContext) {
          buildContext.onResolve({ filter: /^@crc\/core$/ }, () => ({
            path: publicCoreEntry(kind),
          }));
        },
      },
    ],
  });
  return output;
}

function assertDevelopmentResult(label, results) {
  for (const [layout, result] of Object.entries(results)) {
    const { omitted, supplied } = result;
    if (omitted.errors.length !== 0) {
      throw new Error(
        `${label} ${layout} rejected omitted offsets: ${omitted.errors.join("\n")}`,
      );
    }
    if (
      !supplied.errors.some((error) =>
        error.includes("CRC_LAYOUT_IGNORED_POSITION"),
      )
    ) {
      throw new Error(
        `${label} ${layout} did not capture CRC_LAYOUT_IGNORED_POSITION from the render: ${supplied.errors.join("\n") || "(no error)"}`,
      );
    }
  }
}

function assertProductionResult(label, results) {
  for (const [layout, result] of Object.entries(results)) {
    const { omitted, supplied } = result;
    if (omitted.errors.length !== 0 || supplied.errors.length !== 0) {
      throw new Error(
        `${label} ${layout} reported an error: ${[...omitted.errors, ...supplied.errors].join("\n")}`,
      );
    }
    if (
      !result.pixelsMatch ||
      JSON.stringify(omitted.paint) !== JSON.stringify(supplied.paint)
    ) {
      throw new Error(
        `${label} ${layout} changed the paint result when ignored left/top were supplied: ${JSON.stringify({ omitted: omitted.paint, supplied: supplied.paint, pixelsMatch: result.pixelsMatch })}`,
      );
    }
    if (omitted.clicks !== 1 || supplied.clicks !== 1) {
      throw new Error(
        `${label} ${layout} changed hit targeting: omitted=${omitted.clicks}, supplied=${supplied.clicks}.`,
      );
    }
  }
}

let browser;
try {
  const bundles = await Promise.all(
    ["source", "built", ...(packedEntry ? ["packed"] : [])].flatMap((kind) => [
      bundleProbe(kind, true).then((path) => ({
        kind,
        development: true,
        path,
      })),
      bundleProbe(kind, false).then((path) => ({
        kind,
        development: false,
        path,
      })),
    ]),
  );
  browser = await chromium.launch({ headless: true });
  for (const bundle of bundles) {
    const page = await browser.newPage({
      viewport: { width: 240, height: 540 },
    });
    await page.addScriptTag({ path: bundle.path });
    const results = await page.evaluate(() =>
      globalThis.__crcPositioningProbe(),
    );
    const label = `${bundle.kind} DEV=${bundle.development}`;
    if (bundle.development) assertDevelopmentResult(label, results);
    else assertProductionResult(label, results);
    await page.close();
    process.stdout.write(`positioning environment gate: ${label} passed\n`);
  }
} finally {
  await browser?.close();
  await rm(directory, { recursive: true, force: true });
}
