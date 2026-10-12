import { pibbl } from "@pibbl/core";
import { defineThreeLayer, type PibblThreeInputBridge } from "@pibbl/three";
import {
  BoxGeometry,
  Mesh,
  MeshNormalMaterial,
  PerspectiveCamera,
  Scene,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 220;
const status = document.createElement("p");
status.textContent = "Drag the cube to orbit the camera.";
document.body.append(canvas, status);

const OrbitLayer = defineThreeLayer<
  {},
  {
    scene: Scene;
    camera: PerspectiveCamera;
    mesh: Mesh<BoxGeometry, MeshNormalMaterial>;
    controls: OrbitControls;
  }
>({
  create(context) {
    const scene = new Scene();
    const camera = new PerspectiveCamera(60, 320 / 220, 0.1, 100);
    camera.position.set(2.5, 1.8, 4);
    camera.lookAt(0, 0, 0);
    const mesh = new Mesh(
      new BoxGeometry(1.7, 1.7, 1.7),
      new MeshNormalMaterial(),
    );
    scene.add(mesh);
    const input: PibblThreeInputBridge = context.input;
    const controls = input.connect(
      (element) => new OrbitControls(camera, element),
    );
    controls.addEventListener("change", () => {
      status.textContent = `Camera azimuth: ${controls.getAzimuthalAngle().toFixed(2)} radians`;
      context.invalidate();
    });
    return { scene, camera, mesh, controls };
  },
  resize(resources, size) {
    resources.camera.aspect = size.width / size.height;
    resources.camera.updateProjectionMatrix();
  },
  targets(resources) {
    return [{ object: resources.mesh, cursor: "grab" }];
  },
  dispose(resources) {
    resources.controls.dispose();
    resources.mesh.geometry.dispose();
    resources.mesh.material.dispose();
  },
});

const controller = pibbl(
  canvas,
  <OrbitLayer style={{ width: 320, height: 220 }} />,
);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
