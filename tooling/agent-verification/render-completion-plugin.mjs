export function renderCompletionPlugin(root) {
  return {
    name: "pibbl-render-completion-demo",
    apply: (_config, env) =>
      env.command === "serve" && env.mode === "inspection",
    configureServer(server) {
      server.middlewares.use(
        "/__pibbl/render-completion",
        (_request, response) => {
          response.setHeader("Content-Type", "text/html");
          response.end(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pibbl render-completion verification</title>
<style>
body{font:14px system-ui,sans-serif;margin:24px;color:#173047}canvas{display:block;width:640px;height:360px;max-width:100%;border:1px solid #d6e0ea}button{padding:8px 12px;margin:0 6px 8px 0}pre{white-space:pre-wrap;overflow:auto;max-height:420px;background:#f4f7fb;padding:14px;border-radius:6px;max-width:960px}.note{max-width:900px;line-height:1.5}
</style></head><body>
<h1>Render completion + inspection + pixels</h1>
<p class="note">Start capture, then update, zoom, pan, or clip the chart. Completion callbacks record public semantic inspection by committed generation; captured-frame callbacks identify the exact copied RGBA generation. Stop to read the retained raw pixels. The fail control demonstrates a rejected partial render.</p>
<nav>
<button data-action="start">Start capture</button><button data-action="update">Update middle row</button><button data-action="zoom">Zoom</button><button data-action="pan">Pan</button><button data-action="clip">Clip center point</button><button data-action="fail">Fail render</button><button data-action="repair">Repair render</button><button data-action="stop">Stop and read frames</button><button data-action="reset">Reset chart</button>
</nav>
<canvas width="640" height="360"></canvas>
<pre data-testid="evidence"></pre>
<script type="module" src="/@fs${root}/tooling/agent-verification/render-completion-demo.tsx"></script>
</body></html>`);
        },
      );
    },
  };
}
