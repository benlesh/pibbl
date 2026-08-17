import {
  crc,
  crcState,
  defineComp,
  g,
  layer,
  rect,
  text,
  type CRCController,
} from "@crc/core";

interface BadgeProps {
  active: boolean;
  onSelect: () => void;
}

const Badge = defineComp(function Badge(props: BadgeProps) {
  return [
    rect({
      style: {
        x: 0,
        y: 0,
        width: 344,
        height: 214,
        fill: props.active ? '#f7c948' : '#74d3ae',
        stroke: '#17211d',
        strokeWidth: 6,
        cursor: 'pointer',
      },
      onClick: props.onSelect,
    }),
    rect({
      style: {
        x: 34,
        y: 34,
        width: 86,
        height: 146,
        fill: '#1f4bd8',
      },
    }),
    text({
      style: {
        text: props.active ? "LAYER!" : "OFFSCREEN",
        x: 226,
        y: 84,
        fill: "#17211d",
        font: "900 25px sans-serif",
        textAlign: "center",
      },
    }),
    text({
      style: {
        text: "CLICK THE BADGE",
        x: 226,
        y: 130,
        fill: "#17211d",
        font: "700 12px monospace",
        textAlign: "center",
      },
    }),
  ];
});

const LayerStudy = defineComp(function LayerStudy() {
  const [active, setActive] = crcState(false);
  return [
    rect({
      style: {
        x: 0,
        y: 0,
        width: 720,
        height: 420,
        fill: '#ff6b57',
      },
    }),
    rect({
      style: {
        x: 132,
        y: 82,
        width: 456,
        height: 256,
        fill: '#fffdf6',
        stroke: '#17211d',
        strokeWidth: 6,
      },
    }),
    g({
      x: 188,
      y: 103,
      children: [
        layer({
          width: 344,
          height: 214,
          render: Badge({
            active,
            onSelect: () => setActive((value) => !value),
          }),
        }),
      ],
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, LayerStudy({}));
}
