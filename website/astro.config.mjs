import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  output: "static",
  devToolbar: { enabled: false },
  integrations: [
    starlight({
      title: "CRC",
      description:
        "Build Canvas applications or add CRC effects to your HTML site.",
      pagefind: false,
      customCss: ["./src/style.css"],
      components: { MarkdownContent: "./src/components/ContentPanel.astro" },
      sidebar: [
        { label: "Start", link: "/start/" },
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
