/** @jsxImportSource @crc/core */
import type { CRCNode } from '@crc/core';

function CRCLeaf(_props: { value: string }): void {}

export function CRCScene(): CRCNode {
  return <CRCLeaf value="CRC" />;
}

export const crcScene = <CRCScene />;
