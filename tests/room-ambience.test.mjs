import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {buildSync} from 'esbuild';

const code=buildSync({entryPoints:['src/scripts/soundscape.ts'],bundle:true,format:'iife',globalName:'sound',write:false}).outputFiles[0].text;
function setup(world='iznanka',stereo=true){
 const dom=new JSDOM('',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 const contexts=[],nodes=[],voices=[];let hidden=false;
 Object.defineProperty(w.document,'hidden',{get:()=>hidden});
 function param(){return{value:0,events:[],setTargetAtTime(value,time,constant){this.value=value;this.events.push({value,time,constant})},setValueAtTime(value,time){this.value=value;this.events.push({value,time})},exponentialRampToValueAtTime(value,time){this.value=value;this.events.push({value,time})}}}
 function node(kind){const n={kind,gain:param(),frequency:param(),Q:param(),pan:param(),playbackRate:param(),connect(target){this.connected=target;return target},disconnect(){this.disconnected=true},start(time=0){this.begin=time;voices.push(this)},stop(time=0){this.end=time}};nodes.push(n);return n}
 w.AudioContext=class{
  constructor(){this.sampleRate=1000;this.currentTime=0;this.state='running';contexts.push(this);if(!stereo)this.createStereoPanner=undefined}
  createGain(){return node('gain')}createOscillator(){return node('oscillator')}createBiquadFilter(){return node('filter')}createBufferSource(){return node('buffer')}createStereoPanner(){return node('panner')}
  createBuffer(channels,length){return{length,getChannelData:()=>new Float32Array(length)}}
  resume(){this.state='running';return Promise.resolve()}suspend(){this.state='suspended';return Promise.resolve()}close(){this.state='closed';return Promise.resolve()}
 };
 w.eval(code+`;window.scape=sound.createSoundscape(${JSON.stringify(world)});`);
 return{s:w.scape,contexts,nodes,voices,hide(value){hidden=value},close(){w.scape.stop();dom.window.close()}};
}

test('События комнаты не включают звук сами и соблюдают мир, видимость, громкость и состояние контекста',()=>{
 const x=setup();try{
  x.s.room({kind:'cloth'});assert.equal(x.contexts.length,0);
  x.s.set(true);const ctx=x.contexts[0],count=x.voices.length;
  x.hide(true);x.s.room({kind:'cloth'});assert.equal(x.voices.length,count);
  x.hide(false);x.s.setVolume(0);x.s.room({kind:'light'});assert.equal(x.voices.length,count);
  x.s.setVolume(.35);ctx.state='suspended';x.s.room({kind:'pipe'});assert.equal(x.voices.length,count);
  ctx.state='running';x.s.set(false);x.s.room({kind:'step'});assert.equal(x.voices.length,count);
  x.s.stop();x.s.room({kind:'cloth'});assert.equal(x.contexts.length,1);assert.equal(x.voices.length,count);
 }finally{x.close()}
 for(const world of ['hub','arhiv','ostrov']){const other=setup(world);try{other.s.set(true);const count=other.voices.length;other.s.room({kind:'cloth'});assert.equal(other.voices.length,count)}finally{other.close()}}
});

test('Шорох, лампа, труба и шаг имеют тихие конечные огибающие, ограниченную панораму и полную очистку',()=>{
 const x=setup();try{
  x.s.set(true);const ctx=x.contexts[0];
  for(const [index,kind] of ['cloth','light','pipe','step'].entries()){
   ctx.currentTime=index*4;const firstNode=x.nodes.length,firstVoice=x.voices.length;
   x.s.room({kind,strength:10,pan:index%2?10:-10});
   const effectNodes=x.nodes.slice(firstNode),effectVoices=x.voices.slice(firstVoice);
   assert.ok(effectVoices.length>=1&&effectVoices.length<=2);
   for(const voice of effectVoices){
    const duration=voice.end-voice.begin;
    assert.ok(duration>0&&duration<=1.1);assert.equal(voice.loop,undefined);
    if(voice.buffer)assert.ok(voice.buffer.length/ctx.sampleRate>=duration,'Шумовая подложка покрывает весь хвост огибающей');
   }
   for(const gain of effectNodes.filter(n=>n.kind==='gain')){
    assert.equal(gain.gain.events[0].value,.0001);assert.equal(gain.gain.events.at(-1).value,.0001);
    assert.ok(Math.max(...gain.gain.events.map(e=>e.value))<=.032);
   }
   for(const panner of effectNodes.filter(n=>n.kind==='panner'))assert.equal(Math.abs(panner.pan.value),.85);
   for(const voice of effectVoices)voice.onended();
   assert.ok(effectNodes.every(n=>n.disconnected),'Каждый узел одноразового звука отсоединяется после завершения');
  }
 }finally{x.close()}
});

test('Частые события не копят голоса; выключение и закрытие освобождают ещё звучащие источники',()=>{
 const x=setup();try{
  x.s.set(true);const ctx=x.contexts[0],firstNode=x.nodes.length,firstVoice=x.voices.length;
  x.s.room({kind:'cloth',strength:0});x.s.room({kind:'unknown'});assert.equal(x.voices.length,firstVoice);
  x.s.room({kind:'cloth'});const count=x.voices.length;
  for(let i=0;i<20;i++)x.s.room({kind:'cloth'});assert.equal(x.voices.length,count);
  ctx.currentTime=.25;x.s.room({kind:'light'});assert.equal(x.voices.length,count+2);
  ctx.currentTime=1;x.s.room({kind:'step'});assert.equal(x.voices.length,count+2,'Не более трёх голосов при незакончившемся шорохе');
  x.s.set(false);assert.ok(x.nodes.slice(firstNode).every(n=>n.disconnected));
  x.s.set(true);ctx.currentTime=4;const finalNode=x.nodes.length;x.s.room({kind:'pipe'});assert.ok(x.nodes.length>finalNode);
  x.s.stop();assert.ok(x.nodes.slice(finalNode).every(n=>n.disconnected));
  const stopped=x.nodes.length;x.s.room({kind:'cloth'});assert.equal(x.nodes.length,stopped);
 }finally{x.close()}
});

test('Комната звучит без StereoPanner и использует существующий мастер громкости',()=>{
 const x=setup('iznanka',false);try{
  x.s.setVolume(.2);x.s.set(true);const count=x.voices.length;
  x.s.room({kind:'cloth',pan:NaN,strength:NaN});assert.equal(x.voices.length,count+1);
  const gain=x.voices.at(-1).connected.connected;assert.equal(gain.kind,'gain');assert.equal(gain.connected,x.nodes[0]);assert.equal(x.nodes[0].gain.value,.2);
 }finally{x.close()}
});
