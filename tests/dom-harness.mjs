import fs from 'node:fs';
import path from 'node:path';
import {JSDOM,VirtualConsole} from 'jsdom';
import {buildSync} from 'esbuild';
const compiled=new Map();
export function setupDOM(route='',options={}){
 const html=fs.readFileSync('dist/'+(route?route+'/':'')+'index.html','utf8'),errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(html,{url:'https://gran.example/'+route+'/'+(options.search||''),runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window,d=w.document;
 w.matchMedia=q=>({matches:q.includes('pointer:coarse')?!!options.coarse:!!options.reduced,addEventListener(){},removeEventListener(){}});
 w.observers=[];w.IntersectionObserver=class{constructor(callback){this.callback=callback;this.targets=[];w.observers.push(this)}observe(el){this.targets.push(el)}unobserve(){}disconnect(){}trigger(el,on=true){this.callback([{target:el,isIntersecting:on}])}};
 w.ResizeObserver=class{observe(){}disconnect(){}};w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};w.scrollTo=()=>{};w.Element.prototype.scrollIntoView=()=>{};w.HTMLElement.prototype.scrollTo=()=>{};w.scrollTo=()=>{};
 w.Element.prototype.animate=()=>({finished:Promise.resolve(),cancel(){}});w.Element.prototype.getAnimations=()=>[];
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'))};
 w.canvasCalls=0;w.HTMLCanvasElement.prototype.getContext=function(){w.canvasCalls++;return options.nullCanvas&&this.matches('[data-room-projection]')?null:new Proxy({},{get:(o,k)=>k in o?o[k]:()=>{}})};
 w.HTMLMediaElement.prototype.play=function(){this.dataset.playing='yes';return Promise.resolve()};w.HTMLMediaElement.prototype.pause=function(){this.dataset.playing='no'};
 w.HTMLAnchorElement.prototype.click=function(){w.lastDownload=this.download};w.URL.createObjectURL=b=>{w.lastBlob=b;return'blob:test'};w.URL.revokeObjectURL=()=>{};
 const NativeObserver=w.MutationObserver;w.MutationObserver=class extends NativeObserver{constructor(fn){super((...args)=>{if(w.document)fn(...args)})}};
 w.queueMicrotask=fn=>Promise.resolve().then(()=>{if(w.document)fn()});
 if(options.adult)w.sessionStorage.setItem('gran-adult','yes');if(options.surprise)w.sessionStorage.setItem('gran-surprise','yes');
 if(options.calm)w.localStorage.setItem('gran-motion-choice','reduced');if(options.legacyCalm)w.localStorage.setItem('gran-calm','yes');
 for(const s of d.querySelectorAll('script:not([type=module])'))if(!s.src)w.eval(s.textContent);
 let code='';for(const script of d.querySelectorAll('script[type=module]')){if(script.src){code+='import '+JSON.stringify(path.resolve('dist/'+new URL(script.src).pathname))+';\n'}else{code+='(()=>{'+script.textContent+'})();\n'}}
 if(!compiled.has(code))compiled.set(code,buildSync({stdin:{contents:code,resolveDir:process.cwd(),sourcefile:'dom-entry.js'},bundle:true,format:'iife',write:false,logLevel:'silent'}).outputFiles[0].text);
 w.eval(compiled.get(code));
 return{dom,w,d,errors,close(){dom.window.close()},intersect(el,on=true){for(const ob of w.observers)if(ob.targets.includes(el))ob.trigger(el,on)}};
}
