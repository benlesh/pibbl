<script setup lang="ts">
import { ref } from 'vue';
import { useDark, useClipboard } from '@vueuse/core';
import { Button } from '../components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger 
} from '../components/ui/dropdown-menu/index';
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from '../components/ui/sheet';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger 
} from '../components/ui/tooltip';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Settings, RefreshCw, Share2, Sun, Moon, ChevronDown } from 'lucide-vue-next';
import SnippetManager from './SnippetManager.vue';

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

const selectedExample = ref('Basic Button');
const isDark = useDark();
const { copy } = useClipboard();

const emit = defineEmits<{
  (e: 'example-change', code: string): void;
  (e: 'refresh'): void;
  (e: 'code-load', code: string): void;
}>();

function loadExample(example: typeof examples[0]) {
  selectedExample.value = example.name;
  emit('example-change', example.code);
}

function refreshPreview() {
  emit('refresh');
}

function onShare() {
  copy(window.location.href);
}

function onSnippetLoad(code: string) {
  emit('code-load', code);
}

function toggleDark() {
  isDark.value = !isDark.value;
}
</script>

<template>
  <div class="flex h-14 items-center justify-between px-4 border-b">
    <div class="flex items-center gap-4">
      <h1 class="text-lg font-medium">CRC Playground</h1>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" class="w-[180px] justify-between">
            <span>{{ selectedExample }}</span>
            <ChevronDown class="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="w-[180px]">
          <DropdownMenuItem 
            v-for="example in examples" 
            :key="example.name"
            @click="loadExample(example)"
          >
            {{ example.name }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div class="relative">
        <SnippetManager 
          :current-code="''"
          @load="onSnippetLoad"
        />
      </div>
    </div>

    <div class="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" @click="onShare">
              <Share2 class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Share</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" @click="refreshPreview">
              <RefreshCw class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Refresh Preview</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" @click="toggleDark">
              <Sun v-if="isDark" class="h-4 w-4" />
              <Moon v-else class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{{ isDark ? 'Light Mode' : 'Dark Mode' }}</p>
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
</template> 
