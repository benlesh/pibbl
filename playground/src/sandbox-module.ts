const SUPPORTED_CRC_MODULES = new Set([
  "@crc/core",
  "@crc/core/jsx-runtime",
  "@crc/core/jsx-dev-runtime",
]);

const IDENTIFIER = "[$A-Z_a-z][$0-9A-Z_a-z]*";
const STATIC_IMPORT =
  /^[\t ]*import\s+([^;]+?)\s+from\s+(['"])([^'"\n]+)\2\s*;[\t ]*$/gmu;
const DEFAULT_MOUNT =
  /^[\t ]*export\s+default\s+function\s+mount\s*\(\s*canvas\s*\)/gmu;

function invalidModuleShape(): Error {
  return new Error(
    "Lessons may contain named imports only from @crc/core, " +
      "@crc/core/jsx-runtime, and @crc/core/jsx-dev-runtime, plus exactly " +
      "one default mount(canvas) export.",
  );
}

function parseNamedBindings(clause: string): string[] {
  const named = /^\{([\s\S]*)\}$/u.exec(clause.trim());
  if (!named) throw invalidModuleShape();
  const bindings = named[1]
    ?.split(",")
    .map((binding) => binding.trim())
    .filter(Boolean);
  if (!bindings?.length) throw invalidModuleShape();

  return bindings.map((binding) => {
    const match = new RegExp(
      `^(${IDENTIFIER})(?:\\s+as\\s+(${IDENTIFIER}))?$`,
      "u",
    ).exec(binding);
    if (!match || match[1] === "default") throw invalidModuleShape();
    const imported = match[1];
    const local = match[2];
    return local ? `${imported}: ${local}` : imported;
  });
}

export function toRunnableScript(emittedCode: string): string {
  const bindings: string[] = [];
  let runnable = emittedCode.replace(
    STATIC_IMPORT,
    (_statement, clause: string, _quote: string, moduleName: string) => {
      if (!SUPPORTED_CRC_MODULES.has(moduleName)) throw invalidModuleShape();
      bindings.push(...parseNamedBindings(clause));
      return "";
    },
  );
  const mountExports = [...runnable.matchAll(DEFAULT_MOUNT)];
  if (bindings.length === 0 || mountExports.length !== 1) {
    throw invalidModuleShape();
  }
  runnable = runnable
    .replace(DEFAULT_MOUNT, "function mount(canvas)")
    .replace(/export\s*\{\s*\};?/gu, "");
  if (/\b(?:import|export)\b/gu.test(runnable)) throw invalidModuleShape();
  return `const { ${bindings.join(", ")} } = CRC_CORE;\n${runnable}\nglobalThis.__CRC_EXAMPLE_MOUNT__ = mount;`;
}
