<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { render } from '../examples/rect'

const props = defineProps<{
  exampleName: string,
  fileName: string,
  exampleModule: typeof Module
}>()

const canvas = ref<HTMLCanvasElement | null>(null)

onMounted(async () => {
  if (props.exampleModule && typeof props.exampleModule.render === 'function') {
    props.exampleModule.render(canvas.value)
  }
})

</script>

<template>
  <canvas ref="canvas"></canvas>
</template>
