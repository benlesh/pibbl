import { parse } from "@babel/parser";

function isThreeModule(moduleName: unknown): moduleName is string {
  return (
    typeof moduleName === "string" &&
    (moduleName === "@pibbl/three" ||
      moduleName === "three" ||
      moduleName.startsWith("three/"))
  );
}

/** Returns true only when source contains a real static Three module import. */
export function sourceImportsThree(source: string): boolean {
  // Avoid parsing the overwhelmingly common Pibbl-only lesson.
  if (!source.includes("three")) return false;

  try {
    const file = parse(source, {
      errorRecovery: true,
      plugins: ["typescript", "jsx"],
      sourceType: "module",
    });
    return file.program.body.some(
      (statement) =>
        statement.type === "ImportDeclaration" &&
        isThreeModule(statement.source.value),
    );
  } catch {
    // Incomplete editor input will be retried after the next edit.
    return false;
  }
}
