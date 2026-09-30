import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { root, cache, lock, run } from "./common.mjs";
import { ensureSetup } from "./setup.mjs";
import { withDirectoryLock } from "./lib/files.mjs";
await withDirectoryLock(resolve(cache, "tooling.lock"), async () => {
  await ensureSetup();
  const output = resolve(cache, "reference");
  await mkdir(output, { recursive: true });
  const upstream = resolve(cache, `harfbuzz-${lock.harfbuzz.version}`, "src");
  const executable = resolve(output, "hb-reference");
  run(process.env.CXX ?? "c++", [
    "-std=c++17",
    "-O2",
    "-DHB_NO_MT",
    "-DHB_NO_MMAP",
    "-I" + upstream,
    resolve(upstream, "harfbuzz.cc"),
    resolve(root, "native/reference.cpp"),
    "-o",
    executable,
  ]);
  const cases = [
    {
      name: "Latin kerning",
      font: "ABeeZee-Regular.ttf",
      text: "AV",
      features: { kern: true },
    },
    {
      name: "Latin without kerning",
      font: "ABeeZee-Regular.ttf",
      text: "AV",
      features: { kern: false },
    },
    {
      name: "Latin ligature",
      font: "lato/Lato-Regular.ttf",
      text: "office",
      features: { liga: true },
    },
    {
      name: "Latin without ligature",
      font: "lato/Lato-Regular.ttf",
      text: "office",
      features: { liga: false },
    },
    {
      name: "Arabic marks and RTL",
      font: "noto-naskh/NotoNaskhArabic-Regular.ttf",
      text: "سَلَام",
    },
    {
      name: "CFF and accents",
      font: "source-serif/SourceSerif4-Regular.otf",
      text: "Oé fi",
    },
    {
      name: "Combining accent",
      font: "lato/Lato-Regular.ttf",
      text: "A\u0301",
    },
    {
      name: "Supplementary UTF-16 cluster",
      font: "lato/Lato-Regular.ttf",
      text: "\u{1f642}A",
      missingGlyphs: "notdef",
    },
    {
      name: "Default ignorables",
      font: "ABeeZee-Regular.ttf",
      text: "A\u200d\u200eB",
    },
  ];
  for (const entry of cases) {
    const font = resolve(root, "test/fixtures", entry.font);
    entry.fontSha256 = createHash("sha256")
      .update(await readFile(font))
      .digest("hex");
    const input = resolve(output, "text.utf16");
    await writeFile(input, Buffer.from(entry.text, "utf16le"));
    const features = Object.entries(entry.features ?? {})
      .map(([tag, value]) => `${tag}=${Number(value)}`)
      .join(",");
    entry.expected = JSON.parse(
      run(executable, [font, input, features], {
        encoding: "utf8",
        stdio: "pipe",
      }),
    );
  }
  await writeFile(
    resolve(root, "test/fixtures/shaping-reference.json"),
    JSON.stringify(
      {
        harfbuzz: lock.harfbuzz,
        method:
          "native/reference.cpp; direct native HarfBuzz without CRC wrapper",
        glyphColumns: [
          "id",
          "utf16Cluster",
          "xAdvance",
          "yAdvance",
          "xOffset",
          "yOffset",
        ],
        cases,
      },
      null,
      2,
    ) + "\n",
  );
  process.stdout.write(
    `Generated ${cases.length} native shaping reference cases.\n`,
  );
});
