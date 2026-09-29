/** @jsxImportSource @crc/core */
import {
  FocusManagement,
  Group,
  Rectangle,
  Text,
  crc,
  useSignal,
  type CRCController,
} from '@crc/core';
import { defineThreeLayer } from '@crc/three';
import {
  Color,
  HemisphereLight,
  IcosahedronGeometry,
  Mesh,
  MeshPhongMaterial,
  PerspectiveCamera,
  Scene,
} from 'three';

interface ThreeLayerProps {
  readonly turn: number;
  readonly onTarget: () => void;
}

interface ThreeLayerResources {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly blocker: Mesh<IcosahedronGeometry, MeshPhongMaterial>;
  readonly target: Mesh<IcosahedronGeometry, MeshPhongMaterial>;
}

const ThreeScene = defineThreeLayer<ThreeLayerProps, ThreeLayerResources>({
  renderer: { antialias: true },
  create() {
    const scene = new Scene();
    const camera = new PerspectiveCamera(45, 2, 0.1, 100);
    camera.position.set(0, 0, 7);

    scene.add(new HemisphereLight('#dbeafe', '#172554', 2.8));

    const blocker = new Mesh(
      new IcosahedronGeometry(1.05, 1),
      new MeshPhongMaterial({ color: new Color('#38bdf8'), shininess: 72 }),
    );
    blocker.position.x = -1.6;
    scene.add(blocker);

    const target = new Mesh(
      new IcosahedronGeometry(1.05, 1),
      new MeshPhongMaterial({
        color: new Color('#fbbf24'),
        emissive: new Color('#5b2500'),
        shininess: 96,
      }),
    );
    target.position.x = 1.6;
    scene.add(target);

    return { scene, camera, blocker, target };
  },
  update(resources, props) {
    resources.blocker.rotation.set(props.turn * 0.7, props.turn, 0);
    resources.target.rotation.set(props.turn, props.turn * 0.6, 0.2);
  },
  resize(resources, size) {
    resources.camera.aspect = size.width / size.height;
    resources.camera.updateProjectionMatrix();
  },
  targets(resources, props) {
    return [
      {
        object: resources.target,
        handlers: { onClick: props.onTarget },
        cursor: 'pointer',
        keyboardFocusable: true,
      },
    ];
  },
  dispose(resources) {
    resources.blocker.geometry.dispose();
    resources.blocker.material.dispose();
    resources.target.geometry.dispose();
    resources.target.material.dispose();
  },
});

function ThreeLayerLesson() {
  const state = useSignal({ backgroundClicks: 0, targetClicks: 0 });
  const current = state.get();
  const activateTarget = () =>
    state.update((value) => ({
      ...value,
      targetClicks: value.targetClicks + 1,
    }));

  return (
    <FocusManagement>
      <Group>
        <Rectangle
        style={{
          width: 720,
          height: 420,
          fill: '#0f2742',
          cursor: 'pointer',
        }}
        onClick={() =>
          state.update((value) => ({
            ...value,
            backgroundClicks: value.backgroundClicks + 1,
          }))
        }
        />
        <Group style={{ translateX: 70, translateY: 82 }}>
          <ThreeScene
            turn={current.targetClicks * 0.35}
            onTarget={activateTarget}
            missBehavior="pass-through"
            style={{
              width: 580,
              height: 260,
              filter: [
                {
                  type: 'dropShadow',
                  offsetX: 0,
                  offsetY: 10,
                  blurRadius: 18,
                  color: '#0009',
                },
              ],
            }}
          />
        </Group>
        <Text
        pointerEvents="none"
        style={{ x: 28, y: 36, fill: '#f8fafc', font: '700 22px Arial' }}
        >
          Three.js inside CRC
        </Text>
        <Text
        pointerEvents="none"
        style={{ x: 28, y: 62, fill: '#bfdbfe', font: '14px Arial' }}
        >
          Blue blocks the Canvas · gold is a CRC target · empty pixels pass through
        </Text>
        <Text
        pointerEvents="none"
        style={{ x: 28, y: 392, fill: '#f8fafc', font: '600 14px Arial' }}
        >
          {`Canvas ${current.backgroundClicks} · Three target ${current.targetClicks}`}
        </Text>
      </Group>
    </FocusManagement>
  );
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <ThreeLayerLesson />);
}
