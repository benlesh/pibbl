import type { PibblNode } from '@pibbl/core';
import type { ReactElement } from './react-stub/jsx-runtime';
import { pibblScene } from './pibbl-scene.pibbl';
import { reactScene } from './react-scene';

declare function mountPibbl(node: PibblNode): void;
declare function mountReact(node: ReactElement): void;

mountPibbl(pibblScene);
mountReact(reactScene);

// @ts-expect-error React elements are not Pibbl nodes
mountPibbl(reactScene);
// @ts-expect-error Pibbl elements are not React elements
mountReact(pibblScene);
