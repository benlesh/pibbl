<template>
  <div class="min-h-screen bg-background">
    <div class="border-b">
      <div class="flex h-14 items-center gap-4 px-4">
        <Header @example-change="onExampleChange" />
        <SnippetManager 
          :current-code="getCurrentCode()"
          @load="onSnippetLoad"
        />
      </div>
    </div>
    <div class="split h-[calc(100vh-3.5rem)]">
      <div id="editor" ref="editorContainer" class="h-full"></div>
      <div id="preview" class="flex items-center justify-center bg-muted/30">
        <canvas id="canvas" class="bg-white shadow-lg"></canvas>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useDark } from '@vueuse/core';
import loader from '@monaco-editor/loader';
import Split from 'split.js';
import { crc, defineComp } from '@crc/core';
import { GoodButton } from './GoodButton';
import { VanillaCtxButton } from './VanillaCtxButton';
import Header from './Header.vue';
import SnippetManager from './components/SnippetManager.vue';
import Button from './components/ui/button/button.vue';
import '@/styles/globals.css';

const editorContainer = ref<HTMLElement>();
let editor: any = null;
const isDark = useDark();

const defaultCode = `crc(canvas, GoodButton({
  x: 50,
  y: 50,
  width: 120,
  height: 40,
  label: "Click me!",
  onClick: (e) => {
    console.log('Button clicked!', e);
  }
}));`;

function getCodeFromURL(): string {
  try {
    return window.location.hash.slice(1) ? atob(window.location.hash.slice(1)) : defaultCode;
  } catch (error) {
    console.error('Error decoding URL code:', error);
    return defaultCode;
  }
}

function getCurrentCode(): string {
  return editor?.getValue() || getCodeFromURL();
}

function updatePreview(code: string) {
  const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
  canvas.width = 400;
  canvas.height = 300;

  // Clear the canvas
  const ctx = canvas.getContext('2d');
  ctx?.clearRect(0, 0, canvas.width, canvas.height);
  
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
    );
  } catch (error) {
    console.error('Error executing code:', error);
  }
}

function onExampleChange(code: string) {
  if (editor) {
    const model = editor.getModel();
    if (model) {
      model.pushEditOperations(
        [],
        [
          {
            range: model.getFullModelRange(),
            text: code,
          },
        ],
        () => null
      );
    }
    updateURL(code);
    updatePreview(code);
  }
}

function onSnippetLoad(code: string) {
  if (editor) {
    const model = editor.getModel();
    if (model) {
      model.pushEditOperations(
        [],
        [
          {
            range: model.getFullModelRange(),
            text: code,
          },
        ],
        () => null
      );
    }
    updateURL(code);
    updatePreview(code);
  }
}

function updateURL(code: string) {
  window.location.hash = btoa(code);
}

// Watch for hash changes
window.addEventListener('hashchange', () => {
  if (editor) {
    try {
      const decodedCode = getCodeFromURL();
      const model = editor.getModel();
      if (model) {
        model.pushEditOperations(
          [],
          [
            {
              range: model.getFullModelRange(),
              text: decodedCode,
            },
          ],
          () => null
        );
      }
      updatePreview(decodedCode);
    } catch (error) {
      console.error('Error loading code from URL:', error);
    }
  }
});

// Update editor theme when dark mode changes
watch(isDark, (dark) => {
  if (editor) {
    editor.updateOptions({
      theme: dark ? 'vs-dark' : 'vs',
    });
  }
});

onMounted(async () => {
  // Initialize split view after Vue has mounted
  Split(['#editor', '#preview'], {
    sizes: [50, 50],
    minSize: [300, 300],
    gutterSize: 10,
  });

  const monaco = await loader.init();
  
  if (editorContainer.value) {
    editor = monaco.editor.create(editorContainer.value, {
      value: getCodeFromURL(),
      language: 'typescript',
      theme: isDark.value ? 'vs-dark' : 'vs',
      minimap: { enabled: false },
      fontSize: 14,
      tabSize: 2,
      scrollBeyondLastLine: false,
      automaticLayout: true,
    });

    editor.onDidChangeModelContent(() => {
      const code = editor.getValue();
      updatePreview(code);
      updateURL(code);
    });

    // Initial preview
    updatePreview(getCodeFromURL());
  }
});
</script>

<style>
.gutter {
  background-color: hsl(var(--border));
  background-repeat: no-repeat;
  background-position: 50%;
}

.gutter.gutter-horizontal {
  background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAeCAYAAADkftS9AAAAIklEQVQoU2M4c+bMfxAGAgYYmwGrIIiDjrELjpo5aiZeMwF+yNnOs5KSvgAAAABJRU5ErkJggg==');
  cursor: col-resize;
}
</style> 

