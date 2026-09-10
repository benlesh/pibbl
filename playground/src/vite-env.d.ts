/// <reference types="vite/client" />

declare const __CRC_STUDIO_DOCS_ACCEPTANCE__: boolean;

declare module "virtual:crc-runtime-source" {
  const source: string;
  export default source;
}

declare module "monaco-editor/languages/features/typescript/tsMode" {
  import type { LanguageServiceDefaults } from "monaco-editor/languages/features/typescript/register";
  export function setupTypeScript(defaults: LanguageServiceDefaults): void;
}
