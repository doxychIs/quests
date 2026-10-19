import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {buildSync} from 'esbuild';
import {glyphRows,glyphPath,glyphObject,letterEdits} from '../src/lib/broadcast-glyphs.ts';
import {analogProfiles,newSignalEvent,advanceSignalEvent} from '../src/lib/analog-profiles.ts';

test('Graphical alphabet covers the actual Cyrillic broadcasts, with individually editable contours',()=>{
 const html=fs.readFileSync('dist/iznanka/index.html','utf8'),dom=new JSDOM(html);
 try{
  for(const el of dom.window.document.querySelectorAll('[data-graphic-text]'))for(const char of el.dataset.graphicText)if(!/\s/.test(char))assert.ok(glyphRows[char.toUpperCase()],`Missing vector glyph: ${char}`);
  for(const rows of Object.values(glyphRows)){assert.equal(rows.length,7);assert.ok(rows.every(row=>/^[01]{5}$/.test(row)))}
  assert.ok(glyphPath('Ж').length>30);assert.notEqual(glyphPath('И'),glyphPath('Н'));
  const before=glyphObject('И',0,'ИЗНАНКА'),next=glyphObject('И',1,'ИЗНАНКА');assert.notEqual(before.damage,next.damage);
  letterEdits['TEST']={0:{path:'M0 0h3v7H0Z',rotate:3,opacity:.6}};
  const edited=glyphObject('T',0,'TEST');assert.equal(edited.path,'M0 0h3v7H0Z');assert.equal(edited.rotate,3);assert.equal(edited.opacity,.6);delete letterEdits['TEST'];
 }finally{dom.window.close()}
});

test('Each cabinet has a distinct bounded analog profile; tracking failures use rare random intervals',()=>{
 assert.equal(new Set(Object.values(analogProfiles).map(p=>p.seed)).size,7);
 const stable=analogProfiles['right-floor'],unstable=analogProfiles['unidentified-face'];assert.ok(stable.ghost<unstable.ghost);assert.ok(stable.tracking<unstable.tracking);
 const event=newSignalEvent(()=>.5),first=event.next;assert.ok(first>=7&&first<=31);
 assert.equal(advanceSignalEvent(event,first-1,unstable,()=>.5),0);
 const amplitude=advanceSignalEvent(event,first,unstable,()=>.5);assert.ok(amplitude>0&&amplitude<1.5);assert.ok(event.until-first<.5);assert.ok(event.next-event.until>=17);
 assert.equal(advanceSignalEvent(event,event.until+.01,unstable,()=>.5),0);
});

test('TV vector objects mount on demand and release cleanly; accessible content remains available',()=>{
 const dom=new JSDOM('<p><span data-graphic-text="Не отвечай. 18+"><span class="graphic-transcript">Не отвечай. 18+</span><span data-graphic-lazy="0"></span></span></p>',{runScripts:'outside-only'}),w=dom.window;
 try{
  const code=buildSync({entryPoints:['src/scripts/graphic-lettering.ts'],bundle:true,format:'iife',globalName:'graphics',write:false}).outputFiles[0].text;w.eval(code+';window.graphicAPI=graphics;');
  const root=w.document.querySelector('p');assert.equal(root.querySelectorAll('[data-letter]').length,0);
  w.graphicAPI.hydrateGraphicText(root);assert.equal(root.querySelectorAll('[data-letter]').length,13);assert.equal(root.querySelectorAll('svg text').length,0);assert.ok(root.querySelector('use[href^="#broadcast-glyph-"]'));
  const count=root.querySelectorAll('*').length;w.graphicAPI.hydrateGraphicText(root);assert.equal(root.querySelectorAll('*').length,count);
  w.graphicAPI.releaseGraphicText(root);assert.equal(root.querySelectorAll('[data-letter]').length,0);assert.match(root.textContent,/Не отвечай\. 18\+/);
 }finally{w.close()}
});

test('Rare letter failures affect one letter, stop offscreen, and respect calm and hidden-tab states',async()=>{
 const dom=new JSDOM('<body data-world="iznanka"><span data-letter-flicker="rare"><svg><g data-letter-ink opacity=".8"></g><g data-letter-ink opacity=".9"></g></svg></span></body>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,timers=new Map(),observations=[];let id=0,hidden=false,cancelled=0;const animations=[];
 try{
  Object.defineProperty(w.document,'hidden',{get:()=>hidden});w.setTimeout=(fn,delay)=>{timers.set(++id,{fn,delay});return id};w.clearTimeout=id=>timers.delete(id);
  w.matchMedia=()=>({matches:false,addEventListener(){}});w.IntersectionObserver=class{constructor(fn){this.fn=fn;observations.push(this)}observe(){}disconnect(){}};
  w.Element.prototype.animate=function(frames,options){animations.push({target:this,frames,options});return{finished:new Promise(()=>{}),cancel(){cancelled++}}};
  const NativeObserver=w.MutationObserver;w.MutationObserver=class extends NativeObserver{constructor(fn){super((...args)=>{if(w.document)fn(...args)})}};
  const code=buildSync({entryPoints:['src/scripts/letter-failures.ts'],bundle:true,format:'iife',globalName:'failures',write:false}).outputFiles[0].text;w.eval(code+';failures.initLetterFailures();');
  const root=w.document.querySelector('[data-letter-flicker]');assert.equal(timers.size,0);observations[0].fn([{target:root,isIntersecting:true}]);assert.equal(timers.size,1);
  const [key,timer]=[...timers][0];assert.ok(timer.delay>=6500&&timer.delay<=20500);timers.delete(key);timer.fn();assert.equal(animations.length,1);assert.ok(animations[0].target.hasAttribute('data-letter-ink'));assert.ok(animations[0].options.duration>=680&&animations[0].options.duration<=940);
  observations[0].fn([{target:root,isIntersecting:false}]);assert.equal(cancelled,1);assert.equal(timers.size,0);
  hidden=true;w.document.dispatchEvent(new w.Event('visibilitychange'));observations[0].fn([{target:root,isIntersecting:true}]);assert.equal(timers.size,0);
  hidden=false;w.document.documentElement.classList.add('calm');await Promise.resolve();w.document.dispatchEvent(new w.Event('visibilitychange'));assert.equal(timers.size,0);
 }finally{w.close()}
});

test('Horror graphics remain scoped and initial HTML excludes thousands of hidden letter objects',()=>{
 const horror=fs.readFileSync('dist/iznanka/index.html','utf8');assert.ok(Buffer.byteLength(horror)<350000);
 const dom=new JSDOM(horror);try{assert.ok(dom.window.document.querySelector('.film-copy [data-letter]'));assert.equal(dom.window.document.querySelectorAll('[data-broadcast-program] [data-letter]').length,0);assert.ok(dom.window.document.querySelector('#broadcast-analog-signal'))}finally{dom.window.close()}
 for(const route of ['arhiv','ostrov','about'])assert.doesNotMatch(fs.readFileSync(`dist/${route}/index.html`,'utf8'),/data-graphic-text=/);
});

test('A browser without WebGL retains recognizable source images and cached per-screen fallback surfaces',()=>{
 const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window,calls=[],filters=[];
 try{
  w.HTMLCanvasElement.prototype.getContext=function(type){if(type==='webgl')return null;return new Proxy({drawImage(...args){calls.push(args)},createRadialGradient(){return{addColorStop(){}}}},{get:(o,k)=>k in o?o[k]:()=>{},set(o,k,v){if(k==='filter')filters.push(v);o[k]=v;return true}})};
  const code=buildSync({entryPoints:['src/lib/analog-signal.ts'],bundle:true,format:'iife',globalName:'analog',write:false}).outputFiles[0].text;w.eval(code+';window.analogAPI=analog;');
  const renderer=new w.analogAPI.AnalogSignalRenderer(),source=w.document.createElement('canvas');source.width=640;source.height=480;
  const first=renderer.render('wood-floor',source,1,true),second=renderer.render('left-stack',source,1,true);assert.equal(renderer.mode,'canvas');assert.notEqual(first,second);assert.equal(renderer.render('wood-floor',source,2,true),first);assert.equal(first.width,640);assert.ok(calls.some(args=>args[0]===source));assert.ok(filters.every(filter=>!String(filter).includes('blur')));renderer.destroy();
 }finally{w.close()}
});

