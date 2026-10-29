import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { buildLayoutYogaRehearsalLab } from './build-layout-yoga-rehearsal-lab.mjs';

/** Supplies the private exhaustive Yoga replay as a deterministic Studio iframe. */
export function layoutYogaRehearsalSource(mode: string): Plugin {
  const id = 'virtual:pibbl-layout-yoga-rehearsal';
  return {
    name: 'pibbl-layout-yoga-rehearsal',
    resolveId(source) { if (source === id) return `\0${id}`; },
    async load(source) {
      if (source !== `\0${id}`) return;
      const yogaReference = JSON.parse(
        readFileSync(new URL('./layout-yoga-rehearsal/reference.json', import.meta.url), 'utf8'),
      );
      const built = mode === 'layout-wasm-built';
      const lab = await buildLayoutYogaRehearsalLab(built);
      for (const input of lab.inputs) this.addWatchFile(input);
      const proof = {
        mode: built ? 'layout-wasm-built' : 'source',
        fixtureSource: {
          version: yogaReference.version,
          commit: yogaReference.commit,
          licenseSha256: yogaReference.licenseSha256,
          probeSha256: yogaReference.probeSha256,
        },
        caseNames: yogaReference.cases.map((value: { name: string }) => value.name),
        coreInputs: lab.coreInputs,
      };
      const html = '<!doctype html><meta charset="utf-8"><title>Yoga layout rehearsal</title><style>body{margin:0;background:#fffdf6;font:14px system-ui}canvas{display:block;margin:auto}</style><script type="module">' +
        `globalThis.__PIBBL_YOGA_REHEARSAL_PROOF__=${JSON.stringify(proof)};\n` +
        lab.source.replace(/<\/script/gi, '<\\/script') +
        '</script>';
      return `export default ${JSON.stringify(html)};`;
    },
  };
}
