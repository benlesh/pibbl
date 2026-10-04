import { expect, it } from 'vitest';
import { bytes } from './embers-bytes';
it('produces 1200 finite, fading airborne ember descriptors without overlapping history', () => {
  const memory = new WebAssembly.Memory({ initial: 2, maximum: 2 });
  const module = new WebAssembly.Module(Uint8Array.from(atob(bytes), c => c.charCodeAt(0)));
  const exports = new WebAssembly.Instance(module, {env:{memory,abort(){throw new Error('kernel abort');}}}).exports as Record<string, (...args:number[])=>void>;
  const values = new Float64Array(memory.buffer,16384);
  exports.initialize!(9); exports.births!(400,0);
  exports.sample!(.5,1,400,0,110,12,40,50,120,120,60);
  const ages: { age: number; alpha: number }[] = [];
  for(let i=0;i<1200;i++) {
    const offset=1566+i*8;
    expect(values[offset+2]).toBeGreaterThanOrEqual(1);
    expect(values[offset+5]).toBeGreaterThan(0);
    expect(values[offset+5]).toBeLessThanOrEqual(1);
    ages.push({age:values[offset+7]!,alpha:values[offset+5]!});
  }
  ages.sort((a,b)=>a.age-b.age);
  expect(ages[0]!.alpha).toBeGreaterThan(.95);
  expect(ages.at(-1)!.alpha).toBeLessThan(.01);
  for(let i=1;i<ages.length;i++)expect(ages[i]!.alpha).toBeLessThanOrEqual(ages[i-1]!.alpha);
  exports.births!(400,700);
  for(let i=0;i<1200;i++)values[11166+i]=.5;
  exports.sample!(.5,1,400,700,110,12,40,50,120,120,60);
  for(let i=0;i<1200;i++)expect(values[11166+i]).toBe(.5);
});

it('launches embers in all directions then turns every fragment into an upward float', () => {
  const memory = new WebAssembly.Memory({initial:2,maximum:2});
  const module = new WebAssembly.Module(Uint8Array.from(atob(bytes),c=>c.charCodeAt(0)));
  const exports = new WebAssembly.Instance(module,{env:{memory,abort(){throw Error('kernel abort');}}}).exports as Record<string,(...args:number[])=>void>;
  const values = new Float64Array(memory.buffer,16384);
  exports.initialize!(9);
  for(let i=0;i<1200;i++){values[11166+i]=.5;values[12366+i]=0;}
  const noise=(n:number)=>{const v=Math.sin(n*127.1+9*31.7)*43758.5453;return v-Math.floor(v);};
  const quadrants = new Set<string>();
  for(let i=0;i<80;i++) {
    const lifetime=700*(.55+.45*noise(i+5));
    const sample=(age:number,entering:number)=>{
      exports.sample!(.5,entering,age*lifetime,700,0,12,40,50,120,120,60);
      return [values[1566+i*8+3]!,values[1566+i*8+4]!];
    };
    for (const value of sample(0,1)) expect(value).toBeCloseTo(0);
    const early = sample(.035,1);
    quadrants.add(`${Math.sign(early[0]!)}:${Math.sign(early[1]!)}`);
    const late = sample(.7,1)[1]! - sample(.78,1)[1]!;
    expect(late).toBeGreaterThan(0);
    expect(sample(.3,1)).toEqual(sample(.3,0));
  }
  expect(quadrants).toEqual(new Set(['1:1', '-1:1', '1:-1', '-1:-1']));
});

it('reflects a swept physics particle at the collision point and separates it from the surface', () => {
  const memory=new WebAssembly.Memory({initial:4,maximum:4});
  const module=new WebAssembly.Module(Uint8Array.from(atob(bytes),c=>c.charCodeAt(0)));
  const exports=new WebAssembly.Instance(module,{env:{memory,abort(){throw Error('kernel abort');}}}).exports as Record<string,(...args:number[])=>void>;
  const v=new Float64Array(memory.buffer,16384), s=14000;
  v[s]=30;v[s+1]=110;v[s+2]=20;v[s+3]=100;v[s+5]=20;v[s+6]=90;
  exports.collidePhysics!(0,.5,0,-1,.6);
  expect(v[s]).toBe(25);expect(v[s+1]).toBeCloseTo(99.95);
  expect(v[s+2]).toBe(20);expect(v[s+3]).toBeCloseTo(-60);
});
