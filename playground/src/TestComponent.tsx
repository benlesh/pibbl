/** @jsxImportSource @crc/jsx */
// import { jsx, jsxVirtual, processVirtualNode, registerHook } from '@crc/jsx/jsx-runtime';
import { type RenderingContext2D } from '@crc/core';

// Example hook for runtime modification
// registerHook('rect', (type, props) => {
//   // Add debug outline in development
//   if (process.env.NODE_ENV === 'development') {
//     return (p: any) => type({ ...p, strokeStyle: 'red', lineWidth: 1 });
//   }
//   return type;
// });

interface Props {
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  debug?: boolean;
}

// Direct transformation example
export function DirectComponent(props: Props) {
  const { x, y, width, height, text, debug } = props;
  
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fillStyle="blue"
      />
      {text && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          fillStyle="white"
          textAlign="center"
        >
          {text}
        </text>
      )}
    </g>
  );
}

// Virtual tree example
export function VirtualComponent(props: Props & { ctx: RenderingContext2D }) {
  const { x, y, width, height, text, debug, ctx } = props;
  
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
          textAlign="center"
        >
          {text}
        </text>
      )}
    </g>
  );

  // Process the virtual tree with context
  // return processVirtualNode(virtualTree, ctx);
} 
