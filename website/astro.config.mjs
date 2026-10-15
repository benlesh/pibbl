import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import { pibblRuntimeSource } from "../tooling/pibbl-runtime-source.ts";
import { textAssets } from "../tooling/text-assets.ts";

export default defineConfig({
  site: "https://pibbl.com",
  output: "static",
  devToolbar: { enabled: false },
  vite: {
    plugins: [pibblRuntimeSource("built"), textAssets()],
    server: { headers: { "Access-Control-Allow-Origin": "*" } },
  },
  integrations: [
    starlight({
      title: "Pibbl",
      logo: {
        light: "./src/assets/pibbl-logo-light.svg",
        dark: "./src/assets/pibbl-logo-dark.svg",
        alt: "",
        replacesTitle: true,
      },
      description:
        "Build Canvas applications or add Pibbl effects to your HTML site.",
      pagefind: false,
      customCss: ["./src/style.css"],
      components: {
        PageTitle: "./src/components/PageTitle.astro",
        MarkdownContent: "./src/components/ContentPanel.astro",
        Search: "./src/components/Search.astro",
      },
      sidebar: [
        { label: "Start", link: "/start/" },
        { label: "Data Visualization", link: "/visualization/" },
        { label: "Reference", link: "/reference/" },
        { label: "Visual Catalogs", link: "/catalogs/" },
        { label: "Guides", link: "/guides/" },
        { label: "Examples", link: "/examples/" },
        { label: "Agents & Skills", link: "/agents/" },
        { label: "Playground", link: "/playground/" },
      ],
    }),
  ],
});
