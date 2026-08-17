import {
  crc,
  crcState,
  defineComp,
  rect,
  text,
  type CRCController,
} from "@crc/core";

const MouseUpStudy = defineComp(function MouseUpStudy() {
  const [releases, setReleases] = crcState(0);
  const [position, setPosition] = crcState("—");
  return [
    rect({
      style: {
        x: 0,
        y: 0,
        width: 720,
        height: 420,
        fill: '#f7f0df',
      },
    }),
    rect({
      style: {
        x: 166,
        y: 82,
        width: 388,
        height: 256,
        fill: '#f7c948',
        stroke: '#17211d',
        strokeWidth: 7,
        cursor: 'pointer',
      },
      onMouseUp: (event) => {
        setReleases((value) => value + 1);
        setPosition(`${Math.round(event.x)}, ${Math.round(event.y)}`);
      },
    }),
    text({
      style: {
        text: "RELEASE HERE",
        x: 360,
        y: 162,
        fill: "#17211d",
        font: "900 40px sans-serif",
        textAlign: "center",
      },
    }),
    text({
      style: {
        text: `UP / ${releases} / ${position}`,
        x: 360,
        y: 236,
        fill: "#17211d",
        font: "700 15px monospace",
        textAlign: "center",
      },
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, MouseUpStudy({}));
}
