import { describe, it, expect } from 'vitest';
import { transformJSX } from '../src';

describe('transformJSX', () => {
  it('should transform JSX with pragma', async () => {
    const input = `
/** @jsx crc.createElement */
const element = <div>Hello</div>;
`;
    const result = await transformJSX(input, 'test.tsx', { runtime: 'classic' });
    expect(result.code).toContain('crc.createElement');
    expect(result.code).toContain('"div"');
    expect(result.code).toContain('"Hello"');
  });

  it('should transform JSX with importSource', async () => {
    const input = `
/** @jsxImportSource crc */
const element = <div>Hello</div>;
`;
    const result = await transformJSX(input, 'test.tsx');
    expect(result.code).toContain('import { jsx as _jsx } from "crc/jsx-runtime"');
  });

  it('should handle props correctly', async () => {
    const input = `
/** @jsx crc.createElement */
const element = <div className="test" onClick={() => {}}>Hello</div>;
`;
    const result = await transformJSX(input, 'test.tsx', { runtime: 'classic' });
    expect(result.code).toContain('className: "test"');
    expect(result.code).toContain('onClick: ');
  });

  it('should skip non-CRC files', async () => {
    const input = `
const element = <div>Hello</div>;
`;
    const result = await transformJSX(input, 'test.tsx');
    expect(result.code).toBe(input);
  });
}); 
