import type {SoundCue} from './sound-cues';
type Sample={file:string;gain:number;rate?:number};
const touch:Sample={file:'ui-touch.wav',gain:.42};
const page:Sample={file:'archive-page.wav',gain:.55};
const bell:Sample={file:'island-discovery.wav',gain:.35};
const samples:Record<string,Record<SoundCue,Sample>>={
 hub:{select:touch,open:touch,close:touch,tuner:touch,channel:touch,found:bell,complete:{file:'island-finish.wav',gain:.3}},
 iznanka:{select:touch,open:{file:'tv-channel.wav',gain:.4},close:touch,tuner:{file:'tv-dial.wav',gain:.58},channel:{file:'tv-channel.wav',gain:.5},found:touch,complete:{file:'tv-channel.wav',gain:.4,rate:.88}},
 arhiv:{select:{...page,gain:.38},open:{file:'archive-open.wav',gain:.5},close:{...page,gain:.38,rate:.9},tuner:touch,channel:touch,found:{file:'archive-relic.wav',gain:.4},complete:{file:'archive-relic.wav',gain:.5,rate:.84}},
 ostrov:{select:touch,open:{file:'island-map.wav',gain:.5},close:{file:'island-map.wav',gain:.3,rate:1.15},tuner:touch,channel:touch,found:bell,complete:{file:'island-finish.wav',gain:.4}}
};
const beds:Record<string,{file:string;gain:number;title:string}>={
 arhiv:{file:'archive-satie.mp3',gain:.7,title:'Эрик Сати — Гимнопедия №1'},
 ostrov:{file:'island-surf.mp3',gain:.65,title:'Морской прибой'}
};

/** Записи используют общий AudioContext. Длинный фон читается потоком, короткие эффекты кэшируются. */
export function createRecordedAudio(ctx:AudioContext,output:AudioNode,world:string,base:string){
 if(typeof fetch!=='function'||typeof ctx.decodeAudioData!=='function')return null;
 const mapping=samples[world]||samples.hub,controller=new AbortController(),buffers=new Map<string,AudioBuffer>();
 const voices=new Set<{source:AudioBufferSourceNode;gain:GainNode}>();
 let alive=true,active=false,music=true,bed:HTMLAudioElement|null=null,bedSource:MediaElementAudioSourceNode|null=null,bedGain:GainNode|null=null;
 const profile=beds[world],url=(file:string)=>`${base.replace(/\/?$/,'/')}audio/${file}`;
 const ready=Promise.all([...new Set(Object.values(mapping).map(s=>s.file))].map(async file=>{
  try{const response=await fetch(url(file),{signal:controller.signal});if(!response.ok)throw Error(String(response.status));const buffer=await ctx.decodeAudioData(await response.arrayBuffer());if(alive)buffers.set(file,buffer)}catch{/* При сбое файла остаётся тихий процедурный эффект. */}
 })).then(()=>{if(alive)document.body.dataset.soundEffects=String(buffers.size)});
 function stopVoices(){for(const voice of voices){try{voice.gain.gain.setTargetAtTime(0,ctx.currentTime,.008);voice.source.stop(ctx.currentTime+.04)}catch{}}}
 function setActive(on:boolean,musicOn=true){
  active=on;music=musicOn;
  if(!on){stopVoices();bed?.pause();return}
  if(!profile||(world==='arhiv'&&!music)){bed?.pause();return}
  if(!bed&&typeof ctx.createMediaElementSource==='function'){
   bed=document.createElement('audio');bed.hidden=true;bed.loop=true;bed.preload='none';bed.src=url(profile.file);bed.dataset.worldTrack=world;bed.setAttribute('aria-label',profile.title);
   bedGain=ctx.createGain();bedGain.gain.value=profile.gain;bedSource=ctx.createMediaElementSource(bed);bedSource.connect(bedGain).connect(output);document.body.append(bed);
  }
  if(bed?.paused)void bed.play().catch(()=>{});
 }
 function play(cue:SoundCue){
  if(!alive||!active||document.hidden||ctx.state!=='running')return false;
  const sample=mapping[cue],buffer=sample&&buffers.get(sample.file);if(!buffer)return false;
  if(voices.size>=2){const first=voices.values().next().value!;try{first.gain.gain.setTargetAtTime(0,ctx.currentTime,.006);first.source.stop(ctx.currentTime+.025)}catch{}voices.delete(first)}
  const source=ctx.createBufferSource(),gain=ctx.createGain(),voice={source,gain};
  source.buffer=buffer;source.playbackRate.value=sample.rate??1;gain.gain.value=sample.gain;source.connect(gain).connect(output);voices.add(voice);
  source.onended=()=>{source.disconnect();gain.disconnect();voices.delete(voice)};
  source.start();
  if(bedGain&&profile){const now=ctx.currentTime;bedGain.gain.cancelScheduledValues(now);bedGain.gain.setTargetAtTime(profile.gain*.5,now,.025);bedGain.gain.setTargetAtTime(profile.gain,now+Math.min(.8,buffer.duration),.3)}
  return true;
 }
 function stop(){alive=false;active=false;controller.abort();stopVoices();voices.clear();buffers.clear();if(bed){bed.pause();bed.removeAttribute('src');bed.load();bed.remove()}bedSource?.disconnect();bedGain?.disconnect();bed=null;bedSource=null;bedGain=null;delete document.body.dataset.soundEffects}
 return{ready,setActive,play,stop};
}
