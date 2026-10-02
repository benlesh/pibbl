import {seededRandom} from './reference-simulation.ts';
const kinds=['marble','paper','cellular'];
export class WasmMaterial {
  constructor(module,width,height) {
    this.width=width;this.height=height;
    const n=width*height;
    this.fieldOffset=65536;this.pixelOffset=this.fieldOffset+n*4;this.alphaOffset=this.pixelOffset+n*4;
    this.lutOffset=(this.alphaOffset+n+3)&~3;
    const pages=Math.ceil((this.lutOffset+1024)/65536);
    this.memory=new WebAssembly.Memory({initial:pages,maximum:pages});
    this.instance=new WebAssembly.Instance(module,{env:{memory:this.memory,abort(){throw new Error('WASM material aborted');}}});
    this.field=new Float32Array(this.memory.buffer,this.fieldOffset,n);
    this.pixels=new Uint8ClampedArray(this.memory.buffer,this.pixelOffset,n*4);
    this.lut=new Uint8ClampedArray(this.memory.buffer,this.lutOffset,1024);
  }
  generate(kind,seed,scale,detail,quality=0) {
    if(!this.instance)throw new Error('WASM material disposed');
    const index=kinds.indexOf(kind);if(index<0)throw new Error('Unknown material kind');
    const random=seededRandom(seed),ox=random()*100,oy=random()*100;
    this.instance.exports.generate(this.fieldOffset,this.width,this.height,index,seed,scale,detail,ox,oy,quality);
    return this.field;
  }
  colorize(lut) {
    if(lut)this.lut.set(lut);
    this.instance.exports.colorize(this.fieldOffset,this.lutOffset,this.pixelOffset,this.alphaOffset,this.width*this.height);
  }
  dispose() {this.instance=this.memory=this.field=this.pixels=this.lut=undefined;}
}

export class MatchedMaterial {
  constructor(createControl,width,height) {
    this.width=width;this.height=height;this.field=new Float32Array(width*height);
    this.control=createControl(this.field);
  }
  generate(kind,seed,scale,detail,quality=0) {
    const random=seededRandom(seed),ox=random()*100,oy=random()*100;
    this.control.generate(0,this.width,this.height,kinds.indexOf(kind),seed,scale,detail,ox,oy,quality);
    return this.field;
  }
  dispose() {this.field=this.control=undefined;}
}
