import { execFileSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const root = dirname(fileURLToPath(import.meta.url));
const commit = "042f5013152eb81c1552dec945b88f7b95ca350f";
const folder = join(root, "layout-yoga-rehearsal");
const recordPath = join(folder, "reference.json");
const sourceIndex = process.argv.indexOf("--source");
const source = sourceIndex < 0 ? undefined : process.argv[sourceIndex + 1];
const examplePath = join(
  root,
  "../packages/scenarios/src/learning/layout/wasm-yoga-migration.example.tsx",
);
if (sourceIndex >= 0 && (!source || source.startsWith("--")))
  throw new Error("--source requires a Yoga Git checkout path");
const writing = process.argv.includes("--write");
if (writing && !source)
  throw new Error("--write requires --source <Yoga Git checkout>");
if (process.argv.includes("--aspect-probe") && (!source || writing)) throw new Error("--aspect-probe requires --source and cannot use --write");
function run() {
let record = source ? undefined : JSON.parse(readFileSync(recordPath, "utf8"));
if (source) {
  const temporary = mkdtempSync(join(tmpdir(), "pibbl-yoga-3.2.1-"));
  try {
    execFileSync("tar", ["-x", "-C", temporary], {
      input: execFileSync(
        "git",
        [
          "-C",
          source,
          "archive",
          commit,
          "yoga",
          "LICENSE",
          "javascript/package.json",
        ],
        { maxBuffer: 8 * 1024 * 1024 },
      ),
    });
    const manifest = JSON.parse(
      readFileSync(join(temporary, "javascript/package.json"), "utf8"),
    );
    if (manifest.version !== "3.2.1" || manifest.license !== "MIT")
      throw new Error("Unexpected Yoga provenance");
    const files = [];
    function collect(directory) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) collect(path);
        else if (path.endsWith(".cpp")) files.push(path);
      }
    }
    collect(join(temporary, "yoga"));
    const executable = join(temporary, "reference");
    const aspectProbe = process.argv.includes("--aspect-probe");
    const probe = join(folder, aspectProbe ? "aspect-probe.cpp" : "reference.cpp");
    execFileSync("c++", [
      "-std=c++20",
      "-O2",
      "-I",
      temporary,
      probe,
      ...files.sort(),
      "-o",
      executable,
    ]);
    if (aspectProbe) {
      process.stderr.write(`Pinned Yoga 3.2.1 ${commit}; aspect probe SHA256 ${createHash("sha256").update(readFileSync(probe)).digest("hex")}\n`);
      process.stderr.write(execFileSync(executable, { encoding: "utf8" }));
      return;
    }
    record = {
      version: "3.2.1",
      commit,
      license: "MIT",
      licenseSha256: createHash("sha256")
        .update(readFileSync(join(temporary, "LICENSE")))
        .digest("hex"),
      probeSha256: createHash("sha256")
        .update(readFileSync(probe))
        .digest("hex"),
      configuration: {
        useWebDefaults: false,
        pointScaleFactor: 0,
        errata: "none",
        direction: "LTR except fixtures with explicit layoutDirection",
        flexDirection: "explicit row/column/reverse per case",
        alignItems: "explicit containerStyle when present; otherwise flex-start",
        alignContent: "explicit containerStyle when present; otherwise flex-start",
        flexWrap: "explicit nowrap/wrap/wrap-reverse per case",
        gap: "explicit numeric or allocated-axis percentage per case; nested owners use10%",
        shrink: "explicit itemStyles when present; nested outer items1 and inner leaves0; otherwise1 except floor/border cases0",
        comparison: "native boxes match except explicitly classified partial-factor/freeze, CSS safe-overflow reverse and preserved physical-margin cases; pibblBoxes are expected Pibbl contract geometry",
        padding: "explicit numeric/percentage item or container padding per case; asymmetric physical3/5/7/11 in border cases; otherwise0",
        boxSizing: "explicit item/container boxSizing per case; rectangle-percent-content-box uses content-box; otherwise Yoga default",
        border: "physical left2/right4/top6/bottom8 in asymmetric border cases; otherwise 0",
      },
      cases: JSON.parse(execFileSync(executable, { encoding: "utf8" })),
    };
    if (writing) {
      writeFileSync(recordPath, JSON.stringify(record, null, 2) + "\n");
      writeFileSync(
        join(folder, "YOGA-LICENSE"),
        readFileSync(join(temporary, "LICENSE")),
      );
    } else if (
      JSON.stringify(record) !==
      JSON.stringify(JSON.parse(readFileSync(recordPath, "utf8")))
    )
      throw new Error("Reference geometry/provenance changed");
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
if (
  record.licenseSha256 !==
  createHash("sha256")
    .update(readFileSync(join(folder, "YOGA-LICENSE")))
    .digest("hex")
)
  throw new Error("Yoga license receipt differs from source");
if (
  record.version !== "3.2.1" ||
  record.commit !== commit ||
  record.probeSha256 !==
    createHash("sha256")
      .update(readFileSync(join(folder, "reference.cpp")))
      .digest("hex")
)
  throw new Error("Stale reference provenance");
const example = readFileSync(examplePath, "utf8");
const pattern =
  /\/\/ BEGIN YOGA REFERENCE[\s\S]*?const fixtureCases = ([\s\S]*?) as const;[\s\S]*?\/\/ END YOGA REFERENCE/;
const match = example.match(pattern);
if (!match) throw new Error("Missing reference block in public example");
if (writing)
  writeFileSync(
    examplePath,
    example.replace(
      pattern,
      `// BEGIN YOGA REFERENCE\n  const fixtureCases = ${"[\n" + record.cases.map(value => "    " + JSON.stringify(value)).join(",\n") + "\n  ]"} as const;\n  // END YOGA REFERENCE`,
    ),
  );
else if (JSON.stringify(JSON.parse(match[1])) !== JSON.stringify(record.cases))
  throw new Error("Public reference differs from recorded Yoga geometry");
process.stdout.write(
  `${source ? "Reproduced" : "Checked recorded"} Yoga ${record.version} ${commit}: ${record.cases.map((value) => value.name + ":" + value.boxes.map((box) => `${box.width}×${box.height}@${box.x},${box.y}`).join("/")).join(", ")}\n`,
);

}
run();
