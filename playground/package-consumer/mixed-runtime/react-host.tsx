/** @jsxImportSource react */
import {
  crc,
  createElement as createCRCElement,
  type CRCElement,
} from '@crc/core';
import type { ReactElement } from 'react/jsx-runtime';
import { Poster, type PosterProps } from './crc-scene.crc.js';

declare const canvas: HTMLCanvasElement;

export function ReactHost(): ReactElement {
  const scene: CRCElement<PosterProps> = createCRCElement(Poster, {
    title: 'CRC',
  });
  crc(canvas, scene);

  return <canvas width={240} height={120} />;
}

export function InvalidCRCMount(host: ReactElement): void {
  // @ts-expect-error a React-runtime element cannot be mounted by CRC
  crc(canvas, host);
}

export function InvalidReactHost(): ReactElement {
  const scene = createCRCElement(Poster, { title: 'CRC' });
  // @ts-expect-error a CRC element cannot be returned from a React component
  return scene;
}
