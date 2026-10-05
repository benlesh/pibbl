import { learningExampleCatalog } from "../packages/scenarios/src/learning-catalog.ts";

export const galleries = [
  {
    id: "text",
    title: "Text and typography",
    slugs: ["text", "text-geometry", "text-envelope"],
  },
  {
    id: "shapes",
    title: "Shapes",
    slugs: [
      "rectangle",
      "circle",
      "ellipse",
      "arc",
      "line",
      "wedge",
      "horizontal-line",
      "vertical-line",
      "polygon",
      "regular-polygon",
      "star",
      "path",
      "svg-path",
    ],
  },
  {
    id: "textures",
    title: "Textures and electric effects",
    slugs: ["material-lab", "plasma-globe", "rainy-window", "underwater"],
  },
  {
    id: "reaction-diffusion",
    title: "Reaction-diffusion",
    slugs: ["living-ink", "growing-reveal", "stirred-ink"],
  },
  {
    id: "transitions",
    title: "Enter and exit transitions",
    slugs: ["visibility-transitions", "energy-transitions", "embers-physics"],
  },
  {
    id: "path-geometry",
    title: "PathGeometry transformations",
    slugs: [
      "path-geometry",
      "path-warp",
      "path-bending",
      "along-path",
      "text-envelope",
    ],
  },
  { id: "filters", title: "Filters", slugs: ["filters", "optional-filters"] },
  {
    id: "showcases",
    title: "Interactive showcases",
    slugs: [
      "rainy-window",
      "plasma-globe",
      "underwater",
      "stirred-ink",
      "growing-reveal",
      "energy-transitions",
      "fire-and-flow",
      "physics-panels",
      "text-envelope",
      "text-geometry",
      "signals-and-animation",
    ],
  },
];
const slugs = new Set(galleries.flatMap((gallery) => gallery.slugs));
export const galleryExamples = learningExampleCatalog.filter((example) =>
  slugs.has(example.slug),
);
for (const slug of slugs) {
  if (!galleryExamples.some((example) => example.slug === slug))
    throw new Error(`Missing gallery example ${slug}`);
}
