import {Playback} from './playback.mjs';
import {svg,updateSvg} from './svg.mjs';
export class PibblLoader extends HTMLElement {
 static observedAttributes=['ready','paused','label'];
 constructor(){super();this.playback=new Playback();this.attachShadow({mode:'open'}).innerHTML=`<style>:host{display:inline-block;width:320px;max-width:100%;aspect-ratio:64/45}svg{display:block;width:100%;height:100%}</style>`+svg(this.playback.frame());this._raf=null;this._last=null;this._notified=false;this._motion=matchMedia('(prefers-reduced-motion: reduce)');this._onMotion=()=>{if(this._motion.matches)this.playback.showStill();this._render();this._schedule();};}
 connectedCallback(){this.setAttribute('role','img');this._label();this._motion.addEventListener('change',this._onMotion);if(this._motion.matches)this.playback.showStill();if(this.ready)this.complete();this._render();this._schedule();}
 disconnectedCallback(){this._cancel();this._motion.removeEventListener('change',this._onMotion);}
 attributeChangedCallback(name){if(name==='label')this._label();else if(name==='ready'&&this.ready)this.complete();else if(name==='paused'){this.playback[this.paused?'pause':'resume']();this._schedule();}}
 _label(){this.setAttribute('aria-label',this.getAttribute('label')||'Pibbl');}
 get ready(){return this.hasAttribute('ready');}set ready(v){this.toggleAttribute('ready',Boolean(v));}
 get paused(){return this.hasAttribute('paused');}set paused(v){this.toggleAttribute('paused',Boolean(v));}
 get phase(){return this.playback.phase;}
 complete(){this.playback.complete(this._motion.matches);this.removeAttribute('paused');this._render();this._schedule();}
 restart(){this.removeAttribute('ready');this.removeAttribute('paused');this._notified=false;this.playback.restart();if(this._motion.matches)this.playback.showStill();this._render();this._schedule();}
 pause(){this.paused=true;}resume(){this.paused=false;}
 _cancel(){if(this._raf!==null)cancelAnimationFrame(this._raf);this._raf=null;this._last=null;}
 _render(){const f=this.playback.frame();updateSvg(this.shadowRoot,f);this.setAttribute('data-phase',f.phase);if(f.phase==='complete'&&this.playback.requested&&!this._notified){this._notified=true;this.dispatchEvent(new CustomEvent('pibbl-complete',{bubbles:true,composed:true}));}}
 _schedule(){if(!this.isConnected||this.playback.paused||this.phase==='complete'){this._cancel();return;}if(this._raf!==null)return;this._raf=requestAnimationFrame(now=>{this._raf=null;const dt=this._last===null?0:Math.min(now-this._last,50);this._last=now;this.playback.advance(dt);this._render();this._schedule();});}
}
if(!customElements.get('pibbl-loader'))customElements.define('pibbl-loader',PibblLoader);
