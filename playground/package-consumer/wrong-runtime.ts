import type { JSX as DevelopmentJSX } from '@pibbl/core/jsx-dev-runtime';
import type { JSX as ProductionJSX } from '@pibbl/core/jsx-runtime';

export type CompilerSubpathElements = [
  ProductionJSX.Element,
  DevelopmentJSX.Element,
];

// @ts-expect-error internal declaration modules are outside the public export map
import type { PibblElement as InternalElement } from '@pibbl/core/lib/element/types';
// @ts-expect-error package source modules are outside the public export map
import type { PibblElementSource } from '@pibbl/core/src/lib/element/metadata';
void (undefined as unknown as InternalElement);
void (undefined as unknown as PibblElementSource);
