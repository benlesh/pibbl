/** @internal Build-time development gate; raw ESM without Vite is production-like. */
export const isDevelopment = (
  import.meta as ImportMeta & { env?: { readonly DEV?: boolean } }
).env?.DEV ?? false;
