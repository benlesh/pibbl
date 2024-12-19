<template>
  <div class="snippet-manager">
    <button 
      class="action-button" 
      @click="showMenu = !showMenu"
      :title="showMenu ? 'Hide snippets' : 'Show snippets'"
    >
      📑
    </button>
    
    <div v-if="showMenu" class="menu">
      <div class="menu-header">
        <input 
          v-model="newSnippetName" 
          placeholder="Snippet name"
          @keyup.enter="saveSnippet"
          class="snippet-input"
        >
        <button 
          class="save-button" 
          @click="saveSnippet"
          :disabled="!newSnippetName"
        >
          Save
        </button>
      </div>
      
      <div class="snippets-list">
        <div 
          v-for="(snippet, name) in snippets" 
          :key="name"
          class="snippet-item"
        >
          <span class="snippet-name" :title="name">{{ name }}</span>
          <div class="snippet-actions">
            <button 
              @click="loadSnippet(snippet)"
              title="Load snippet"
            >
              ▶️
            </button>
            <button 
              @click="shareSnippet(snippet)"
              title="Share snippet"
            >
              🔗
            </button>
            <button 
              @click="deleteSnippet(name)"
              title="Delete snippet"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useStorage, useClipboard } from '@vueuse/core'

const props = defineProps<{
  currentCode: string
}>()

const emit = defineEmits<{
  (e: 'load', code: string): void
}>()

const showMenu = ref(false)
const newSnippetName = ref('')
const { copy } = useClipboard()

const snippets = useStorage<Record<string, string>>('crc-snippets', {})

function saveSnippet() {
  if (!newSnippetName.value) return
  snippets.value[newSnippetName.value] = props.currentCode
  newSnippetName.value = ''
}

function loadSnippet(code: string) {
  emit('load', code)
  showMenu.value = false
}

async function shareSnippet(code: string) {
  const url = new URL(window.location.href)
  url.searchParams.set('code', btoa(code))
  await copy(url.toString())
  showMenu.value = false
}

function deleteSnippet(name: string) {
  delete snippets.value[name]
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
