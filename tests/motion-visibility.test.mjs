import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {buildSync} from 'esbuild';

const compiled=new Map();
function environment(file,html='<div id="target"></div>'){
 const dom=new JSDOM(html,{url:'https://test.example/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document;let hidden=false,id=0;const frames=new Map(),observers=[];
 Object.defineProperty(d,'hidden',{get:()=>hidden,configurable:true});
 w.requestAnimationFrame=callback=>{frames.set(++id,callback);return id};w.cancelAnimationFrame=id=>frames.delete(id);
 w.IntersectionObserver=class{constructor(callback){this.callback=callback;this.targets=new Set();observers.push(this)}observe(el){this.targets.add(el)}unobserve(el){this.targets.delete(el)}disconnect(){this.targets.clear()}};
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 const NativeMutationObserver=w.MutationObserver;w.MutationObserver=class extends NativeMutationObserver{constructor(fn){super((...args)=>{if(w.document)fn(...args)})}};
 if(!compiled.has(file))compiled.set(file,buildSync({entryPoints:['src/scripts/'+file+'.ts'],bundle:true,format:'iife',globalName:'motionModule',write:false}).outputFiles[0].text);
 w.eval(compiled.get(file)+';window.motionExports=motionModule;');
 return{w,d,api:w.motionExports,frames,observers,intersect(el,on){for(const ob of observers)if(ob.targets.has(el))ob.callback([{target:el,isIntersecting:on}])},flush(t=16){const callbacks=[...frames.values()];frames.clear();callbacks.forEach(cb=>cb(t))},hide(on){hidden=on;d.dispatchEvent(new w.Event('visibilitychange'))},close(){dom.window.close()}};
}

test('Canvas: вне экрана и на скрытой вкладке нет запросов кадров; возвращение не ускоряет игру',()=>{
 const x=environment('visible-loop');try{
  const target=x.d.querySelector('#target'),deltas=[];let enabled=true;
  const loop=x.api.createVisibleLoop(target,(_t,dt)=>deltas.push(dt),()=>enabled);
  assert.equal(x.frames.size,0);x.intersect(target,true);assert.equal(x.frames.size,1);
  x.flush(16);assert.equal(deltas.length,1);assert.equal(x.frames.size,1);
  x.intersect(target,false);assert.equal(x.frames.size,0);x.flush(10000);assert.equal(deltas.length,1);
  x.hide(true);x.intersect(target,true);assert.equal(x.frames.size,0);
  x.hide(false);assert.equal(x.frames.size,1);x.flush(20000);assert.equal(deltas.at(-1),1/60);
  enabled=false;loop.sync();assert.equal(x.frames.size,0);loop.destroy();
 }finally{x.close()}
});

test('Видео: фактическая видимость, фон вкладки, спокойный режим и ручная пауза независимы',async()=>{
 const x=environment('motion-visibility','<video data-lazy-video data-src="/film.mp4"></video>');try{
  const video=x.d.querySelector('video');let paused=true,plays=0;
  Object.defineProperty(video,'paused',{get:()=>paused});
  video.play=()=>{paused=false;plays++;video.dispatchEvent(new x.w.Event('play'));return Promise.resolve()};
  video.pause=()=>{if(!paused){paused=true;video.dispatchEvent(new x.w.Event('pause'))}};
  x.api.initLazyVideoVisibility();assert.equal(video.getAttribute('src'),null);
  x.intersect(video,true);assert.equal(paused,false);assert.equal(plays,1);
  x.intersect(video,false);assert.equal(paused,true);x.intersect(video,true);assert.equal(paused,false);
  video.pause();const manual=plays;x.intersect(video,false);x.intersect(video,true);x.hide(true);x.hide(false);assert.equal(plays,manual);assert.equal(paused,true);
  await video.play();x.hide(true);assert.equal(paused,true);x.hide(false);assert.equal(paused,false);
  x.d.documentElement.classList.add('calm');await Promise.resolve();assert.equal(paused,true);
  x.d.documentElement.classList.remove('calm');await Promise.resolve();assert.equal(paused,false);
 }finally{x.close()}
});

test('Циклические анимации: вне экрана пауза сохраняет фазу; конечные и чужие паузы не меняются',()=>{
 const x=environment('motion-visibility','<h2 id="a">Сигнал</h2><p id="b">Текст</p><p id="c">Ручная пауза</p>');try{
  const elements=[...x.d.querySelectorAll('h2,p')];
  elements.forEach(el=>{el.style.animationPlayState='running';el.getBoundingClientRect=()=>({top:10,left:0,bottom:100,right:300,width:300,height:90})});
  const animation=(target,iterations=Infinity,state='running')=>({effect:{target,getTiming:()=>({iterations})},currentTime:4230,playState:state,pending:false,pauses:0,plays:0,pause(){this.playState='paused';this.pauses++},play(){this.playState='running';this.plays++}});
  const [a,b,c]=elements.map((el,i)=>animation(el,Infinity,i===2?'paused':'running')),finite=animation(elements[0],1);
  x.d.getAnimations=()=>[a,b,c,finite];x.api.initAnimationVisibility();
  x.intersect(elements[0],false);assert.equal(a.playState,'paused');assert.equal(finite.playState,'running');
  x.hide(true);assert.equal(b.playState,'paused');x.hide(false);assert.equal(b.playState,'running');assert.equal(a.playState,'paused');
  x.intersect(elements[0],true);assert.equal(a.playState,'running');assert.equal(a.currentTime,4230);
  x.intersect(elements[2],false);x.intersect(elements[2],true);assert.equal(c.plays,0);assert.equal(c.playState,'paused');
 }finally{x.close()}
});
