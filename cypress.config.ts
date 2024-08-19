import viteConfig from './core/vite.config'
import { defineConfig } from "cypress";

export default defineConfig({
  component: {
    devServer: {
      framework: 'dom' as unknown as 'react',
      bundler: "vite",
      viteConfig
    },
  },
});
