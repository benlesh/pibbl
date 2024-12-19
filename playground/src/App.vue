<template>
  <div class="app">
    <Header @example-change="onExampleChange" />
    <div class="split">
      <div id="editor" ref="editorContainer"></div>
      <div id="preview">
        <canvas id="canvas"></canvas>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useDark, useUrlSearchParams } from '@vueuse/core'
import loader from '@monaco-editor/loader'
import Split from 'split.js'
import { crc, defineComp } from '@crc/core'
import { GoodButton } from './GoodButton'
import { VanillaCtxButton } from './VanillaCtxButton'
import Header from './Header.vue'

const editorContainer = ref<HTMLElement>()
let editor: any = null
const isDark = useDark()
const params = useUrlSearchParams('history')

const defaultCode = `crc(canvas, GoodButton({
  x: 50,
  y: 50,
  width: 120,
  height: 40,
  label: "Click me!",
  onClick: (e) => {
    console.log('Button clicked!', e);
  }
}));`

function updatePreview(code: string) {
  const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!
  canvas.width = 400
  canvas.height = 300

  // Clear the canvas
  const ctx = canvas.getContext('2d')
  ctx?.clearRect(0, 0, canvas.width, canvas.height)
  
  try {
    // Execute the code with components in scope
    new Function(
      'canvas', 
      'crc', 
      'GoodButton', 
      'VanillaCtxButton',
      'defineComp',
      code
    )(
      canvas, 
      crc, 
      GoodButton, 
      VanillaCtxButton,
      defineComp
    )
  } catch (error) {
    console.error('Error executing code:', error)
  }
}

function onExampleChange(code: string) {
  if (editor) {
    editor.setValue(code)
  }
}

// Load code from URL if present
function loadCodeFromURL() {
  const code = params.code
  if (code) {
    try {
      const decodedCode = atob(code as string)
      if (editor) {
        editor.setValue(decodedCode)
      }
    } catch (error) {
      console.error('Error loading code from URL:', error)
    }
  }
}

// Update URL when editor content changes
function updateURL(code: string) {
  params.code = btoa(code)
}

// Update editor theme when dark mode changes
watch(isDark, (dark) => {
  if (editor) {
    editor.updateOptions({
      theme: dark ? 'vs-dark' : 'vs',
    })
  }
})

onMounted(async () => {
  // Initialize split view after Vue has mounted
  Split(['#editor', '#preview'], {
    sizes: [50, 50],
    minSize: [300, 300],
    gutterSize: 10,
  })

  const monaco = await loader.init()
  
  if (editorContainer.value) {
    editor = monaco.editor.create(editorContainer.value, {
      value: defaultCode,
      language: 'typescript',
      theme: isDark.value ? 'vs-dark' : 'vs',
      minimap: { enabled: false },
      fontSize: 14,
      tabSize: 2,
      scrollBeyondLastLine: false,
      automaticLayout: true,
    })

    editor.onDidChangeModelContent(() => {
      const code = editor.getValue()
      updatePreview(code)
      updateURL(code)
    })

    // Load code from URL if present
    loadCodeFromURL()

    // Initial preview
    updatePreview(editor.getValue())
  }
})
</script>

<style>
html, body, #app {
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--app-bg, #ffffff);
  color: var(--app-text, #000000);
}

.split {
  display: flex;
  flex: 1;
  overflow: hidden;
}

#editor, #preview {
  height: 100%;
  overflow: hidden;
}

#preview {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--preview-bg, #f5f5f5);
}

canvas {
  background: white;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}

.gutter {
  background-color: var(--gutter-bg, #2d2d2d);
  background-repeat: no-repeat;
  background-position: 50%;
}

.gutter.gutter-horizontal {
  background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAeCAYAAADkftS9AAAAIklEQVQoU2M4c+bMfxAGAgYYmwGrIIiDjrELjpo5aiZeMwF+yNnOs5KSvgAAAABJRU5ErkJggg==');
  cursor: col-resize;
}

:root {
  --app-bg: #ffffff;
  --app-text: #000000;
  --preview-bg: #f5f5f5;
  --gutter-bg: #e0e0e0;
}

html.dark {
  --app-bg: #1e1e1e;
  --app-text: #ffffff;
  --preview-bg: #2d2d2d;
  --gutter-bg: #2d2d2d;
}
</style> 
