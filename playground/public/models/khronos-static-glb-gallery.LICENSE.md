# Khronos static GLB gallery provenance

These files are deterministic CRC-compatible derivatives of models from
[KhronosGroup/glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets) at revision `c6a6bd13ab2b3c685c7903d03561b8a9392f38b8`.

| Model         | Authors                             | License | Source entry SHA-256                                               | Derived SHA-256                                                    |     Bytes |
| ------------- | ----------------------------------- | ------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ | --------: |
| Avocado       | Microsoft                           | CC0-1.0 | `ccc9c3ce56423720b09399c2351537207cd5a65f859f9e6e2f30922762f3abd4` | `ce8feac0dd5f79e3b3b5b8c6a101cfc47fdcc09d5573839225baa28893d2504a` |   125,664 |
| Boom Box      | Microsoft                           | CC0-1.0 | `f8b918445ebdd006768232205a62f5182d2208ca57f84c6ccc084943c0bc8f15` | `508d95d2884fe01e00bc07a3776dd4eebbe97eadb0d68d23b151ccd2ce8c1bb6` |   200,536 |
| Toy Car       | Guido Odendahl and Eric Chadwick    | CC0-1.0 | `01a60862de55cd4b9f3acfab0b0def86451800f9c42467fcd61052c16cb9838c` | `64bf924cd6f22da2c6c22b35c8c5af09505f84b9dce86a0ed414d669270435f7` | 3,812,908 |
| Sci-Fi Helmet | Michael Pavlovic and Norbert Nopper | CC0-1.0 | `dac3b461d2a6ce956eb2452cccb14bfbb49cbb2774ae55464346a9a171ade089` | `7fbdd1dca1a75001e5f21272797731ba7a561ae37a017b0f55e85ec22e756532` | 2,618,992 |

Every model is dedicated under Creative Commons Zero 1.0 by its listed
authors. The full license is available at
<https://creativecommons.org/publicdomain/zero/1.0/>.

## Reproduction

Run `node tooling/prepare-static-glb-gallery.mjs`. The pinned pipeline uses
glTF Transform 4.5.0 and Sharp 0.35.4. It bundles external resources, removes
animation, skins, cameras, morph targets, unsupported vertex streams,
normal/occlusion/emissive maps, and extension-only material properties; keeps
triangle geometry, hierarchy, UV0, and base-color textures; bakes removed
metallic/roughness textures into average scalar factors; limits base-color
textures to 512×512; prunes unused resources; and
normalizes each selected scene to a centered 2.4-unit footprint on y=0.

## Upstream sources

- **Avocado:** https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/c6a6bd13ab2b3c685c7903d03561b8a9392f38b8/Models/Avocado/glTF-Binary/Avocado.glb
- **Boom Box:** https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/c6a6bd13ab2b3c685c7903d03561b8a9392f38b8/Models/BoomBox/glTF-Binary/BoomBox.glb
- **Toy Car:** https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/c6a6bd13ab2b3c685c7903d03561b8a9392f38b8/Models/ToyCar/glTF-Binary/ToyCar.glb
- **Sci-Fi Helmet:** https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/c6a6bd13ab2b3c685c7903d03561b8a9392f38b8/Models/SciFiHelmet/glTF/SciFiHelmet.gltf
