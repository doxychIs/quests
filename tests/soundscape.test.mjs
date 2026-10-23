import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {buildSync} from 'esbuild';

const code=buildSync({entryPoints:['src/scripts/soundscape.ts'],bundle:true,format:'iife',globalName:'sound',write:false}).outputFiles[0].text;
function setup(world='hub'){
 const dom=new JSDOM('',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 const contexts=[],voices=[],nodes=[],timers=new Map();let hidden=false,id=0;
 Object.defineProperty(w.document,'hidden',{get:()=>hidden});
 w.setTimeout=fn=>{timers.set(++id,fn);return id};w.clearTimeout=id=>timers.delete(id);
 function node(){const param=()=>({value:0,setTargetAtTime(value){this.value=value},setValueAtTime(value){this.value=value},exponentialRampToValueAtTime(value){this.value=value}});const n={gain:param(),frequency:param(),Q:param(),playbackRate:param(),connect(target){this.connected=target;return target},disconnect(){this.disconnected=true},start(){voices.push(this)},stop(time){this.end=time}};nodes.push(n);return n}
 w.AudioContext=class{
  constructor(){this.sampleRate=1000;this.currentTime=0;this.state='running';this.resumes=0;contexts.push(this)}
  createGain(){return node()}createOscillator(){return node()}createBiquadFilter(){return node()}createBufferSource(){return node()}
  createBuffer(channels,length){return{length,getChannelData:()=>new Float32Array(length)}}
  resume(){this.resumes++;this.state='running';return Promise.resolve()}
  suspend(){this.state='suspended';return Promise.resolve()}
  close(){this.state='closed';return Promise.resolve()}
 };
 w.eval(code+`;window.scape=sound.createSoundscape(${JSON.stringify(world)});`);
 return{w,s:w.scape,contexts,voices,nodes,timers,hide(value){hidden=value},close(){w.scape.stop();dom.window.close()}};
}

test('Звук не создаётся до согласия; эффекты не звучат после выключения, на фоне и при нулевой громкости',()=>{
 const x=setup('iznanka');try{
  x.s.setVolume(.25);x.s.cue('open');x.s.type();assert.equal(x.contexts.length,0);
  x.s.set(true);const ctx=x.contexts[0],base=x.voices.length;
  x.s.cue('tuner');assert.ok(x.voices.length>base);const played=x.voices.length;
  x.s.cue('tuner');assert.equal(x.voices.length,played);
  ctx.currentTime=1;x.hide(true);x.s.cue('found');x.s.type();assert.equal(x.voices.length,played);
  x.hide(false);x.s.setVolume(0);x.s.cue('complete');assert.equal(x.voices.length,played);
  x.s.setVolume(.25);x.s.set(false);x.s.cue('complete');assert.equal(x.voices.length,played);
  assert.equal(x.contexts.length,1);
 }finally{x.close()}
});

test('Выключенный звук освобождает аудиопоток; повторное включение не плодит контексты',()=>{
 const x=setup('arhiv');try{
  x.s.set(true);const ctx=x.contexts[0],base=x.voices.length;
  x.s.set(true);assert.equal(x.voices.length,base);assert.equal(ctx.resumes,0);
  x.s.set(false);for(const fn of [...x.timers.values()])fn();assert.equal(ctx.state,'suspended');
  x.s.set(true);assert.equal(ctx.state,'running');assert.equal(ctx.resumes,1);assert.equal(x.contexts.length,1);
  x.s.stop();assert.equal(ctx.state,'closed');assert.equal(x.timers.size,0);
  x.s.set(true);assert.equal(x.contexts.length,2);x.s.cue('open');assert.ok(x.voices.length>base);
 }finally{x.close()}
});

test('Эффекты миров различаются, ограничены по частоте и заканчиваются с отсоединением узлов',()=>{
 const signatures=[];
 for(const world of ['hub','iznanka','arhiv','ostrov']){
  const x=setup(world);try{
   x.s.set(true);const base=x.voices.length;x.s.cue('open');const effect=x.voices.slice(base);
   assert.ok(effect.length>0&&effect.length<=2);assert.ok(effect.every(v=>v.end<=.3));
   signatures.push(effect.map(v=>v.buffer?'noise:'+v.connected.frequency.value:'tone:'+v.frequency.value).join(','));
   for(const v of effect){v.onended();assert.equal(v.disconnected,true)}
   x.s.cue('select');assert.equal(x.voices.length,base+effect.length);
   x.contexts[0].currentTime=1;x.s.cue('complete');assert.equal(x.voices.length,base+effect.length+3);
  }finally{x.close()}
 }
 assert.equal(new Set(signatures).size,4);
});

test('Астрал приглушает Архив, не включает звук сам и восстанавливает исходную громкость',()=>{
 const x=setup('arhiv');try{
  x.s.setAstral(true);assert.equal(x.contexts.length,0);x.s.setVolume(.5);x.s.set(true);
  const filter=x.nodes.find(n=>n.type==='lowpass'),master=x.nodes[0];assert.equal(filter.frequency.value,750);assert.equal(master.gain.value,.32);
  x.s.setAstral(false);assert.equal(filter.frequency.value,20000);assert.equal(master.gain.value,.5);
  x.s.set(false);x.s.setAstral(true);assert.equal(master.gain.value,0);
 }finally{x.close()}
});

test('Сигнал металлоискателя повышает тон при приближении и соблюдает общие настройки',()=>{
 const x=setup('ostrov');try{
  x.s.scan(.5);assert.equal(x.contexts.length,0);x.s.set(true);x.s.scan(.2);const first=x.voices.at(-1),count=x.voices.length;
  x.s.scan(.9);assert.equal(x.voices.length,count);x.contexts[0].currentTime=1;x.s.scan(.9);assert.ok(x.voices.at(-1).frequency.value>first.frequency.value);
  const heard=x.voices.length;x.hide(true);x.contexts[0].currentTime=2;x.s.scan(1);assert.equal(x.voices.length,heard);x.hide(false);x.s.setVolume(0);x.s.scan(1);assert.equal(x.voices.length,heard);x.s.set(false);x.s.scan(1);assert.equal(x.voices.length,heard);
 }finally{x.close()}
});
