/** @jsxImportSource @pibbl/core */
import type { PibblNode } from '@pibbl/core';

function PibblLeaf(_props: { value: string }): void {}

export function PibblScene(): PibblNode {
  return <PibblLeaf value="Pibbl" />;
}

export const pibblScene = <PibblScene />;
