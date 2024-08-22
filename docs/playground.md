---
layout: doc
---

<script setup>
import LoadExample from './components/LoadExample.vue'
import { ref } from 'vue'
const globResult = ref(null)

const examples = Object.entries(import.meta.glob('./examples/**/*.{js,ts}', { eager: true }))
</script>

## Examples

<div v-for="[fileName, exampleModule] in examples">
  <h3>{{ exampleModule.name ? exampleModule.name : fileName }}</h3>
  <ClientOnly>
    <LoadExample
      :fileName="fileName"
      :exampleName="exampleModule.name"
      :exampleModule="exampleModule" />
  </ClientOnly>
</div>
