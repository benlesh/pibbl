import { chromium } from "playwright";
// Run against an already-started Studio server. Timings are diagnostic, not CI gates.
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1000 },
  });
  await page.goto(
    process.argv[2] ??
      "http://127.0.0.1:5198/#/examples/composition/fire-and-flow",
  );
  await page.waitForFunction(() => document.querySelector("iframe"));
  const frame = await (
    await page.locator("iframe").elementHandle()
  ).contentFrame();
  await frame.waitForSelector("canvas");
  await page.waitForTimeout(10000);
  const client = await page.context().newCDPSession(page);
  await client.send("Profiler.enable");
  await client.send("Profiler.setSamplingInterval", { interval: 500 });
  await client.send("Performance.enable");
  const before = await client.send("Performance.getMetrics");
  await client.send("Profiler.start");
  const timings = await frame.evaluate(
    () =>
      new Promise((resolve) => {
        let previous;
        const values = [];
        function tick(now) {
          if (previous !== undefined) values.push(now - previous);
          previous = now;
          if (values.length < 300) requestAnimationFrame(tick);
          else resolve(values);
        }
        requestAnimationFrame(tick);
      }),
  );
  const { profile } = await client.send("Profiler.stop");
  const after = await client.send("Performance.getMetrics");
  const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
  const hits = new Map();
  for (const id of profile.samples ?? []) {
    const f = nodes.get(id).callFrame;
    const name = f.functionName || "(anonymous)";
    hits.set(name, (hits.get(name) || 0) + 1);
  }
  timings.sort((a, b) => a - b);
  const metric = (m, n) => m.metrics.find((x) => x.name === n)?.value;
  process.stdout.write(
    JSON.stringify(
      {
        frames: timings.length,
        p50: timings[150],
        p95: timings[285],
        p99: timings[297],
        over25ms: timings.filter((t) => t > 25).length,
        heapBefore: metric(before, "JSHeapUsedSize"),
        heapAfter: metric(after, "JSHeapUsedSize"),
        cpuTop: [...hits].sort((a, b) => b[1] - a[1]).slice(0, 25),
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
