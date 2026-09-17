import { type PrimitiveInputOf } from '@crc/core';
import { describe, expect, it } from 'vitest';
import * as webgl from './index.js';
import {
  Model,
  type CRCWebGLAsset,
  type ModelProps,
  type ModelStyle,
} from './index.js';

describe('@crc/webgl public asset vocabulary', () => {
  it('exports only the opaque asset bounds and Model authoring surface', () => {
    type ModelInput = PrimitiveInputOf<typeof Model>;
    const typeContract = (
      asset: CRCWebGLAsset,
      props: ModelProps,
      style: ModelStyle,
    ) => {
      const input: ModelInput = { ...props, asset, style };
      const min: readonly [number, number, number] = asset.bounds.min;
      // @ts-expect-error decoded primitive records stay internal.
      const primitives = asset.primitives;
      return { input, min, primitives };
    };
    void typeContract;

    expect(Model).toBeTypeOf('function');
    expect(webgl).not.toHaveProperty('createInternalWebGLAsset');
    expect(webgl).not.toHaveProperty('getInternalWebGLAssetData');
    expect(webgl).not.toHaveProperty('acquireInternalWebGLAsset');
    expect(webgl).not.toHaveProperty('releaseInternalWebGLAsset');
  });
});

// @ts-expect-error internal asset records are not root-package types.
type LeakedAssetData = import('./index.js').CRCWebGLAssetData;
// @ts-expect-error internal asset constructors are not root-package values.
const leakedConstructor = webgl.createInternalWebGLAsset;
void (undefined as unknown as LeakedAssetData);
void leakedConstructor;
