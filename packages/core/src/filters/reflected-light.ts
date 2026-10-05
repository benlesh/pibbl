import { isSignal } from '../lib/signals/graph.js';
import { layoutDiagnostic } from '../lib/style/diagnostics.js';
import { CRC_FILTER_EXECUTOR, type CRCFilter, type CRCFilterExecutor, type CRCReflectedLightFilterOptions } from '../lib/style/filter-types.js';
import { borrowTextureRaster, validateTexturePaint } from '../lib/textures/texture-protocol.js';
import { filterBoundaryExecutor, type CustomPreparedFilter } from './filter-executor.js';
import { processReflection, isReflectionImage } from './render-reflection-boundary.js';
import { concreteColor } from './native-color.js';

const definitions = new WeakMap<CRCFilter, Readonly<CRCReflectedLightFilterOptions>>();
const executor: CRCFilterExecutor = {
  prepare(value, property, context) {
    const options=definitions.get(value);
    if(!options) throw new Error('A reflected-light filter value was created by an incompatible CRC runtime.');
    const fail=(key:string,value:unknown,reason:string)=>layoutDiagnostic({component:context.component,property:`${property}.${key}`,value,algorithm:context.algorithm,constraints:context.constraints,reason});
    const numeric=(key:'opacity'|'threshold'|'softness',fallback:number,min:number,max:number)=>{
      const input=options[key]; const value=input===undefined?fallback:isSignal(input)?input.get():input;
      if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(key==='softness'&&value===0)) throw fail(key,value,`must be finite and within ${min}..${max}${key==='softness'?' (strictly positive)':''}`);
      return value;
    };
    const opacity=numeric('opacity',0.15,0,1), threshold=numeric('threshold',0.1,-1,1), softness=numeric('softness',0.25,0,2);
    const direction: unknown = options.direction ?? [-0.6, -0.8];
    if (!Array.isArray(direction) || direction.length !== 2 || !direction.every(value => typeof value === 'number' && Number.isFinite(value))) {
      throw fail('direction', direction, 'must contain two finite components with nonzero length');
    }
    const length = Math.hypot(direction[0], direction[1]);
    if (length === 0) throw fail('direction', direction, 'must contain two finite components with nonzero length');
    const candidateRegion: unknown = options.region;
    if (!candidateRegion || typeof candidateRegion !== 'object') {
      throw fail('region', candidateRegion, 'must have finite coordinates and positive dimensions');
    }
    const { x, y, width, height } = candidateRegion as { x?: unknown; y?: unknown; width?: unknown; height?: unknown };
    if (![x, y, width, height].every(value => typeof value === 'number' && Number.isFinite(value))) {
      throw fail('region', candidateRegion, 'must have finite coordinates and positive dimensions');
    }
    const numericRegion = { x: x as number, y: y as number, width: width as number, height: height as number };
    if (numericRegion.width <= 0 || numericRegion.height <= 0) {
      throw fail('region', candidateRegion, 'must have finite coordinates and positive dimensions');
    }
    const region = Object.freeze(numericRegion);
    const map=isSignal(options.map)?options.map.get():options.map;
    try { validateTexturePaint(map); if(opacity!==0) borrowTextureRaster(map,()=>undefined); }
    catch(error) { throw fail('map',map,error instanceof Error?error.message:String(error)); }
    const source=options.source===undefined?'#ffffff':isSignal(options.source)?options.source.get():options.source;
    if(typeof source==='string') {
      concreteColor(source,`${property}.source`,context);
      if(typeof CSS==='undefined'||!CSS.supports('color',source)) throw fail('source',source,'must be a supported concrete CSS color');
    } else if(isReflectionImage(source)) {
      const ready='naturalWidth' in source?source.complete&&source.naturalWidth>0&&source.naturalHeight>0:source.width>0&&source.height>0;
      if(!ready) throw fail('source',source,'image must already be decoded and have positive dimensions');
    } else {
      try { validateTexturePaint(source); if(opacity!==0) borrowTextureRaster(source,()=>undefined); }
      catch(error) { throw fail('source',source,error instanceof Error?error.message:String(error)); }
    }
    const settings={opacity,threshold,softness,direction:[direction[0]/length,direction[1]/length] as const};
    const process=(warp?:CustomPreparedFilter['textureWarp']):NonNullable<CustomPreparedFilter['process']>=>(input,windows)=>{
      try { return processReflection(input,windows,map,source,settings,region,warp); }
      catch(error) { const failure=fail('source',source,`reflected-light processing failed: ${error instanceof Error?error.message:String(error)}`); Object.defineProperty(failure,'cause',{value:error});throw failure; }
    };
    return Object.freeze({
      executor:filterBoundaryExecutor,
      reverseInfluence:output=>({...output}),
      process:opacity===0?undefined:process(),
      fuseWithPrevious:previous=>previous.textureWarp?Object.freeze({executor:filterBoundaryExecutor,reverseInfluence:previous.reverseInfluence,process:process(previous.textureWarp)}):undefined,
    } satisfies CustomPreparedFilter);
  },
  render:filterBoundaryExecutor.render,
};

/**
 * Adds slope-selective surface light without changing scene alpha or geometry.
 *
 * @param options - Lighting texture and reflected-light appearance settings. See
 * {@link CRCReflectedLightFilterOptions} .
 * @returns A reflected-light filter descriptor for style.filter. See {@link CRCFilter}.
 *
 * @see {@link CRCReflectedLightFilterOptions}
 * @see {@link CRCFilter}
 */
export function reflectedLight(options: CRCReflectedLightFilterOptions): CRCFilter {
  const rawOptions = options as unknown as { readonly region: unknown; readonly direction?: unknown };
  const region = rawOptions.region && typeof rawOptions.region === 'object'
    ? Object.freeze({ ...(rawOptions.region as object) })
    : rawOptions.region;
  const direction = rawOptions.direction === undefined
    ? undefined
    : Array.isArray(rawOptions.direction)
      ? Object.freeze([...rawOptions.direction])
      : rawOptions.direction;
  const definition = Object.freeze({ ...options, region, direction }) as Readonly<CRCReflectedLightFilterOptions>;
  const value = Object.freeze({ [CRC_FILTER_EXECUTOR]: executor });
  definitions.set(value, definition);
  return value;
}
