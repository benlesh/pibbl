import {
  crc,
  crcState,
  defineComp,
  RenderingContext2D,
  rect,
  text,
} from '@crc/core';

function Button(props: ButtonProps, _ctx: RenderingContext2D) {
  const [backgroundColor, setBackgroundColor] = crcState('gray');

  return [
    rect({
      x: props.x,
      y: props.y,
      width: props.width,
      height: props.height,
      fillStyle: backgroundColor,
      onClick: props.onClick,
      onMouseOver: () => setBackgroundColor('lightgray'),
      onMouseOut: () => setBackgroundColor('gray'),
      cursor: 'pointer',
    }),
    text({
      x: props.x + props.width / 2,
      y: props.y + props.height / 2,
      text: props.text,
      fillStyle: 'black',
      textAlign: 'center',
      textBaseline: 'middle',
    }),
  ];
}

const button = defineComp(Button);

interface IncrementDecrementProps {
  startingValue: number;
}

function IncrementDecrement(
  props: IncrementDecrementProps,
  _ctx: RenderingContext2D
) {
  const [value, setValue] = crcState(props.startingValue);

  return [
    text({
      x: 10,
      y: 10,
      text: `Value: ${value}`,
      fillStyle: 'black',
    }),
    button({
      x: 10,
      y: 30,
      width: 70,
      height: 50,
      text: 'Increment',
      onClick: () => setValue(value + 1),
    }),
    button({
      x: 90,
      y: 30,
      width: 70,
      height: 50,
      text: 'Decrement',
      onClick: () => setValue(value - 1),
    }),
  ];
}

interface ButtonProps {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  onClick: () => void;
}

const incrementDecrement = defineComp(IncrementDecrement);

function main() {
  const canvas = document.getElementById('example-canvas') as HTMLCanvasElement;

  // You'll want to add this to ensure the canvas doesn't get selected when clicked.
  // CRC doesn't do this by default, because it's possible a user wants to select the image
  // that was created by CRC for some reason.
  canvas.style.userSelect = 'none';

  crc(canvas, incrementDecrement({ startingValue: 10 }));
}

main();
