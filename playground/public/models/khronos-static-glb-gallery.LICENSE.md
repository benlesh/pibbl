# Khronos static GLB gallery provenance

These files are deterministic CRC-compatible derivatives of models from
[KhronosGroup/glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets) at revision `c6a6bd13ab2b3c685c7903d03561b8a9392f38b8`.

| Model         | Authors                             | License | Source entry SHA-256                                               | Derived SHA-256                                                    |     Bytes |
| ------------- | ----------------------------------- | ------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ | --------: |
| Avocado       | Microsoft                           | CC0-1.0 | `ccc9c3ce56423720b09399c2351537207cd5a65f859f9e6e2f30922762f3abd4` | `95b5c784681a30950386f9e9440ee4baf40fc67701242974e3bfdea1847b064b` |   125,592 |
| Boom Box      | Microsoft                           | CC0-1.0 | `f8b918445ebdd006768232205a62f5182d2208ca57f84c6ccc084943c0bc8f15` | `fe87fc08d7fc0f62f31a2af7530a6b1601277211fbe4e5330d5a88631294457e` |   200,460 |
| Toy Car       | Guido Odendahl and Eric Chadwick    | CC0-1.0 | `01a60862de55cd4b9f3acfab0b0def86451800f9c42467fcd61052c16cb9838c` | `b559f11fd25559226ce8fbcd73e5f8f8d58411481116baa12fd52ecfaf3a9077` | 3,812,832 |
| Sci-Fi Helmet | Michael Pavlovic and Norbert Nopper | CC0-1.0 | `dac3b461d2a6ce956eb2452cccb14bfbb49cbb2774ae55464346a9a171ade089` | `525aa98ecc8cbd0af767588303aa09cbb4754ed8d169ccb0ca2c90ebab436267` | 2,618,920 |

Every model is dedicated under Creative Commons Zero 1.0 by its listed
authors. The full license is available at
<https://creativecommons.org/publicdomain/zero/1.0/>.

## Reproduction

Run `node tooling/prepare-static-glb-gallery.mjs`. The pinned pipeline uses
glTF Transform 4.5.0 and Sharp 0.35.4. It bundles external resources, removes
animation, skins, cameras, morph targets, unsupported vertex streams,
normal/occlusion/emissive maps, and extension-only material properties; keeps
triangle geometry, hierarchy, UV0, base-color textures, and metallic/roughness
factors; limits base-color textures to 512×512; prunes unused resources; and
normalizes each selected scene to a centered 2.4-unit footprint on y=0.

## Upstream sources

- **Avocado:** https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/c6a6bd13ab2b3c685c7903d03561b8a9392f38b8/Models/Avocado/glTF-Binary/Avocado.glb
- **Boom Box:** https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/c6a6bd13ab2b3c685c7903d03561b8a9392f38b8/Models/BoomBox/glTF-Binary/BoomBox.glb
- **Toy Car:** https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/c6a6bd13ab2b3c685c7903d03561b8a9392f38b8/Models/ToyCar/glTF-Binary/ToyCar.glb
- **Sci-Fi Helmet:** https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/c6a6bd13ab2b3c685c7903d03561b8a9392f38b8/Models/SciFiHelmet/glTF/SciFiHelmet.gltf
