import {
  crc,
  crcState,
  defineComp,
  rect,
  text,
  type CRCController,
} from "@crc/core";

const MouseOutStudy = defineComp(function MouseOutStudy() {
  const [departures, setDepartures] = crcState(0);
  const [inside, setInside] = crcState(false);
  return [
    rect({
      style: {
        x: 0,
        y: 0,
        width: 720,
        height: 420,
        fill: '#17211d',
      },
    }),
    rect({
      style: {
        x: 190,
        y: 68,
        width: 340,
        height: 284,
        fill: inside ? '#f7c948' : '#74d3ae',
        cursor: 'crosshair',
      },
      onMouseOver: () => setInside(true),
      onMouseOut: () => {
        setInside(false);
        setDepartures((value) => value + 1);
      },
    }),
    text({
      style: {
        text: inside ? "YOU ARE IN" : "MINT PORTAL",
        x: 360,
        y: 166,
        fill: "#17211d",
        font: "900 42px sans-serif",
        textAlign: "center",
      },
    }),
    text({
      style: {
        text: `DEPARTURES / ${departures}`,
        x: 360,
        y: 244,
        fill: "#17211d",
        font: "700 15px monospace",
        textAlign: "center",
      },
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, MouseOutStudy({}));
}
