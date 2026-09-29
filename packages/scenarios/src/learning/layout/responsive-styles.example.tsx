import {
  crc, Flow, Grid, Group, Rectangle, Text, useLayoutBox, useSignal,
  type CRCController, type CRCStyleRule, type FlowStyle,
  type BoxStyle, type LayoutItemStyle, type CRCResponsiveStyle, type SignalValue,
} from '@crc/core';

// Shared rule lists retain identity when a parent rerenders or a Layer caches them.
const contentRules = [
  { query: { minWidth: 600 }, style: { direction: 'horizontal', height: 44 } },
  { query: { maxHeight: 120 }, style: { gap: 8 } },
] satisfies readonly CRCStyleRule<FlowStyle>[];

function Button({ label, click }: {
  style: BoxStyle; label: string; click: () => void;
}) {
  return <Group>
    <Rectangle style={{ width: 112, height: 44, fill: '#17324d', cursor: 'pointer', cornerRadius: 6 }} onClick={click} />
    <Text pointerEvents="none" style={{ left: 56, top: 14, textAlign: 'center', font: '13px sans-serif', fill: 'white' }}>{label}</Text>
  </Group>;
}

// style is the outer placement contract. Rules on the inner Flow see the
// allocation assigned to this component, including a narrow Grid cell.
function ResponsiveActions({ style: placementStyle }: {
  style?: SignalValue<CRCResponsiveStyle<BoxStyle & LayoutItemStyle> | undefined>;
}) {
  void placementStyle;
  const count = useSignal(0);
  return <Flow style={{ width: '100%', height: 112, direction: 'vertical', gap: 12, when: contentRules }}>
    <Button style={{ width: 112, height: 44 }} label={`Clicked ${count.get()}`} click={() => count.update(n => n + 1)} />
    <Button style={{ width: 112, height: 44 }} label="Reset" click={() => count.set(0)} />
  </Flow>;
}

function Scene({ resizeRoot }: { resizeRoot: (narrow: boolean) => void }) {
  const root = useLayoutBox();
  const cellWidth = useSignal(320);
  const cellHeight = useSignal(160);
  return <Group>
    <Rectangle pointerEvents="none" style={{ width: root.width, height: root.height, fill: '#f6f8fb' }} />
    <Text style={{ left: 12, top: 12, font: 'bold 20px sans-serif', fill: '#17324d' }}>Responsive local styles</Text>
    <Text style={{ left: 12, top: 42, font: '12px sans-serif', fill: '#425a70' }}>{`Root ${root.width} × ${root.height} · row at width ≥ 600`}</Text>
    <Group style={{ translateX: 12, translateY: 68 }}>
      <Flow style={{ gap: 8 }}>
        <Button style={{ width: 112, height: 44 }} label="Phone root" click={() => resizeRoot(true)} />
        <Button style={{ width: 112, height: 44 }} label="Wide root" click={() => resizeRoot(false)} />
      </Flow>
    </Group>
    <Group style={{ translateY: 128 }}><ResponsiveActions /></Group>
    <Text style={{ left: 12, top: 258, font: 'bold 16px sans-serif', fill: '#17324d' }}>The same component in a Grid cell</Text>
    <Group style={{ translateX: 12, translateY: 290 }}>
      <Flow style={{ gap: 8 }}>
        <Button style={{ width: 112, height: 44 }} label="Cell width" click={() => cellWidth.update(n => n < 600 ? 640 : 320)} />
        <Button style={{ width: 112, height: 44 }} label="Cell height" click={() => cellHeight.update(n => n > 120 ? 112 : 160)} />
      </Flow>
    </Group>
    <Text style={{ left: 12, top: 348, font: '12px sans-serif', fill: '#425a70' }}>{`Cell ${Math.min(cellWidth.get(), root.width)} × ${cellHeight.get()} · gap 8 at height ≤ 120`}</Text>
    <Group style={{ translateY: 378 }}>
      <Grid style={{
        width: root.width, height: 180,
        gridTemplateColumns: [Math.min(cellWidth.get(), root.width), '1fr'],
        gridTemplateRows: [cellHeight.get()],
      }}>
        <ResponsiveActions style={{ width: '100%', height: '100%', gridColumnStart: 1, gridRowStart: 1 }} />
      </Grid>
    </Group>
    <Text style={{ left: 12, top: Math.max(502, root.height - 54), width: Math.max(1, root.width - 24), wrap: true, font: '12px sans-serif', fill: '#425a70' }}>
      Click counts survive reflow. Width and height describe available space, not touch capability. Changing structure or gestures remains component code.
    </Text>
  </Group>;
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  const resizeRoot = (narrow: boolean) => { canvas.style.width = narrow ? '360px' : '100%'; };
  return crc(canvas, <Scene resizeRoot={resizeRoot} />, { viewport: 'responsive' });
}
