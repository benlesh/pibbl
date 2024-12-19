<script setup lang="ts">
import { ref } from 'vue';
import Button from './ui/button/button.vue';

const examples = [
  {
    name: 'Basic Button',
    code: `crc(canvas, GoodButton({
  x: 50,
  y: 50,
  width: 120,
  height: 40,
  label: "Click me!",
  onClick: (e) => {
    console.log('Button clicked!', e);
  }
}));`,
  },
  {
    name: 'Multiple Buttons',
    code: `crc(canvas, [
  GoodButton({
    x: 50,
    y: 50,
    width: 120,
    height: 40,
    label: "Button 1",
    onClick: (e) => console.log('Button 1 clicked!', e)
  }),
  GoodButton({
    x: 50,
    y: 100,
    width: 120,
    height: 40,
    label: "Button 2",
    onClick: (e) => console.log('Button 2 clicked!', e)
  })
]);`,
  },
];

const emit = defineEmits<{
  (e: 'example-change', code: string): void;
}>();

function loadExample(code: string) {
  emit('example-change', code);
}
</script>

<template>
  <div class="flex items-center gap-2">
    <Button 
      v-for="example in examples" 
      :key="example.name"
      variant="ghost"
      size="sm"
      @click="loadExample(example.code)"
    >
      {{ example.name }}
    </Button>
  </div>
</template> 
