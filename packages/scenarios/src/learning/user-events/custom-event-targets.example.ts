import {
  crc,
  crcEventTarget,
  crcMemo,
  crcState,
  defineComp,
  path,
  rect,
  text,
  type CRCController,
} from "@crc/core";

function badgeGeometry(): Path2D {
  const geometry = new Path2D();
  geometry.moveTo(360, 82);
  geometry.lineTo(520, 178);
  geometry.lineTo(466, 314);
  geometry.lineTo(254, 314);
  geometry.lineTo(200, 178);
  geometry.closePath();
  return geometry;
}

const CustomBadge = defineComp(function CustomBadge() {
  const [clicks, setClicks] = crcState(0);
  const [hovered, setHovered] = crcState(false);
  const [coordinates, setCoordinates] = crcState('move across the badge');
  const geometry = crcMemo(badgeGeometry, []);

  crcEventTarget({
    onClick: () => setClicks(total => total + 1),
    onPointerEnter: () => setHovered(true),
    onPointerLeave: () => setHovered(false),
    onPointerMove: event => {
      setCoordinates(`${Math.round(event.x)}, ${Math.round(event.y)}`);
    },
  }, {
    path: geometry,
    fill: true,
    lineInteractionWidth: 22,
    cursor: 'crosshair',
  });

  return [
    path({
      style: {
        d: geometry,
        fill: hovered ? '#74d3ae' : '#1f4bd8',
        stroke: '#f7c948',
        strokeWidth: 8,
      },
    }),
    rect({
      style: {
        x: 284,
        y: 160,
        width: 152,
        height: 76,
        fill: '#17211d',
        opacity: 0.75,
      },
    }),
    text({
      style: {
        text: `CUSTOM\nTARGET / ${clicks}`,
        x: 360,
        y: 190,
        lineHeight: 22,
        fill: '#fffdf6',
        font: '800 15px monospace',
        textAlign: 'center',
        textBaseline: 'middle',
      },
    }),
    text({
      style: {
        text: coordinates,
        x: 360,
        y: 278,
        fill: '#17211d',
        font: '700 12px monospace',
        textAlign: 'center',
      },
    }),
  ];
});

const CustomEventTargetsStudy = defineComp(function CustomEventTargetsStudy() {
  return [
    rect({
      style: { x: 0, y: 0, width: 720, height: 420, fill: '#f7f0df' },
    }),
    text({
      style: {
        text: 'ONE EXPLICIT CUSTOM PATH',
        x: 360,
        y: 46,
        fill: '#17211d',
        font: '900 24px sans-serif',
        textAlign: 'center',
      },
    }),
    CustomBadge({}),
    text({
      style: {
        text: 'The hook owns this exact Path2D: fill hits inside, and its 22px stroke halo also hits.',
        x: 360,
        y: 352,
        width: 620,
        fill: '#17211d',
        font: '600 14px sans-serif',
        textAlign: 'center',
      },
    }),
    text({
      style: {
        text: 'The dark label is paint only — geometry is never hoisted from returned children.',
        x: 360,
        y: 382,
        width: 620,
        fill: '#445267',
        font: '600 12px monospace',
        textAlign: 'center',
      },
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, CustomEventTargetsStudy({}));
}
