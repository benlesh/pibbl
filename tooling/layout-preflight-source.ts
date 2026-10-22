import type { Plugin } from 'vite';
import { buildLayoutPreflightLab } from './build-layout-preflight-lab.mjs';

/** Lazy deterministic lab bundle using the same public entries as its CLI check. */
export function layoutPreflightSource(mode: string): Plugin {
  const id = 'virtual:pibbl-layout-preflight';
  return {
    name: 'pibbl-layout-preflight',
    resolveId(source) { if (source === id) return `\0${id}`; },
    async load(source) {
      if (source !== `\0${id}`) return;
      const lab = await buildLayoutPreflightLab(mode === 'layout-wasm-built');
      const proof = { mode, coreInputs: lab.coreInputs };
      const html = '<!doctype html><meta charset="utf-8"><style>body{font:16px system-ui;margin:24px}button{margin:12px;padding:10px}canvas{margin:12px}</style><script type="module">' +
        `globalThis.__PIBBL_PREFLIGHT_PROOF__=${JSON.stringify(proof)};\n` + lab.source.replace(/<\/script/gi, '<\\/script') + '</script>';
      return `export default ${JSON.stringify(html)};`;
    },
  };
}
