import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {buildSync} from 'esbuild';
const code=buildSync({entryPoints:['src/scripts/soundscape.ts'],bundle:true,format:'iife',globalName:'sound',write:false}).outputFiles[0].text;
test('Щелчки тихие, ограничены по частоте и прекращаются при выключении звука или уходе на фон',()=>{
 const dom=new JSDOM('',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;let hidden=false;const contexts=[],taps=[];
 Object.defineProperty(w.document,'hidden',{get:()=>hidden});
 function node(){return{gain:{value:0,setTargetAtTime(){},setValueAtTime(){},exponentialRampToValueAtTime(){}},frequency:{value:0},Q:{value:0},playbackRate:{value:1},connect(target){this.connected=target;return target},disconnect(){},start(){if(this.buffer?.length<100)taps.push(this)},stop(){}}}
 w.AudioContext=class{constructor(){this.sampleRate=1000;this.currentTime=0;this.state='running';contexts.push(this)}createGain(){return node()}createOscillator(){return node()}createBiquadFilter(){return node()}createBufferSource(){return node()}createBuffer(channels,length){return{length,getChannelData:()=>new Float32Array(length)}}resume(){return Promise.resolve()}close(){return Promise.resolve()}};
 try{
  w.eval(code+';window.scape=sound.createSoundscape("iznanka");');const s=w.scape;
  s.type();assert.equal(contexts.length,0);s.set(true);s.type();assert.equal(taps.length,1);assert.ok(taps[0].connected.gain.value<=.033);
  contexts[0].currentTime=.05;s.type();assert.equal(taps.length,1);
  contexts[0].currentTime=.2;s.type();assert.equal(taps.length,2);
  s.set(false);contexts[0].currentTime=1;s.type();assert.equal(taps.length,2);
  s.set(true);hidden=true;s.type();assert.equal(taps.length,2);s.stop();
 }finally{dom.window.close()}
});
