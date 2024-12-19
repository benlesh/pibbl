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
    <div 
      v-if="showMenu" 
      class="absolute top-full right-0 mt-2 w-[300px] rounded-md border bg-popover text-popover-foreground shadow-md"
    >
      <div class="flex items-center gap-2 p-3 border-b">
        <Input
          v-model="newSnippetName"
          placeholder="Snippet name"
          class="h-8"
          @keyup.enter="saveSnippet"
        />
        <Button 
          variant="secondary"
          size="sm"
          :disabled="!newSnippetName"
          @click="saveSnippet"
        >
          Save
        </Button>
      </div>
      
      <ScrollArea class="h-[300px]">
        <div class="p-1">
          <div 
            v-for="(snippet, name) in snippets" 
            :key="name"
            class="flex items-center justify-between gap-2 rounded-sm px-2 py-1.5 hover:bg-accent hover:text-accent-foreground"
          >
            <span class="truncate text-sm font-medium" :title="name">{{ name }}</span>
            <div class="flex items-center gap-1">
              <Button 
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                @click="loadSnippet(snippet)"
              >
                <ArrowUpToLine class="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                @click="shareSnippet(snippet)"
              >
                <Share2 class="h-4 w-4" />
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    variant="ghost"
                    size="icon"
                    class="h-7 w-7"
                    @click.stop="handleDelete(name, $event)"
                  >
                    <Trash2 class="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Snippet</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to delete "{{ pendingDeleteName }}"? This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <div class="flex justify-end gap-2">
                    <DialogClose asChild>
                      <Button variant="secondary">Cancel</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button 
                        variant="destructive" 
                        @click="() => deleteSnippet(pendingDeleteName)"
                      >
                        Delete
                      </Button>
                    </DialogClose>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useStorage, useClipboard, useMagicKeys } from '@vueuse/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { ArrowUpToLine, Share2, Trash2 } from 'lucide-vue-next';
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
const pendingDeleteName = ref('');
const { cmd } = useMagicKeys();

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

function handleDelete(name: string, event: MouseEvent) {
  if (event.metaKey) {
    // If cmd/meta is pressed during click, delete immediately
    deleteSnippet(name);
    event.preventDefault();
    return;
  }
  
  // Otherwise, set the pending name for the confirmation dialog
  pendingDeleteName.value = name;
}

function deleteSnippet(name: string) {
  if (!name) return;
  delete snippets.value[name];
  pendingDeleteName.value = '';
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
