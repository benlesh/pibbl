import { defineConfig } from "cypress";
import viteConfig from './core/vite.config';

export default defineConfig({
  env: {
    TAKE_SCREENSHOTS: process.env.CI || process.env.TAKE_SCREENSHOTS,
  },
  video: !!(process.env.CI || process.env.VIDEO),
  component: {
    devServer: {
      framework: 'dom' as unknown as 'react',
      bundler: "vite",
      viteConfig
    },
  },
});
