/// <reference types="vite/client" />

declare module "virtual:crc-runtime-source" {
  const source: string;
  export default source;
}

declare module "monaco-editor/languages/features/typescript/tsMode" {
  import type { LanguageServiceDefaults } from "monaco-editor/languages/features/typescript/register";
  export function setupTypeScript(defaults: LanguageServiceDefaults): void;
}
