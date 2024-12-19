/** @jsxImportSource @crc/jsx */
import type { CompEl, g, RenderingContext2D } from '@crc/core';
import { GProps, g } from '@crc/core';

interface Props {
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  debug?: boolean;
}

type GElement = CompEl<GProps>; 
// Direct transformation example
export function DirectComponent(props: Props): JSX.Element {
  const { x, y, width, height, text } = props;
  return (
    <g children={[
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fillStyle="red"
      />,
      text && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          fillStyle="white"
          textAlign="center"
          text={text}
        />
      ),
    ]}
    />
  );
}

// Virtual tree example
export function VirtualComponent(props: Props & { ctx: RenderingContext2D }): JSX.Element {
  const { x, y, width, height, text } = props;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fillStyle="green"
      />
      {text && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          fillStyle="white"
          textAlign="left"
          text={text}
        />
      )}
    </g>
  );
} 
