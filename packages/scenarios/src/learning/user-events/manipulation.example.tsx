import {
  crc, DragHandle, Flex, ManipulationFrame, Rectangle, ResizeHandles, Text,
  useLayoutBox, useManipulation, useSignal,
  type CRCController,
} from '@crc/core';

function CardContent() {
  const { width, height } = useLayoutBox();
  return <>
    <Rectangle pointerEvents="none" style={{ width, height, fill: '#ffffff', stroke: '#3262b8', strokeWidth: 1, cornerRadius: 12 }} />
    <Rectangle pointerEvents="none" style={{ width, height: 44, fill: '#dbeafe', cornerRadius: 12 }} />
    <Text pointerEvents="none" style={{ left: 16, top: 14, font: '600 15px sans-serif', textBaseline: 'top', fill: '#17324d' }}>Drag this title bar</Text>
    <Flex style={{ left: 16, top: 58, width: width - 32, height: height - 74, flexDirection: 'column', gap: 8 }}>
      <Text pointerEvents="none" style={{ width: '100%', height: 42, minHeight: 42, wrap: true, textBaseline: 'top', font: '14px sans-serif', fill: '#334155' }}>This content receives the resized allocation through ordinary Flex layout.</Text>
      <Rectangle pointerEvents="none" style={{ width: '100%', height: 12, minHeight: 12, flexGrow: 1, fill: '#e2e8f0', cornerRadius: 6 }} />
      <Text pointerEvents="none" style={{ width: '100%', height: 22, minHeight: 22, textBaseline: 'top', font: '12px monospace', fill: '#475569' }}>{Math.round(width)} × {Math.round(height)} local units</Text>
    </Flex>
  </>;
}
function Scene() {
  const box = useSignal({ left: 96, top: 120, width: 320, height: 224 });
  const commits = useSignal(0);
  const manipulation = useManipulation({
    box,
    move: { snap: { step: 16, when: 'shift' } },
    resize: { minWidth: 224, minHeight: 176, snap: { step: 8, when: 'shift' } },
    onCommit: ({ changed }) => { if (changed) commits.update(n => n + 1); },
  });
  const geometry = box.get();
  const active = manipulation.active.get();
  return <>
    <Rectangle pointerEvents="none" style={{ width: 800, height: 560, fill: '#f1f5f9' }} />
    <Text pointerEvents="none" style={{ left: 24, top: 24, font: '600 22px sans-serif', textBaseline: 'top', fill: '#0f172a' }}>Move and resize a component</Text>
    <Text pointerEvents="none" style={{ left: 24, top: 58, font: '14px sans-serif', textBaseline: 'top', fill: '#475569' }}>Drag the blue title. Resize with a corner. Hold Shift to snap.</Text>
    <ManipulationFrame {...manipulation.frameProps}>
      <CardContent />
      <DragHandle controller={manipulation} style={{ width: '100%', height: 44 }} />
      <ResizeHandles controller={manipulation} positions="corners" />
    </ManipulationFrame>
    <Text pointerEvents="none" style={{ left: 24, top: 480, font: '13px monospace', textBaseline: 'top', fill: '#17324d' }}>left {Math.round(geometry.left)} · top {Math.round(geometry.top)} · width {Math.round(geometry.width)} · height {Math.round(geometry.height)}</Text>
    <Text pointerEvents="none" style={{ left: 24, top: 510, font: '13px monospace', textBaseline: 'top', fill: '#475569' }}>{active ? active.operation : 'idle'} · completed changes {commits}</Text>
  </>;
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <Scene />);
}
