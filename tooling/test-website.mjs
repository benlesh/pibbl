import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { preview } from "vite";

// Serve only the built site, on a free port, independently of local dev servers.
const server = await preview({
  configFile: false,
  root: fileURLToPath(new URL("../website/", import.meta.url)),
  appType: "mpa",
  preview: { host: "127.0.0.1", port: 0, cors: true, open: false },
});
try {
  const address = server.httpServer.address();
  const base = `http://127.0.0.1:${address.port}`;
  for (const script of [
    "website-documentation-browser.mjs",
    "website-unified-browser.mjs",
  ]) {
    await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [fileURLToPath(new URL(script, import.meta.url))],
        {
          stdio: "inherit",
          env: { ...process.env, PIBBL_WEBSITE_URL: base },
        },
      );
      child.once("error", reject);
      child.once("exit", (code, signal) => {
        if (code === 0) resolve();
        else reject(new Error(`${script} failed (${signal ?? code})`));
      });
    });
  }
} finally {
  await server.close();
}
