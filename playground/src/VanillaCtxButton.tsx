import { defineComp, RenderingContext2D } from '@crc/core';

interface ButtonProps {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  fillStyle?: string;
  strokeStyle?: string;
  cornerRadius?: number;
}

function VanillaCtxButtonComponent(props: ButtonProps, ctx: RenderingContext2D) {
  const {
    x,
    y,
    width,
    height,
    label,
    fillStyle = '#4a90e2',
    strokeStyle = '#3a80d2',
    cornerRadius = 8,
  } = props;

  // Draw button shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;

  // Draw rounded rectangle background
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, cornerRadius);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.restore();

  // Draw subtle border
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, cornerRadius);
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw text with slight text shadow for depth
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Text shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 1;

  ctx.fillText(label, x + width / 2, y + height / 2);
  ctx.restore();
}

export const VanillaCtxButton = defineComp(VanillaCtxButtonComponent);
