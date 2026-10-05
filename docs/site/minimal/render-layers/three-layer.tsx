import { pibbl } from "@pibbl/core";
import {
  defineThreeLayer,
  type PibblThreeLayerContext,
  type PibblThreeLayerDefinition,
  type PibblThreeLayerResources,
  type PibblThreePicker,
  type PibblThreePickResult,
  type PibblThreeRendererOptions,
  type PibblThreeTarget,
} from "@pibbl/three";
import {
  AmbientLight,
  BoxGeometry,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
} from "three";

interface BoxProps {
  readonly tint: string;
}
interface BoxResources extends PibblThreeLayerResources {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly mesh: Mesh<BoxGeometry, MeshStandardMaterial>;
  readonly raycaster: Raycaster;
  readonly invalidate: () => void;
}

const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 220;
const status = document.createElement("p");
status.textContent = "Click the cube to rotate it.";
document.body.append(canvas, status);

const renderer: PibblThreeRendererOptions = { antialias: true };
const definition: PibblThreeLayerDefinition<BoxProps, BoxResources> = {
  renderer,
  create(context: PibblThreeLayerContext, props) {
    const scene = new Scene();
    const camera = new PerspectiveCamera(60, 320 / 220, 0.1, 100);
    camera.position.set(2.5, 1.8, 4);
    camera.lookAt(0, 0, 0);
    const mesh = new Mesh(
      new BoxGeometry(1.7, 1.7, 1.7),
      new MeshStandardMaterial({ color: props.tint, roughness: 0.6 }),
    );
    const light = new DirectionalLight("#ffffff", 2.4);
    light.position.set(3, 5, 6);
    scene.add(new AmbientLight("#ffffff", 1.1), light, mesh);
    return {
      scene,
      camera,
      mesh,
      raycaster: new Raycaster(),
      invalidate: context.invalidate,
    };
  },
  update(resources, props) {
    resources.mesh.material.color.set(props.tint);
  },
  resize(resources, size) {
    resources.camera.aspect = size.width / size.height;
    resources.camera.updateProjectionMatrix();
  },
  render(resources, _frame, context) {
    context.renderer.render(resources.scene, resources.camera);
  },
  targets(resources): readonly PibblThreeTarget[] {
    return [
      {
        object: resources.mesh,
        cursor: "pointer",
        handlers: {
          onClick() {
            resources.mesh.rotation.y += Math.PI / 8;
            status.textContent = `Cube rotation: ${resources.mesh.rotation.y.toFixed(2)} radians`;
            resources.invalidate();
          },
        },
      },
    ];
  },
  pick(resources, context): PibblThreePicker {
    return (point) => {
      const x = (point.x / context.size.width) * 2 - 1;
      const y = 1 - (point.y / context.size.height) * 2;
      resources.raycaster.setFromCamera(new Vector2(x, y), resources.camera);
      const result: PibblThreePickResult = resources.raycaster.intersectObject(
        resources.mesh,
      ).length
        ? { kind: "target", target: resources.mesh }
        : { kind: "miss" };
      return result;
    };
  },
  dispose(resources) {
    resources.mesh.geometry.dispose();
    resources.mesh.material.dispose();
  },
};

const BoxLayer = defineThreeLayer(definition);
const controller = pibbl(
  canvas,
  <BoxLayer tint="#0f766e" style={{ width: 320, height: 220 }} />,
);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
