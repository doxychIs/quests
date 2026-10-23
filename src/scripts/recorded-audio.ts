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
type Track={file:string;gain:number;title:string;kind:'ambience'|'music'};
const beds:Record<string,readonly Track[]>={
 arhiv:[{file:'archive-satie.mp3',gain:.7,title:'Эрик Сати — Гимнопедия №1',kind:'music'}],
 ostrov:[{file:'island-surf.mp3',gain:.18,title:'Морской прибой',kind:'ambience'},{file:'island-ukulele.mp3',gain:.64,title:'Островная мелодия укулеле',kind:'music'}],
 iznanka:[{file:'horror-music-box.mp3',gain:.62,title:'Старая музыкальная шкатулка',kind:'music'}]
};

/** Записи используют общий AudioContext. Длинный фон читается потоком, короткие эффекты кэшируются. */
export function createRecordedAudio(ctx:AudioContext,output:AudioNode,world:string,base:string){
 if(typeof fetch!=='function'||typeof ctx.decodeAudioData!=='function')return null;
 const mapping=samples[world]||samples.hub,controller=new AbortController(),buffers=new Map<string,AudioBuffer>();
 const voices=new Set<{source:AudioBufferSourceNode;gain:GainNode}>();
 const tracks=new Map<string,{element:HTMLAudioElement;source:MediaElementAudioSourceNode;gain:GainNode;profile:Track}>();
 let alive=true,active=false,music=true;
 const profiles=beds[world]||[],url=(file:string)=>`${base.replace(/\/?$/,'/')}audio/${file}`;
 const ready=Promise.all([...new Set(Object.values(mapping).map(s=>s.file))].map(async file=>{
  try{const response=await fetch(url(file),{signal:controller.signal});if(!response.ok)throw Error(String(response.status));const buffer=await ctx.decodeAudioData(await response.arrayBuffer());if(alive)buffers.set(file,buffer)}catch{/* При сбое файла остаётся тихий процедурный эффект. */}
 })).then(()=>{if(alive)document.body.dataset.soundEffects=String(buffers.size)});
 function stopVoices(){for(const voice of voices){try{voice.gain.gain.setTargetAtTime(0,ctx.currentTime,.008);voice.source.stop(ctx.currentTime+.04)}catch{}}}
 function setActive(on:boolean,musicOn=true){
  if(!alive)return;
  active=on;music=musicOn;
  if(!on){stopVoices();for(const track of tracks.values())track.element.pause();return}
  for(const profile of profiles){
   const allowed=profile.kind==='ambience'||music;
   let track=tracks.get(profile.file);
   if(!allowed){track?.element.pause();continue}
   if(!track&&typeof ctx.createMediaElementSource==='function'){
    const element=document.createElement('audio');element.hidden=true;element.loop=true;element.preload='none';element.src=url(profile.file);element.dataset.worldTrack=world;element.dataset.trackKind=profile.kind;element.setAttribute('aria-label',profile.title);
    const gain=ctx.createGain(),source=ctx.createMediaElementSource(element);gain.gain.value=profile.gain;source.connect(gain).connect(output);document.body.append(element);
    track={element,source,gain,profile};tracks.set(profile.file,track);
   }
   if(track?.element.paused)void track.element.play().catch(()=>{});
  }
 }
 function play(cue:SoundCue){
  if(!alive||!active||document.hidden||ctx.state!=='running')return false;
  const sample=mapping[cue],buffer=sample&&buffers.get(sample.file);if(!buffer)return false;
  if(voices.size>=2){const first=voices.values().next().value!;try{first.gain.gain.setTargetAtTime(0,ctx.currentTime,.006);first.source.stop(ctx.currentTime+.025)}catch{}voices.delete(first)}
  const source=ctx.createBufferSource(),gain=ctx.createGain(),voice={source,gain};
  source.buffer=buffer;source.playbackRate.value=sample.rate??1;gain.gain.value=sample.gain;source.connect(gain).connect(output);voices.add(voice);
  source.onended=()=>{source.disconnect();gain.disconnect();voices.delete(voice)};
  source.start();
  for(const {gain,profile,element} of tracks.values()){if(element.paused)continue;const now=ctx.currentTime;gain.gain.cancelScheduledValues(now);gain.gain.setTargetAtTime(profile.gain*.5,now,.025);gain.gain.setTargetAtTime(profile.gain,now+Math.min(.8,buffer.duration),.3)}
  return true;
 }
 function stop(){alive=false;active=false;controller.abort();stopVoices();voices.clear();buffers.clear();for(const {element,source,gain} of tracks.values()){element.pause();element.removeAttribute('src');element.load();element.remove();source.disconnect();gain.disconnect()}tracks.clear();delete document.body.dataset.soundEffects}
 return{ready,setActive,play,stop};
}
