import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {JSDOM} from 'jsdom';
import {buildSync} from 'esbuild';

const code=buildSync({entryPoints:['src/scripts/recorded-audio.ts'],bundle:true,format:'iife',globalName:'recordings',write:false}).outputFiles[0].text;
test('Музыка передаётся потоком, файлы эффектов кэшируются, отключение музыки не выключает эффекты',async()=>{
 const dom=new JSDOM('',{url:'https://gran.example/quests/arhiv/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 const requests=[],voices=[],paused=new WeakMap();let hidden=false,decoded=0,plays=0;
 Object.defineProperty(w.document,'hidden',{get:()=>hidden});
 Object.defineProperty(w.HTMLMediaElement.prototype,'paused',{get(){return paused.get(this)??true}});
 w.HTMLMediaElement.prototype.play=function(){plays++;paused.set(this,false);return Promise.resolve()};w.HTMLMediaElement.prototype.pause=function(){paused.set(this,true)};w.HTMLMediaElement.prototype.load=function(){};
 const param=()=>({value:0,setTargetAtTime(){},cancelScheduledValues(){}});
 const node=()=>({gain:param(),playbackRate:param(),connect(target){return target},disconnect(){},start(){voices.push(this)},stop(){this.stopped=true}});
 const ctx={state:'running',currentTime:0,createGain:node,createBufferSource:node,createMediaElementSource:node,async decodeAudioData(data){decoded++;assert.ok(data.byteLength>44);return{duration:.6}}};
 w.fetch=async url=>{requests.push(url);const b=fs.readFileSync(path.join('public',new URL(url,'https://gran.example').pathname.replace('/quests/','')));return{ok:true,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)}};
 try{
  w.eval(code+';window.make=recordings.createRecordedAudio;');const deck=w.make(ctx,node(),'arhiv','/quests/');
  await deck.ready;assert.ok(decoded>=3);assert.ok(requests.every(url=>url.startsWith('/quests/audio/')&&url.endsWith('.wav')));
  assert.equal(w.document.querySelector('audio'),null);assert.equal(deck.play('open'),false);
  deck.setActive(true);const music=w.document.querySelector('audio');assert.match(music.src,/\/quests\/audio\/archive-satie\.mp3$/);assert.equal(music.paused,false);assert.equal(plays,1);
  deck.setActive(true);assert.equal(plays,1);assert.equal(deck.play('open'),true);const count=voices.length;
  deck.setActive(true,false);assert.equal(music.paused,true);assert.equal(deck.play('found'),true);assert.ok(voices.length>count);
  const loaded=requests.length;deck.play('found');assert.equal(requests.length,loaded);
  hidden=true;assert.equal(deck.play('open'),false);hidden=false;deck.setActive(false);assert.equal(deck.play('open'),false);
  deck.stop();assert.equal(w.document.querySelector('audio'),null);assert.equal(deck.play('open'),false);
 }finally{dom.window.close()}
});

test('Аудиофайлы действительно существуют; короткие эффекты без клиппинга и длинных пустых хвостов',()=>{
 const files=fs.readdirSync('public/audio').filter(name=>name.endsWith('.wav'));assert.ok(files.length>=8);
 for(const name of files){const b=fs.readFileSync('public/audio/'+name);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.readUInt16LE(22),1);const duration=(b.length-44)/2/b.readUInt32LE(24);assert.ok(duration>.015&&duration<1.5,name);let peak=0,energy=0;for(let i=44;i<b.length;i+=2){const v=b.readInt16LE(i)/32768;peak=Math.max(peak,Math.abs(v));energy+=v*v}assert.ok(peak<.81&&peak>.1,name);assert.ok(energy>0,name)}
 assert.ok(fs.statSync('public/audio/archive-satie.mp3').size<3000000);assert.ok(fs.statSync('public/audio/island-surf.mp3').size<500000);
 assert.ok(fs.statSync('public/audio/island-ukulele.mp3').size>300000&&fs.statSync('public/audio/island-ukulele.mp3').size<800000);
 assert.ok(fs.statSync('public/audio/horror-music-box.mp3').size>1000000&&fs.statSync('public/audio/horror-music-box.mp3').size<2500000);
});

test('Остров: море тише музыки; отключение укулеле сохраняет прибой и не создаёт повторные источники',async()=>{
 const dom=new JSDOM('',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,paused=new WeakMap(),sources=[],gains=[];
 Object.defineProperty(w.HTMLMediaElement.prototype,'paused',{get(){return paused.get(this)??true}});
 w.HTMLMediaElement.prototype.play=function(){paused.set(this,false);return Promise.resolve()};w.HTMLMediaElement.prototype.pause=function(){paused.set(this,true)};w.HTMLMediaElement.prototype.load=function(){};
 const param=()=>({value:0,setTargetAtTime(v){this.value=v},cancelScheduledValues(){}}),node=()=>({gain:param(),playbackRate:param(),connect(target){return target},disconnect(){this.disconnected=true},start(){},stop(){}});
 const ctx={state:'running',currentTime:0,createGain(){const n=node();gains.push(n);return n},createBufferSource:node,createMediaElementSource(el){const source=node();sources.push({el,source});return source},async decodeAudioData(){return{duration:.5}}};
 const requests=[];w.fetch=async url=>{requests.push(url);return{ok:true,arrayBuffer:async()=>new ArrayBuffer(100)}};
 try{
  w.eval(code+';window.make=recordings.createRecordedAudio;');const deck=w.make(ctx,node(),'ostrov','/quests/');await deck.ready;
  assert.equal(w.document.querySelectorAll('audio').length,0);deck.setActive(true,false);
  const sea=w.document.querySelector('[data-track-kind=ambience]');assert.ok(sea);assert.equal(sea.paused,false);assert.equal(w.document.querySelector('[data-track-kind=music]'),null);assert.ok(gains[0].gain.value<.25);
  deck.setActive(true,true);const music=w.document.querySelector('[data-track-kind=music]');assert.match(music.src,/\/quests\/audio\/island-ukulele\.mp3$/);assert.equal(music.paused,false);assert.ok(gains[1].gain.value>gains[0].gain.value*3);
  for(let i=0;i<8;i++)deck.setActive(true,true);assert.equal(sources.length,2);assert.equal(w.document.querySelectorAll('audio').length,2);
  deck.setActive(true,false);assert.equal(music.paused,true);assert.equal(sea.paused,false);assert.equal(deck.play('found'),true);
  deck.setActive(false);assert.equal(sea.paused,true);deck.setActive(true);assert.equal(sea.paused,false);assert.equal(music.paused,false);
  assert.ok(requests.every(url=>url.endsWith('.wav')));deck.stop();assert.equal(w.document.querySelectorAll('audio').length,0);assert.ok(sources.every(s=>s.source.disconnected));deck.setActive(true);assert.equal(w.document.querySelectorAll('audio').length,0);
 }finally{dom.window.close()}
});

test('Изнанка: шкатулка не запрашивается при выключенной музыке и останавливается с общим звуком',async()=>{
 const dom=new JSDOM('',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,paused=new WeakMap();
 Object.defineProperty(w.HTMLMediaElement.prototype,'paused',{get(){return paused.get(this)??true}});
 w.HTMLMediaElement.prototype.play=function(){paused.set(this,false);return Promise.resolve()};w.HTMLMediaElement.prototype.pause=function(){paused.set(this,true)};w.HTMLMediaElement.prototype.load=function(){};
 const param=()=>({value:0,setTargetAtTime(){},cancelScheduledValues(){}}),node=()=>({gain:param(),playbackRate:param(),connect(target){return target},disconnect(){},start(){},stop(){}});
 const ctx={state:'running',currentTime:0,createGain:node,createBufferSource:node,createMediaElementSource:node,async decodeAudioData(){return{duration:.5}}};w.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(100)});
 try{
  w.eval(code+';window.make=recordings.createRecordedAudio;');const deck=w.make(ctx,node(),'iznanka','/quests/');await deck.ready;deck.setActive(true,false);assert.equal(w.document.querySelector('audio'),null);
  deck.setActive(true);const music=w.document.querySelector('audio');assert.match(music.src,/horror-music-box\.mp3$/);assert.equal(music.loop,true);assert.equal(music.autoplay,false);assert.equal(music.paused,false);
  deck.setActive(false);assert.equal(music.paused,true);deck.setActive(true,false);assert.equal(music.paused,true);assert.equal(deck.play('tuner'),true);deck.stop();assert.equal(w.document.querySelector('audio'),null);
 }finally{dom.window.close()}
});
