import { crc, rect } from '@crc/core';
import { useEffect, useRef } from 'react';

export function BasicCRCTest() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      crc(
        canvas,
        rect({ x: 10, y: 10, width: 100, height: 100, fillStyle: 'red' })
      );
    }
  }, []);

  return <canvas ref={canvasRef} />;
}
