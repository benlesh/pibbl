import { Rectangle } from '@crc/core';
import { PhysicsWorld2D, staticBody2D } from '@crc/core/physics/2d';
import {
  createPhysicsTestHarness2D,
  type CRCPhysicsTestHarness2D,
  type CRCPhysicsTestHarness2DOptions,
} from '@crc/core/physics/2d/testing';

interface Observation {
  readonly floorPresent: boolean;
}

const canvas = document.createElement('canvas');
canvas.width = 240;
canvas.height = 120;
let floorPresent = false;
const options: CRCPhysicsTestHarness2DOptions<Observation> = {
  canvas,
  root: () => <PhysicsWorld2D gravity={[0, 300]}>
    <Rectangle
      physics={staticBody2D()}
      style={{ left: 10, top: 90, width: 220, height: 10, fill: '#334155' }}
    />
  </PhysicsWorld2D>,
  observe: () => ({ floorPresent }),
};

const harness: CRCPhysicsTestHarness2D<Observation> = createPhysicsTestHarness2D(options);
try {
  harness.flush();
  floorPresent = true;
  const frames = harness.advanceFrames(4, 1000 / 60);
  const observed = harness.observe();
  if (frames < 1 || !observed.floorPresent) {
    throw new Error('The physics scene did not advance as expected.');
  }
  harness.reset();
  harness.act(() => { floorPresent = true; });
} finally {
  harness.dispose();
}
