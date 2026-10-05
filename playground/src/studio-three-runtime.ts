import { defineThreeLayer } from "@pibbl/three";
import {
  Color,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhongMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export const pibblStudioThreeModules = Object.freeze({
  "@pibbl/three": Object.freeze({ defineThreeLayer }),
  three: Object.freeze({
    Color,
    HemisphereLight,
    IcosahedronGeometry,
    InstancedMesh,
    Matrix4,
    Mesh,
    MeshPhongMaterial,
    PerspectiveCamera,
    Raycaster,
    Scene,
    Vector2,
  }),
  "three/addons/controls/OrbitControls.js": Object.freeze({ OrbitControls }),
});
