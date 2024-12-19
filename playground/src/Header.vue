<template>
  <header class="header">
    <div class="left">
      <h1>CRC Playground</h1>
      <div class="examples">
        <select v-model="selectedExample" @change="onExampleChange">
          <option value="button">Button Example</option>
          <option value="vanilla">Vanilla Context Example</option>
          <option value="custom">Custom Component</option>
        </select>
      </div>
    </div>
    <div class="right">
      <button 
        class="action-button" 
        @click="onShare"
        :class="{ 'copied': isCopied }"
      >
        {{ isCopied ? 'Copied!' : 'Share' }}
      </button>
      <button 
        class="action-button" 
        @click="onDownload"
        :disabled="isDownloading"
      >
        {{ isDownloading ? 'Downloading...' : 'Download' }}
      </button>
      <button 
        class="action-button theme-toggle" 
        @click="toggleDark"
        :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
      >
        {{ isDark ? '🌙' : '☀️' }}
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useClipboard, useDark } from '@vueuse/core'
import { downloadProject } from './utils/download'

const selectedExample = ref('button')
const isDownloading = ref(false)
const { copy, copied: isCopied } = useClipboard()
const isDark = useDark()

const emit = defineEmits<{
  (e: 'example-change', code: string): void
}>()

const examples = {
  button: `crc(canvas, GoodButton({
  x: 50,
  y: 50,
  width: 120,
  height: 40,
  label: "Click me!",
  onClick: (e) => {
    console.log('Button clicked!', e);
  }
}));`,
  vanilla: `crc(canvas, VanillaCtxButton({
  x: 50,
  y: 100,
  width: 120,
  height: 40,
  label: "Vanilla!",
  onClick: (e) => {
    console.log('Vanilla button clicked!', e);
  }
}));`,
  custom: `// Create your own component here!
const CustomShape = defineComp((props: { x: number, y: number }, ctx) => {
  return (
    <rect
      x={props.x}
      y={props.y}
      width={50}
      height={50}
      fillStyle="purple"
    />
  );
});

crc(canvas, CustomShape({ x: 100, y: 100 }));`
}

function onExampleChange() {
  emit('example-change', examples[selectedExample.value])
}

async function onShare() {
  const url = new URL(window.location.href)
  url.searchParams.set('code', btoa(examples[selectedExample.value]))
  await copy(url.toString())
}

async function onDownload() {
  isDownloading.value = true
  try {
    await downloadProject(examples[selectedExample.value])
  } finally {
    isDownloading.value = false
  }
}

function toggleDark() {
  isDark.value = !isDark.value
}

defineExpose({
  onExampleChange,
  onShare,
  onDownload,
  toggleDark,
  selectedExample,
  isDownloading,
  isCopied,
  isDark,
})
</script>

<style>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background: var(--header-bg, #1e1e1e);
  color: var(--header-text, white);
  border-bottom: 1px solid var(--header-border, #333);
}

.left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.left h1 {
  font-size: 1.2rem;
  margin: 0;
  font-weight: 500;
}

.examples select {
  background: var(--select-bg, #2d2d2d);
  color: var(--select-text, white);
  border: 1px solid var(--select-border, #444);
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
  font-size: 0.9rem;
}

.right {
  display: flex;
  gap: 0.5rem;
}

.action-button {
  background: var(--button-bg, #2d2d2d);
  color: var(--button-text, white);
  border: 1px solid var(--button-border, #444);
  padding: 0.3rem 0.8rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
  min-width: 80px;
}

.action-button:hover:not(:disabled) {
  background: var(--button-hover-bg, #3d3d3d);
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-button.copied {
  background: var(--button-success-bg, #4caf50);
  border-color: var(--button-success-border, #43a047);
}

.theme-toggle {
  min-width: unset;
  padding: 0.3rem;
  font-size: 1.1rem;
}

:root {
  --header-bg: #1e1e1e;
  --header-text: white;
  --header-border: #333;
  --select-bg: #2d2d2d;
  --select-text: white;
  --select-border: #444;
  --button-bg: #2d2d2d;
  --button-text: white;
  --button-border: #444;
  --button-hover-bg: #3d3d3d;
  --button-success-bg: #4caf50;
  --button-success-border: #43a047;
}

html.dark {
  --header-bg: #1e1e1e;
  --header-text: white;
  --header-border: #333;
  --select-bg: #2d2d2d;
  --select-text: white;
  --select-border: #444;
  --button-bg: #2d2d2d;
  --button-text: white;
  --button-border: #444;
  --button-hover-bg: #3d3d3d;
}

html:not(.dark) {
  --header-bg: #f5f5f5;
  --header-text: #333;
  --header-border: #ddd;
  --select-bg: white;
  --select-text: #333;
  --select-border: #ddd;
  --button-bg: white;
  --button-text: #333;
  --button-border: #ddd;
  --button-hover-bg: #f0f0f0;
}
</style>`
