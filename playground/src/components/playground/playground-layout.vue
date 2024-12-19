<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useDark } from '@vueuse/core'
import loader from '@monaco-editor/loader'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Settings, Code2, Save, RefreshCw, Download, Copy, FileCode2, Maximize2 } from 'lucide-vue-next'
import { crc, defineComp } from '@crc/core'
import { GoodButton } from '../../GoodButton'
import { VanillaCtxButton } from '../../VanillaCtxButton'
import Header from '../../Header.vue'
import SnippetManager from '../SnippetManager.vue'

const editorContainer = ref<HTMLElement | null>(null)
const canvasContainer = ref<HTMLElement | null>(null)
let editor: any = null
const isDark = useDark()

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

function getCodeFromURL(): string {
  try {
    return window.location.hash.slice(1) ? atob(window.location.hash.slice(1)) : defaultCode
  } catch (error) {
    console.error('Error decoding URL code:', error)
    return defaultCode
  }
}

function getCurrentCode(): string {
  return editor?.getValue() || getCodeFromURL()
}

function updatePreview(code: string) {
  const canvas = canvasContainer.value?.querySelector<HTMLCanvasElement>('#canvas')
  if (!canvas) return
  
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
    const model = editor.getModel()
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
      )
    }
    updateURL(code)
    updatePreview(code)
  }
}

function onSnippetLoad(code: string) {
  if (editor) {
    const model = editor.getModel()
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
      )
    }
    updateURL(code)
    updatePreview(code)
  }
}

function updateURL(code: string) {
  window.location.hash = btoa(code)
}

// Watch for hash changes
window.addEventListener('hashchange', () => {
  if (editor) {
    try {
      const decodedCode = getCodeFromURL()
      const model = editor.getModel()
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
        )
      }
      updatePreview(decodedCode)
    } catch (error) {
      console.error('Error loading code from URL:', error)
    }
  }
})

// Update editor theme when dark mode changes
watch(isDark, (dark) => {
  if (editor) {
    editor.updateOptions({
      theme: dark ? 'vs-dark' : 'vs',
    })
  }
})

// Add function to handle fullscreen
function toggleFullscreen(element: HTMLElement | null) {
  if (!element) return
  if (!document.fullscreenElement) {
    element.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

onMounted(async () => {
  const monaco = await loader.init()
  
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
    })

    editor.onDidChangeModelContent(() => {
      const code = editor.getValue()
      updatePreview(code)
      updateURL(code)
    })

    // Initial preview
    updatePreview(getCodeFromURL())
  }
})
</script>

<template>
  <div class="min-h-screen bg-background">
    <header class="border-b">
      <div class="flex h-14 items-center justify-between px-4">
        <div class="flex items-center gap-4">
          <Header @example-change="onExampleChange" />
          <div class="relative z-50">
            <SnippetManager 
              :current-code="getCurrentCode()"
              @load="onSnippetLoad"
            />
          </div>
        </div>
        
        <div class="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" @click="updatePreview(getCurrentCode())">
                  <RefreshCw class="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh Preview</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings class="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Editor Settings</SheetTitle>
                <SheetDescription>
                  Customize your coding environment
                </SheetDescription>
              </SheetHeader>
              <ScrollArea class="h-[400px] mt-4">
                <Tabs defaultValue="editor" class="w-full">
                  <TabsList class="grid w-full grid-cols-2">
                    <TabsTrigger value="editor">Editor</TabsTrigger>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                  </TabsList>
                  <TabsContent value="editor">
                    <!-- Editor settings content -->
                  </TabsContent>
                  <TabsContent value="preview">
                    <!-- Preview settings content -->
                  </TabsContent>
                </Tabs>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
    
    <ResizablePanelGroup direction="horizontal" class="h-[calc(100vh-3.5rem)]">
      <ResizablePanel :default-size="50" class="min-w-[400px]">
        <div class="h-full relative">
          <div class="absolute right-2 top-2 z-10 flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    class="hover:bg-muted"
                    @click="editor?.getAction('editor.action.formatDocument')?.run()"
                  >
                    <Code2 class="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Format Code</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" class="hover:bg-muted">
                  <Save class="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem @click="editor?.getAction('editor.action.clipboardCopyAction')?.run()">
                  <Copy class="h-4 w-4 mr-2" />
                  Copy Code
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <FileCode2 class="h-4 w-4 mr-2" />
                  Save as Snippet
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Download class="h-4 w-4 mr-2" />
                  Download File
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div ref="editorContainer" class="h-full w-full border rounded-md bg-background"></div>
        </div>
      </ResizablePanel>
      
      <ResizableHandle />
      
      <ResizablePanel :default-size="50" class="min-w-[400px]">
        <div class="h-full relative">
          <div class="absolute right-2 top-2 z-10 flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    class="hover:bg-muted"
                    @click="toggleFullscreen(canvasContainer)"
                  >
                    <Maximize2 class="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Toggle Fullscreen</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div ref="canvasContainer" class="flex h-full items-center justify-center bg-background border rounded-md p-4">
            <canvas id="canvas" class="bg-white shadow-lg rounded-md"></canvas>
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>

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
