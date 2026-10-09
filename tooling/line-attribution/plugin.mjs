import { resolve } from "node:path";
import { readFile } from "node:fs/promises";

const targets = [
  "packages/core/src/features/viz/lib/line-series.tsx",
  "packages/core/src/lib/components/path.ts",
  "packages/core/src/lib/execute-render.ts",
];
/** Exact source substitutions fail closed when the renderer changes. Development tooling only. */
export function instrumentLineAttribution(code, file, root) {
  const index = targets.findIndex(
    (target) => resolve(root, target) === file.split("?")[0],
  );
  if (index < 0) return null;
  const helper = resolve(root, "tooling/line-attribution/capture.ts");
  const replace = (before, after) => {
    if (code.split(before).length !== 2)
      throw new Error(
        `Line attribution source anchor changed: ${targets[index]}: ${before.slice(0, 60)}`,
      );
    code = code.replace(before, after);
  };
  if (index === 0) {
    code =
      `import { beginLineCapture, captureLinePoint, captureLineRun, bindLinePath } from ${JSON.stringify(helper)};\n` +
      code;
    replace(
      "  const path = new Path2D();",
      "  const path = new Path2D();\n  const __lineCapture = beginLineCapture({ xId, yId, xScale, yScale, curveDefinition });",
    );
    replace(
      "      appendCurveForward(path, geometry);",
      "      appendCurveForward(path, geometry);\n      if (__lineCapture) captureLineRun(__lineCapture, geometry);",
    );
    replace(
      "    run = [];",
      "    if (__lineCapture) __lineCapture.run = [];\n    run = [];",
    );
    replace(
      "    const point = [px, py] as const;",
      "    if (__lineCapture) captureLinePoint(__lineCapture, { index: i, datum, x: xv, y: yv, px, py });\n    const point = [px, py] as const;",
    );
    replace(
      "\n  flushRun();\n",
      "\n  flushRun();\n  if (__lineCapture) bindLinePath(path, __lineCapture);\n",
    );
  } else if (index === 1) {
    code =
      `import { captureLinePaint } from ${JSON.stringify(helper)};\n` + code;
    replace(
      "    ctx.stroke(d);",
      "    ctx.stroke(d);\n    captureLinePaint(d, ctx);",
    );
  } else {
    code =
      `import { beginAttributionRender } from ${JSON.stringify(helper)};\n` +
      code;
    replace(
      "    GLOBAL_STATE.renderTransaction = renderTransaction;",
      "    GLOBAL_STATE.renderTransaction = renderTransaction;\n    beginAttributionRender(pibblInstance, renderTransaction);",
    );
  }
  return code;
}
export function lineAttributionPlugin(root) {
  return {
    name: "pibbl-line-attribution-development",
    enforce: "pre",
    apply: (_config, env) =>
      env.command === "serve" && env.mode === "inspection",
    configureServer(server) {
      server.middlewares.use(
        "/__pibbl/line-attribution",
        (_request, response) => {
          response.setHeader("Content-Type", "text/html");
          response.end(
            `<!doctype html><html><head><title>Line attribution</title><style>body{font:14px system-ui;margin:24px;color:#173047}canvas{display:block;width:710px;height:420px}pre{white-space:pre-wrap;max-width:900px}button{padding:8px 14px;margin:8px 8px 8px 0}</style></head><body><h1>Line attribution · development build</h1><p>Move over the blue line. The right half is intentionally clipped. Update, reveal the clip, zoom, then fail and retry rendering.</p><nav></nav><canvas width="710" height="420"></canvas><pre></pre><script type="module" src="/@fs${root}/tooling/line-attribution/demo.tsx"></script></body></html>`,
          );
        },
      );
    },
    transform(code, id) {
      const transformed = instrumentLineAttribution(code, id, root);
      return transformed === null ? null : { code: transformed, map: null };
    },
  };
}
export function lineAttributionEsbuildPlugin(root, { enabled = false } = {}) {
  return {
    name: "pibbl-line-attribution-development",
    setup(builder) {
      if (!enabled) return;
      builder.onLoad(
        {
          filter:
            /(?:line-series\.tsx|components\/path\.ts|execute-render\.ts)$/,
        },
        async ({ path }) => {
          const transformed = instrumentLineAttribution(
            await readFile(path, "utf8"),
            path,
            root,
          );
          return transformed === null
            ? undefined
            : {
                contents: transformed,
                loader: path.endsWith("tsx") ? "tsx" : "ts",
              };
        },
      );
    },
  };
}
