import {
  crc,
  createElement,
  type CRCNode,
  type PrimitiveInputOf,
} from '@crc/core';
import {
  executeBackendCRC,
  mountBackendCRC,
  type CRCBackendDriver,
  type CRCBackendPrimitiveProgram,
} from '@crc/core/internal';
import { describe, expect, it } from 'vitest';
import { Group3D, WebGLBackground } from '../../index.js';
import { WEBGL_BACKEND_TOKEN } from '../backend.js';
import { resolveCamera } from '../math/camera.js';
import {
  closeWebGLSceneComposer,
  createWebGLSceneComposer,
  discardWebGLSceneComposer,
} from '../scene/composer.js';
import type { WebGLSceneComposer } from '../scene/types.js';

describe('WebGLBackground declaration', () => {
  it('requires and resolves one concrete color into a target-free draft', () => {
    const scene = compose(
      <WebGLBackground style={{ color: 'rgb(8 17 31 / 75%)' }} />,
    );

    expect(scene.backgrounds).toEqual([expect.objectContaining({
      kind: 'background',
      color: [8 / 255, 17 / 255, 31 / 255, 191 / 255],
    })]);
    expect('target' in scene.backgrounds[0]!).toBe(false);
  });

  it('ignores Group3D transforms and JSX position in draft semantics', () => {
    const nested = compose(
      <Group3D style={{ translateX: 99, rotationYDegrees: 90 }}>
        <WebGLBackground style={{ color: '#08111f' }} />
      </Group3D>,
    );
    const direct = compose(createElement(WebGLBackground, {
      style: { color: '#08111f' },
    }));

    expect(nested.backgrounds[0]).toMatchObject({
      kind: direct.backgrounds[0]!.kind,
      color: direct.backgrounds[0]!.color,
    });
    expect('model' in nested.backgrounds[0]!).toBe(false);
  });

  it.each([
    [createElement(WebGLBackground, {} as never), /WebGLBackground.*style\.color.*required/i],
    [createElement(WebGLBackground, { style: {} } as never), /WebGLBackground.*style\.color.*required/i],
    [createElement(WebGLBackground, { style: { color: 'currentColor' } }), /WebGLBackground.*color.*contextual/i],
    [createElement(WebGLBackground, { style: { color: 'not-a-color' } }), /WebGLBackground.*color.*concrete/i],
    [createElement(WebGLBackground, { style: { color: '#000', opacity: 1 } } as never), /WebGLBackground.*style\.opacity.*not supported/i],
    [createElement(WebGLBackground, { onClick() {}, style: { color: '#000' } } as never), /WebGLBackground.*prop\.onClick.*not supported/i],
  ])('rejects invalid or unknown untyped input %#', (root, message) => {
    expect(() => compose(root)).toThrowError(message);
  });

  it('rejects child, event, focus, pointer, transform, cursor, and filter fields at compile time', () => {
    type BackgroundInput = PrimitiveInputOf<typeof WebGLBackground>;
    const typeContract = () => {
      const child: BackgroundInput = {
        style: { color: '#000' },
        // @ts-expect-error Background declarations do not accept children.
        children: undefined,
      };
      const event: BackgroundInput = {
        style: { color: '#000' },
        // @ts-expect-error Background declarations do not accept events.
        onClick() {},
      };
      const focus: BackgroundInput = {
        style: { color: '#000' },
        // @ts-expect-error Background declarations do not accept focus props.
        keyboardFocusable: true,
      };
      const pointer: BackgroundInput = {
        style: { color: '#000' },
        // @ts-expect-error Background declarations do not accept pointer props.
        pointerEvents: 'none',
      };
      const transform: BackgroundInput = {
        style: {
          color: '#000',
          // @ts-expect-error Background declarations are transform-free.
          translateX: 1,
        },
      };
      const cursor: BackgroundInput = {
        style: {
          color: '#000',
          // @ts-expect-error Background declarations do not accept cursor styles.
          cursor: 'pointer',
        },
      };
      const filter: BackgroundInput = {
        style: {
          color: '#000',
          // @ts-expect-error Background declarations do not accept filters.
          filter: { type: 'blur', radius: 1 },
        },
      };
      return { child, event, focus, pointer, transform, cursor, filter };
    };
    void typeContract;
  });
});

function compose(root: CRCNode) {
  let completed: ReturnType<typeof closeWebGLSceneComposer> | undefined;
  const driver: CRCBackendDriver<WebGLSceneComposer> = {
    token: WEBGL_BACKEND_TOKEN,
    name: 'webgl-test-composer',
    beginFrame(frame) {
      return {
        environment: createWebGLSceneComposer({
          frame,
          camera: resolveCamera(undefined, frame.logicalWidth, frame.logicalHeight),
          contextGeneration: 1,
        }),
      };
    },
    enterComponent() {
      return () => undefined;
    },
    runPrimitive(frame, input, runProgram) {
      const program = input.definition.program as CRCBackendPrimitiveProgram<
        Record<PropertyKey, unknown>,
        Record<PropertyKey, unknown>,
        WebGLSceneComposer
      >;
      runProgram(() => program(input.props, input.style, frame.environment));
    },
    finishFrame(frame, success) {
      if (success) completed = closeWebGLSceneComposer(frame.environment);
      else discardWebGLSceneComposer(frame.environment);
    },
    dispose() {},
  };
  const parentCanvas = document.createElement('canvas');
  const parent = crc(parentCanvas, undefined);
  const mount = mountBackendCRC(new OffscreenCanvas(16, 16), root, {
    parent: parentCanvas,
    logicalWidth: 16,
    logicalHeight: 16,
    driver,
  });
  try {
    executeBackendCRC(mount, root, 1);
    if (!completed) throw new Error('test composer did not complete');
    return completed;
  } finally {
    mount.dispose();
    parent.dispose();
  }
}
