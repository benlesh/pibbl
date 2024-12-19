<template>
  <div class="flex items-center gap-4">
    <h1 class="text-lg font-medium">CRC Playground</h1>
    <div class="flex items-center gap-2">
      <select 
        v-model="selectedExample" 
        @change="onExampleChange"
        class="h-9 w-[180px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="button">Button Example</option>
        <option value="vanilla">Vanilla Context Example</option>
        <option value="custom">Custom Component</option>
      </select>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              class="min-w-[80px]"
              :class="{ 'bg-primary text-primary-foreground': isCopied }"
              @click="onShare"
            >
              {{ isCopied ? 'Copied!' : 'Share' }}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Copy shareable link</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size="icon"
              @click="toggleDark"
            >
              <span class="text-base">{{ isDark ? '🌙' : '☀️' }}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{{ isDark ? 'Switch to light mode' : 'Switch to dark mode' }}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useClipboard, useDark } from '@vueuse/core'
import { downloadProject } from './utils/download'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const selectedExample = ref('button')
const { copy, copied: isCopied } = useClipboard()
const isDark = useDark()

const emit = defineEmits(['example-change'])

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
  emit('example-change', examples[selectedExample.value as keyof typeof examples])
}

async function onShare() {
  const url = new URL(window.location.href)
  url.searchParams.set('code', btoa(examples[selectedExample.value as keyof typeof examples]))
  await copy(url.toString())
}

function toggleDark() {
  isDark.value = !isDark.value
}
</script>
