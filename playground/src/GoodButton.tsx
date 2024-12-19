/** @jsxImportSource @crc/jsx */
import { CompFn, CRCMouseEvent, defineComp, RenderingContext2D } from '@crc/core';

interface GoodButtonProps {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  onClick?: (e: CRCMouseEvent) => void;
  fillStyle?: string;
  strokeStyle?: string;
  hoverFillStyle?: string;
  hoverStrokeStyle?: string;
}

function GoodButtonComponent(props: GoodButtonProps, _ctx: RenderingContext2D) {
  const {
    x,
    y,
    width,
    height,
    label,
    onClick,
    fillStyle = '#4a90e2',
    strokeStyle = '#3a80d2',
    hoverFillStyle = '#357abd',
    hoverStrokeStyle = '#2a6496',
  } = props;

  return (
    <g children={[
      <rect
        key="button-rect"
        x={x}
        y={y}
        width={width}
        height={height}
        fillStyle={fillStyle}
        strokeStyle={strokeStyle}
        lineWidth={3}
        cursor="pointer"
        onClick={onClick}
        onMouseOver={() => {
          console.log('mouse over');
        }}
        alignToPixelGrid="round"
        onMouseOut={() => ({
          fillStyle,
          strokeStyle,
        })}
      />,
      <text
        key="button-text"
        x={x + width / 2}
        y={y + height / 2}
        text={label}
        fillStyle="#ffffff"
        font="24px Arial"
        textAlign="center"
        textBaseline="middle"
      />,
    ]}
    />
  );
};

export const GoodButton = defineComp(GoodButtonComponent);
