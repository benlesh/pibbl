/** @jsxImportSource @crc/core */
import {
  Rectangle,
  Text,
  crc,
  useSignal,
  type CRCController,
} from '@crc/core';
import {
  Cube,
  Group3D,
  Sphere,
  WebGLLayer,
  useAnimationFrame,
} from '@crc/webgl';

function WebGLIslandLesson() {
  const selection = useSignal<'cube' | 'sphere' | 'none'>('none');
  const timestamp = useAnimationFrame();
  const rotation = (timestamp / 30) % 360;

  return (
    <>
      <Rectangle
        pointerEvents="none"
        style={{ width: 720, height: 420, fill: '#101827' }}
      />
      <WebGLLayer style={{ width: 720, height: 420 }}>
        <Group3D style={{ rotationYDegrees: rotation }}>
          <Cube
            style={{
              size: 1.35,
              translateX: -0.9,
              color: selection.get() === 'cube' ? '#fbbf24' : '#8b5cf6',
              cursor: 'pointer',
              lit: false,
            }}
            onClick={() => selection.set('cube')}
          />
          <Sphere
            style={{
              radius: 0.7,
              translateX: 0.95,
              color: selection.get() === 'sphere' ? '#fb7185' : '#22c55e',
              cursor: 'pointer',
              lit: false,
            }}
            onClick={() => selection.set('sphere')}
          />
        </Group3D>
      </WebGLLayer>
      <Text
        pointerEvents="none"
        style={{
          x: 32,
          y: 34,
          fill: '#f8fafc',
          font: '700 22px Arial',
        }}
      >
        WebGL islands
      </Text>
      <Text
        pointerEvents="none"
        style={{
          x: 32,
          y: 64,
          fill: '#cbd5e1',
          font: '15px Arial',
        }}
      >
        Children compose one scene · renderer runs after composition
      </Text>
      <Text
        pointerEvents="none"
        style={{
          x: 32,
          y: 392,
          fill: '#f8fafc',
          font: '600 14px Arial',
        }}
      >
        {selection.get() === 'none'
          ? 'Click the cube or sphere'
          : `Selected: ${selection.get()}`}
      </Text>
    </>
  );
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <WebGLIslandLesson />);
}
