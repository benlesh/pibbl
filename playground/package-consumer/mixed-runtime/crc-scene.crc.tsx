/** @jsxImportSource @crc/core */
import { Grid, Rectangle, Text, type CRCNode } from '@crc/core';

export interface PosterProps {
  readonly title: string;
}

export function Poster({ title }: PosterProps): CRCNode {
  return (
    <Grid
      style={{
        width: 240,
        height: 120,
        gridTemplateColumns: [240],
        gridTemplateRows: [80, 40],
      }}
    >
      <Rectangle
        style={{
          width: 240,
          height: 80,
          fill: '#2563eb',
          gridColumnStart: 1,
          gridRowStart: 1,
        }}
      />
      <Group
        style={{
          gridColumnStart: 1,
          gridRowStart: 2,
        }}
      >
        <Text style={{ left: 12, top: 24, fill: '#ffffff' }}>{title}</Text>
      </Group>
    </Grid>
  );
}
