import {
  crc,
  crcState,
  defineComp,
  img,
  rect,
  text,
  type CRCController,
} from "@crc/core";

const postcard = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="440" height="240">
    <rect width="440" height="240" fill="#1f4bd8"/>
    <circle cx="320" cy="70" r="42" fill="#f7c948"/>
    <path d="M0 210 L130 86 L240 184 L326 112 L440 214 V240 H0Z" fill="#74d3ae"/>
    <path d="M0 224 L116 132 L202 202 L260 164 L338 222 V240 H0Z" fill="#ff6b57"/>
  </svg>
`)}`;

const ImageStudy = defineComp(function ImageStudy() {
  const [clicks, setClicks] = crcState(0);
  return [
    rect({
      style: {
        x: 0,
        y: 0,
        width: 720,
        height: 420,
        fill: '#f7c948',
      },
    }),
    rect({
      style: {
        x: 108,
        y: 46,
        width: 504,
        height: 328,
        fill: '#fffdf6',
        stroke: '#17211d',
        strokeWidth: 6,
      },
    }),
    img({
      src: postcard,
      x: 140,
      y: 76,
      width: 440,
      height: 240,
      strokeStyle: "#17211d",
      lineWidth: 3,
      cursor: "pointer",
      onClick: () => setClicks((value) => value + 1),
    }),
    text({
      style: {
        text: clicks ?
            `POSTCARD PICKS / ${clicks}` :
          "IMAGE / CLICK THE POSTCARD",
        x: 360,
        y: 336,
        fill: "#17211d",
        font: "800 15px monospace",
        textAlign: "center",
      },
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, ImageStudy({}));
}
