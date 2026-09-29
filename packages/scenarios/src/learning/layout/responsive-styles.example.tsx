import {
  crc, Flow, Grid, Group, Line, Rectangle, Text, useLayoutBox, useSignal,
  type CRCController, type CRCResponsiveStyle, type BoxStyle, type LayoutItemStyle, type SignalValue,
} from '@crc/core';

const ink = '#172c2a';
const muted = '#647873';
const green = '#18755a';
type Placement = { style?: SignalValue<CRCResponsiveStyle<BoxStyle & LayoutItemStyle> | undefined> };

function Button({ label, active, click }: Placement & {
  label: string; active: boolean; click: () => void;
}) {
  const box = useLayoutBox();
  return <Group>
    <Rectangle style={{ width: box.width, height: 44, cornerRadius: 8, fill: active ? ink : '#e8eeea', cursor: 'pointer' }} onClick={click} />
    <Text pointerEvents="none" style={{ x: box.width / 2, y: 14, textAlign: 'center', font: '600 13px sans-serif', fill: active ? '#ffffff' : ink }}>{label}</Text>
  </Group>;
}

function Metric({ label, value, change }: Placement & { label: string; value: string; change: string }) {
  return <Group>
    <Text style={{ y: 2, font: '13px sans-serif', fill: muted }}>{label}</Text>
    <Text style={{ y: 23, font: '600 26px sans-serif', fill: ink, when: [{ query: { minWidth: 180 }, style: { font: '600 30px sans-serif' } }] }}>{value}</Text>
    <Text style={{ x: 158, y: 30, font: '12px sans-serif', fill: green, when: [{ query: { minWidth: 180 }, style: { x: 0, y: 56 } }] }}>{change}</Text>
  </Group>;
}

// Chart geometry uses its allocated width; layout decisions stay in style.when.
// These are illustrative store totals, not a live data source.
function SalesTrend({ month }: { month: boolean }) {
  const { width } = useLayoutBox();
  const plotWidth = Math.max(1, width - 48);
  const values = month ? [35, 42, 30, 58, 48, 73, 62, 82, 68, 105, 91, 126] : [38, 62, 49, 88, 72, 108, 126];
  const coords: [number, number][] = values.map((v, i) => [24 + i * plotWidth / (values.length - 1), 166 - v]);
  return <Group>
    <Text style={{ x: 24, y: 0, font: '600 13px sans-serif', fill: ink }}>Sales over time</Text>
    {[42, 84, 126, 168].map(y => <Line key={y} pointerEvents="none" style={{ coords: [[24, y], [width - 24, y]], stroke: '#e8eeea', strokeWidth: 1 }} />)}
    <Line pointerEvents="none" style={{ coords: coords.map(([x, y]) => [x, y + 20]), stroke: '#bfcec7', strokeWidth: 2 }} />
    <Line pointerEvents="none" style={{ coords, stroke: green, strokeWidth: 3 }} />
    <Text style={{ x: 24, y: 183, font: '11px sans-serif', fill: muted }}>{month ? 'Sep 1' : 'Sep 22'}</Text>
    <Text style={{ x: width - 24, y: 183, textAlign: 'right', font: '11px sans-serif', fill: muted }}>Sep 28</Text>
    <Rectangle style={{ x: 24, y: 213, width: 12, height: 3, fill: green }} />
    <Text style={{ x: 42, y: 207, font: '11px sans-serif', fill: muted }}>Selected period</Text>
    <Rectangle style={{ x: 153, y: 213, width: 12, height: 3, fill: '#bfcec7' }} />
    <Text style={{ x: 171, y: 207, font: '11px sans-serif', fill: muted }}>Previous period</Text>
  </Group>;
}

// The outer style belongs to the Grid. Inner rules receive this card's assigned
// space, so a sidebar on a wide screen uses the same layout as a phone.
function RevenueCard(_props: Placement) {
  const month = useSignal(false);
  const isMonth = month.get();
  return <Group>
    <Rectangle style={{ width: '100%', height: 620, fill: '#ffffff', cornerRadius: 16, stroke: '#dce5df', strokeWidth: 1, when: [{ query: { minWidth: 600 }, style: { height: 460 } }] }} />
    <Text style={{ x: 24, y: 24, font: '600 21px sans-serif', fill: ink }}>Revenue overview</Text>
    <Text style={{ x: 24, y: 54, font: '12px sans-serif', fill: muted }}>Online store · USD</Text>
    <Group style={{ translateX: 24, translateY: 84, when: [{ query: { minWidth: 600 }, style: { translateY: 78 } }] }}>
      <Flow style={{ width: 208, height: 44, gap: 8 }}>
        <Button style={{ width: 96, height: 44 }} label="7 days" active={!isMonth} click={() => month.set(false)} />
        <Button style={{ width: 96, height: 44 }} label="30 days" active={isMonth} click={() => month.set(true)} />
      </Flow>
    </Group>
    <Group style={{ translateX: 24, translateY: 150 }}>
      <Flow style={{ width: '100%', height: 216, direction: 'vertical', gap: 12, when: [{ query: { minWidth: 600 }, style: { direction: 'horizontal', height: 88, gap: 12 } }] }}>
        <Metric style={{ width: '100%', height: 60, when: [{ query: { minWidth: 600 }, style: { width: '30%', height: 88 } }] }} label="Revenue" value={isMonth ? '$48,920' : '$12,840'} change="+18.6%" />
        <Metric style={{ width: '100%', height: 60, when: [{ query: { minWidth: 600 }, style: { width: '30%', height: 88 } }] }} label="Orders" value={isMonth ? '764' : '201'} change="+12.4%" />
        <Metric style={{ width: '100%', height: 60, when: [{ query: { minWidth: 600 }, style: { width: '30%', height: 88 } }] }} label="Avg. order" value={isMonth ? '$64.03' : '$63.88'} change="+5.5%" />
      </Flow>
    </Group>
    <Group style={{ translateY: 380, when: [{ query: { minWidth: 600 }, style: { translateY: 240 } }] }}>
      <SalesTrend month={isMonth} />
    </Group>
  </Group>;
}

function Scene({ resizeRoot }: { resizeRoot: (phone: boolean) => void }) {
  const root = useLayoutBox();
  const mode = useSignal('Dashboard');
  const available = Math.max(1, root.width - 32);
  const cardWidth = mode.get() === 'Sidebar' ? Math.min(360, available) : available;
  return <Group>
    <Rectangle pointerEvents="none" style={{ width: root.width, height: root.height, fill: '#f0f3ee' }} />
    <Text style={{ x: 16, y: 20, font: '600 24px sans-serif', fill: ink, when: [{ query: { maxWidth: 420 }, style: { font: '600 20px sans-serif' } }] }}>Juniper / Store analytics</Text>
    <Text style={{ x: 16, y: 54, font: '12px sans-serif', fill: muted }}>One card. Full dashboard, sidebar, or phone.</Text>
    <Group style={{ translateX: 16, translateY: 84 }}>
      <Flow style={{ width: Math.min(328, available), gap: 8, height: 44 }}>
        {['Dashboard', 'Sidebar', 'Phone'].map(label => <Button key={label} style={{ width: '30%', height: 44 }} label={label} active={mode.get() === label} click={() => { mode.set(label); resizeRoot(label === 'Phone'); }} />)}
      </Flow>
    </Group>
    <Group style={{ translateX: 16, translateY: 150 }}>
      <Grid style={{ width: available, height: 620, gridTemplateColumns: [cardWidth], gridTemplateRows: [620] }}>
        <RevenueCard style={{ width: '100%', height: '100%', gridColumnStart: 1, gridRowStart: 1 }} />
      </Grid>
    </Group>
    {mode.get() === 'Sidebar' && root.width >= 700 ? <Group style={{ translateX: 408, translateY: 186 }}>
      <Text style={{ font: '600 22px sans-serif', fill: ink }}>Small space. Same card.</Text>
      <Text style={{ y: 42, width: Math.max(1, root.width - 448), wrap: true, font: '15px sans-serif', fill: muted }}>The page is still wide. Only this dashboard column is narrow, so the card stacks its metrics and moves the chart down.</Text>
      <Text style={{ y: 142, width: Math.max(1, root.width - 448), wrap: true, font: '14px sans-serif', fill: muted }}>Choose 30 days, then switch views. Your selection stays with the card.</Text>
    </Group> : null}
  </Group>;
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  // The host supplies ordinary page scrolling when the Studio preview is short.
  // CRC still owns only the canvas; this is not a canvas scrolling API.
  const host = canvas.parentElement;
  const canvasStyles = canvas.style.cssText;
  const hostStyles = host?.style.cssText;
  if (host) { host.style.display = 'block'; host.style.overflow = 'auto'; }
  canvas.style.height = '800px';
  canvas.style.maxHeight = 'none';
  canvas.style.touchAction = 'pan-y';
  const resizeRoot = (phone: boolean) => { canvas.style.width = phone ? 'min(390px, 100%)' : '100%'; };
  const restoreStyles = () => {
    canvas.style.cssText = canvasStyles;
    if (host && hostStyles !== undefined) host.style.cssText = hostStyles;
  };
  let controller: CRCController;
  try {
    controller = crc(canvas, <Scene resizeRoot={resizeRoot} />, { viewport: 'responsive' });
  } catch (error) {
    restoreStyles();
    throw error;
  }
  let disposed = false;
  return { dispose() {
    if (disposed) return;
    disposed = true;
    try { controller.dispose(); } finally { restoreStyles(); }
  } };

}
