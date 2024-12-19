<template>
  <div class="split">
    <div id="editor" ref="editorContainer"></div>
    <div id="preview">
      <canvas id="canvas"></canvas>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import loader from '@monaco-editor/loader'
import Split from 'split.js'
import { CompEl, CompFn, crc, RenderingContext2D } from '@crc/core'
import { GoodButton } from './GoodButton'
import { VanillaCtxButton } from './VanillaCtxButton'
const editorContainer = ref<HTMLElement>()

const defaultCode = `
crc(canvas, GoodButton({
  x: 50,
  y: 50,
  width: 120,
  height: 40,
  label: "Click me!",
  onClick: (e) => {
    console.log('Button clicked!', e);
  }
}));

crc(canvas, VanillaCtxButton({
  x: 50,
  y: 50,
  width: 120,
  height: 40,
  label: "Click me!",
  onClick: (e) => {
    console.log('Button clicked!', e);
  }
}));
`

function updatePreview(code: string) {
  const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!
  canvas.width = 400
  canvas.height = 300

  // Clear the canvas
  const ctx = canvas.getContext('2d')
  ctx?.clearRect(0, 0, canvas.width, canvas.height)
  
  try {
    // Execute the code with GoodButton component in scope
    new Function('canvas', 'crc', 'GoodButton', 'VanillaCtxButton', code)(canvas, crc, GoodButton, VanillaCtxButton)
  } catch (error) {
    console.error('Error executing code:', error)
  }
}

onMounted(async () => {
  // Initialize split view after Vue has mounted
  Split(['#editor', '#preview'], {
    sizes: [50, 50],
    minSize: [300, 300],
    gutterSize: 10,
  })

  const monaco = await loader.init()
  
  if (editorContainer.value) {
    const editor = monaco.editor.create(editorContainer.value, {
      value: defaultCode,
      language: 'typescript',
      theme: 'vs-dark',
      minimap: { enabled: false },
      fontSize: 14,
      tabSize: 2,
      scrollBeyondLastLine: false,
      automaticLayout: true,
    })

    editor.onDidChangeModelContent(() => {
      updatePreview(editor.getValue())
    })

    // Initial preview
    updatePreview(defaultCode)
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

.split {
  display: flex;
  width: 100vw;
  height: 100vh;
}

#editor, #preview {
  height: 100%;
  overflow: hidden;
}

#preview {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}

canvas {
  background: white;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}

.gutter {
  background-color: #eee;
  background-repeat: no-repeat;
  background-position: 50%;
}

.gutter.gutter-horizontal {
  background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAeCAYAAADkftS9AAAAIklEQVQoU2M4c+bMfxAGAgYYmwGrIIiDjrELjpo5aiZeMwF+yNnOs5KSvgAAAABJRU5ErkJggg==');
  cursor: col-resize;
}
</style> 
