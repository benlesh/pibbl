export {};

await import("./content-model.check");
await import("./api-exports.check");
await import("./build.check");
await import("./search-index.check");

process.stdout.write(
  "Validated CRC Studio documentation content, API coverage, routes, links, and search.\n",
);
