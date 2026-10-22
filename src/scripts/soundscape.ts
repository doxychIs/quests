import type {SoundCue} from './sound-cues';
import {createRecordedAudio} from './recorded-audio';
export function createSoundscape(world:string,base='/'){
 let context:AudioContext|null=null,volume:GainNode|null=null;
 let enabled=false,keyBuffer:AudioBuffer|null=null,keyFilter:BiquadFilterNode|null=null,lastKey=-Infinity;
 let level=.35,noiseBuffer:AudioBuffer|null=null,suspendTimer:ReturnType<typeof setTimeout>|null=null;
 const lastCue=new Map<SoundCue,number>();let lastEffect=-Infinity;
 let recordings:ReturnType<typeof createRecordedAudio>=null,music=true;
 function build(){
  if(context&&context.state!=='closed')return;
  context=new AudioContext();context.onstatechange=()=>document.dispatchEvent(new CustomEvent('gran-audio-state'));const ctx=context;volume=ctx.createGain();volume.gain.value=0;
  if(typeof ctx.createDynamicsCompressor==='function'){const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-5;limiter.knee.value=4;limiter.ratio.value=6;limiter.attack.value=.003;limiter.release.value=.16;volume.connect(limiter).connect(ctx.destination)}else volume.connect(ctx.destination);
  recordings=createRecordedAudio(ctx,volume,world,base);
  noiseBuffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.22),ctx.sampleRate);
  const effectNoise=noiseBuffer.getChannelData(0);for(let i=0;i<effectNoise.length;i++)effectNoise[i]=Math.random()*2-1;
  if(world==='iznanka'){
   keyBuffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.036),ctx.sampleRate);
   const samples=keyBuffer.getChannelData(0);
   for(let i=0;i<samples.length;i++){
    const t=i/ctx.sampleRate,envelope=Math.min(1,t/.003)*Math.exp(-t*125);
    samples[i]=((Math.random()-.5)*.55+Math.sin(t*2*Math.PI*570)*.16)*envelope;
   }
   keyFilter=ctx.createBiquadFilter();keyFilter.type='lowpass';keyFilter.frequency.value=1850;keyFilter.Q.value=.35;keyFilter.connect(volume);
  }
  if(world==='hub'||world==='iznanka'){
  // Фоновый гул остаётся только в «Изнанке» и на главной; другие миры звучат записями.
  const length=ctx.sampleRate*6,buffer=ctx.createBuffer(2,length,ctx.sampleRate);
  for(let channel=0;channel<2;channel++){const data=buffer.getChannelData(channel);let brown=0;for(let i=0;i<length;i++){brown=(brown+(.04*Math.random()-.02))/1.02;data[i]=brown*3.5;}}
  const noise=ctx.createBufferSource();noise.buffer=buffer;noise.loop=true;
  const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=world==='iznanka'?230:650;filter.Q.value=.45;
  const wind=ctx.createGain();wind.gain.value=world==='iznanka'?.07:.025;
  noise.connect(filter).connect(wind).connect(volume);noise.start();
  const tide=ctx.createOscillator(),depth=ctx.createGain();tide.frequency.value=.045;depth.gain.value=.009;tide.connect(depth).connect(wind.gain);tide.start();
  if(world==='iznanka'){
   const bass=ctx.createOscillator(),gain=ctx.createGain(),drift=ctx.createOscillator(),amount=ctx.createGain();bass.frequency.value=39;gain.gain.value=.018;drift.frequency.value=.09;amount.gain.value=3;drift.connect(amount).connect(bass.frequency);bass.connect(gain).connect(volume);bass.start();drift.start();
  }
  }
 }
 function set(on:boolean){
  const wasEnabled=enabled;enabled=on;if(suspendTimer)clearTimeout(suspendTimer);suspendTimer=null;
  try{
   if(on){build();if(context!.state!=='running')void context!.resume().catch(()=>{});if(!wasEnabled||volume!.gain.value===0)volume!.gain.setTargetAtTime(level,context!.currentTime,.18);recordings?.setActive(true,music)}
   else if(context&&volume&&context.state!=='closed'){
    recordings?.setActive(false,music);
    volume.gain.setTargetAtTime(0,context.currentTime,.035);
    const ctx=context;suspendTimer=setTimeout(()=>{if(!enabled&&ctx.state==='running')void ctx.suspend().catch(()=>{});},180);
   }
  }catch{}
 }
 function setVolume(value:number){level=Math.max(0,Math.min(1,Number.isFinite(value)?value:.35));if(enabled&&context&&volume)volume.gain.setTargetAtTime(level,context.currentTime,.08)}
 function setMusic(on:boolean){music=on;recordings?.setActive(enabled,music)}
 function tone(frequency:number,amplitude:number,duration:number,delay=0){
  const ctx=context!,osc=ctx.createOscillator(),gain=ctx.createGain(),now=ctx.currentTime+delay;
  osc.type='sine';osc.frequency.value=frequency;gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(amplitude,now+.006);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
  osc.connect(gain).connect(volume!);osc.onended=()=>{osc.disconnect();gain.disconnect()};osc.start(now);osc.stop(now+duration+.01);
 }
 function rustle(frequency:number,amplitude:number,duration:number){
  const ctx=context!,source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),now=ctx.currentTime;
  source.buffer=noiseBuffer;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=.55;
  gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(amplitude,now+.004);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
  source.connect(filter).connect(gain).connect(volume!);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect()};source.start();source.stop(now+duration+.01);
 }
 function cue(kind:SoundCue){
  if(!enabled||document.hidden||context?.state!=='running'||level===0)return;
  const now=context.currentTime;
  if(now-lastEffect<.065||now-(lastCue.get(kind)??-Infinity)<(kind==='complete'?.7:.13))return;
  lastEffect=now;lastCue.set(kind,now);
  if(recordings?.play(kind))return;
  if(kind==='tuner'){rustle(1250,.075,.026);tone(180,.045,.045);return}
  if(kind==='complete'){const notes=world==='ostrov'?[440,554,659]:world==='arhiv'?[330,392,494]:[196,233,294];notes.forEach((n,i)=>tone(n,.027,.24,i*.09));return}
  if(kind==='found'){tone(world==='arhiv'?620:780,.028,.16);rustle(1800,.014,.045);return}
  if(world==='arhiv'){rustle(kind==='close'?700:1200,kind==='open'?.055:.028,kind==='open'?.18:.08);return}
  if(world==='ostrov'){tone(kind==='open'?392:kind==='close'?294:440,.024,.12);return}
  rustle(world==='iznanka'?820:650,kind==='open'?.035:.025,.045);tone(world==='iznanka'?110:220,.018,.065);
 }
 function type(){
  if(!enabled||document.hidden||level===0||context?.state!=='running'||!keyBuffer||!keyFilter)return;
  const now=context.currentTime;if(now-lastKey<.18)return;lastKey=now;
  const tap=context.createBufferSource(),gain=context.createGain();tap.buffer=keyBuffer;tap.playbackRate.value=.9+Math.random()*.18;
  gain.gain.value=.025+Math.random()*.008;tap.connect(gain).connect(keyFilter);tap.onended=()=>{tap.disconnect();gain.disconnect();};tap.start();
 }
 function stop(){enabled=false;if(suspendTimer)clearTimeout(suspendTimer);suspendTimer=null;recordings?.stop();recordings=null;if(context)void context.close().catch(()=>{});context=null;volume=null;keyBuffer=null;keyFilter=null;noiseBuffer=null;lastKey=-Infinity;lastEffect=-Infinity;lastCue.clear();}
 return{set,stop,type,cue,setVolume,setMusic,state:()=>context?.state||'closed'};
}
