<template>
  <div class="flex items-center gap-2">
    <Button variant="outline" size="sm" @click="downloadProject">
      Download Project
    </Button>
    <Button variant="outline" size="sm" @click="showMenu = !showMenu">
      {{ showMenu ? 'Hide Snippets' : 'Show Snippets' }}
    </Button>
    <label>
      <Button variant="outline" size="sm">
        Upload Code
      </Button>
      <input
        type="file"
        accept=".js,.ts"
        class="hidden"
        @change="handleFileUpload"
      >
    </label>

    <!-- Snippets Menu -->
    <div v-if="showMenu" class="absolute top-full right-0 mt-2 w-64 bg-popover border rounded-md shadow-lg">
      <div class="p-2 border-b flex gap-2">
        <input
          v-model="newSnippetName"
          placeholder="Snippet name"
          class="flex-1 px-2 py-1 text-sm rounded border bg-background"
          @keyup.enter="saveSnippet"
        >
        <Button 
          size="sm"
          :disabled="!newSnippetName"
          @click="saveSnippet"
        >
          Save
        </Button>
      </div>
      <div class="max-h-64 overflow-y-auto">
        <div 
          v-for="(snippet, name) in snippets" 
          :key="name"
          class="p-2 border-b flex items-center justify-between gap-2 hover:bg-muted/50"
        >
          <span class="truncate text-sm" :title="name">{{ name }}</span>
          <div class="flex gap-1">
            <Button 
              variant="ghost"
              size="sm"
              @click="loadSnippet(snippet)"
              title="Load snippet"
            >
              Load
            </Button>
            <Button 
              variant="ghost"
              size="sm"
              @click="shareSnippet(snippet)"
              title="Share snippet"
            >
              Share
            </Button>
            <Button 
              variant="ghost"
              size="sm"
              @click="deleteSnippet(name)"
              title="Delete snippet"
            >
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useStorage, useClipboard } from '@vueuse/core';
import Button from './ui/button/button.vue';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

// Import templates
import appTemplate from '../fixtures/templates/App.ts.txt?raw';
import mainTemplate from '../fixtures/templates/main.ts.txt?raw';
import indexTemplate from '../fixtures/templates/index.html.txt?raw';
import packageJson from '../fixtures/package.json?raw';

const props = defineProps<{
  currentCode: string;
}>();

const emit = defineEmits<{
  (e: 'load', code: string): void;
}>();

const showMenu = ref(false);
const newSnippetName = ref('');
const { copy } = useClipboard();
const snippets = useStorage<Record<string, string>>('crc-snippets', {});

async function downloadProject() {
  const zip = new JSZip();

  // Add package.json
  zip.file('package.json', packageJson);

  // Add main.ts
  zip.file('src/main.ts', mainTemplate);

  // Add App.ts with the current code
  zip.file('src/App.ts', appTemplate.replace('__CODE__', props.currentCode));

  // Add index.html
  zip.file('index.html', indexTemplate);

  // Generate the zip file
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, 'crc-component.zip');
}

function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const code = e.target?.result as string;
      emit('load', code);
    };
    reader.readAsText(file);
  }
}

function saveSnippet() {
  if (!newSnippetName.value) return;
  snippets.value[newSnippetName.value] = props.currentCode;
  newSnippetName.value = '';
}

function loadSnippet(code: string) {
  emit('load', code);
  showMenu.value = false;
}

async function shareSnippet(code: string) {
  const url = new URL(window.location.href);
  url.hash = btoa(code);
  await copy(url.toString());
  showMenu.value = false;
}

function deleteSnippet(name: string) {
  delete snippets.value[name];
}
</script>

<style>
.snippet-manager {
  position: relative;
}

.menu {
  position: absolute;
  top: 100%;
  right: 0;
  width: 250px;
  background: var(--menu-bg, #fff);
  border: 1px solid var(--menu-border, #ddd);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-top: 4px;
  z-index: 1000;
}

.menu-header {
  display: flex;
  padding: 8px;
  gap: 4px;
  border-bottom: 1px solid var(--menu-border, #ddd);
}

.snippet-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--input-border, #ddd);
  border-radius: 4px;
  font-size: 0.9rem;
  background: var(--input-bg, #fff);
  color: var(--input-text, #333);
}

.save-button {
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--button-bg, #4a90e2);
  color: white;
  border: none;
  cursor: pointer;
}

.save-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.snippets-list {
  max-height: 200px;
  overflow-y: auto;
}

.snippet-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid var(--menu-border, #ddd);
}

.snippet-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 8px;
  color: var(--text, #333);
}

.snippet-actions {
  display: flex;
  gap: 4px;
}

.snippet-actions button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.snippet-actions button:hover {
  opacity: 1;
}

html.dark .menu {
  --menu-bg: #2d2d2d;
  --menu-border: #444;
  --input-bg: #1e1e1e;
  --input-border: #444;
  --input-text: #fff;
  --text: #fff;
  --button-bg: #4a90e2;
}
</style> 
