import type { JSX as DevelopmentJSX } from '@crc/core/jsx-dev-runtime';
import type { JSX as ProductionJSX } from '@crc/core/jsx-runtime';

export type CompilerSubpathElements = [
  ProductionJSX.Element,
  DevelopmentJSX.Element,
];

// @ts-expect-error internal declaration modules are outside the public export map
import type { CRCElement as InternalElement } from '@crc/core/lib/element/types';
// @ts-expect-error package source modules are outside the public export map
import type { CRCElementSource } from '@crc/core/src/lib/element/metadata';
void (undefined as unknown as InternalElement);
void (undefined as unknown as CRCElementSource);
