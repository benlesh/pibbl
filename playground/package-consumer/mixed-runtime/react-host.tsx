/** @jsxImportSource react */
import {
  pibbl,
  createElement as createPibblElement,
  type PibblElement,
} from '@pibbl/core';
import type { ReactElement } from 'react/jsx-runtime';
import { Poster, type PosterProps } from './pibbl-scene.pibbl.js';

declare const canvas: HTMLCanvasElement;

export function ReactHost(): ReactElement {
  const scene: PibblElement<PosterProps> = createPibblElement(Poster, {
    title: 'Pibbl',
  });
  pibbl(canvas, scene);

  return <canvas width={240} height={120} />;
}

export function InvalidPibblMount(host: ReactElement): void {
  // @ts-expect-error a React-runtime element cannot be mounted by Pibbl
  pibbl(canvas, host);
}

export function InvalidReactHost(): ReactElement {
  const scene = createPibblElement(Poster, { title: 'Pibbl' });
  // @ts-expect-error a Pibbl element cannot be returned from a React component
  return scene;
}
