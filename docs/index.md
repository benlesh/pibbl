---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: 'Canvas Render Components'
  text: 'CRC documentation.'
  tagline: My great project tagline
  actions:
    - theme: brand
      text: Markdown Examples
      link: /markdown-examples
    - theme: alt
      text: API Examples
      link: /api-examples

features:
  - title: Feature A
    details: Lorem ipsum dolor sit amet, consectetur adipiscing elit
  - title: Feature B
    details: Lorem ipsum dolor sit amet, consectetur adipiscing elit
  - title: Feature C
    details: Lorem ipsum dolor sit amet, consectetur adipiscing elit
---

<script setup>
import { defineAsyncComponent } from 'vue';
import { inBrowser } from 'vitepress';

const MonacoEditor = inBrowser
  ? defineAsyncComponent(() => import('./components/MonacoEditor.vue'))
  : () => null;
</script>

<MonacoEditor></MonacoEditor>
