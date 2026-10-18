export function createSoundscape(world:string){
 let context:AudioContext|null=null,volume:GainNode|null=null,clock:ReturnType<typeof setInterval>|null=null;
 let enabled=false,keyBuffer:AudioBuffer|null=null,keyFilter:BiquadFilterNode|null=null,lastKey=-Infinity;
 function build(){
  if(context&&context.state!=='closed')return;
  context=new AudioContext();context.onstatechange=()=>document.dispatchEvent(new CustomEvent('gran-audio-state'));const ctx=context;volume=ctx.createGain();volume.gain.value=0;volume.connect(ctx.destination);
  if(world==='iznanka'){
   keyBuffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.036),ctx.sampleRate);
   const samples=keyBuffer.getChannelData(0);
   for(let i=0;i<samples.length;i++){
    const t=i/ctx.sampleRate,envelope=Math.min(1,t/.003)*Math.exp(-t*125);
    samples[i]=((Math.random()-.5)*.55+Math.sin(t*2*Math.PI*570)*.16)*envelope;
   }
   keyFilter=ctx.createBiquadFilter();keyFilter.type='lowpass';keyFilter.frequency.value=1850;keyFilter.Q.value=.35;keyFilter.connect(volume);
  }
  const length=ctx.sampleRate*16,buffer=ctx.createBuffer(2,length,ctx.sampleRate);
  for(let channel=0;channel<2;channel++){const data=buffer.getChannelData(channel);let brown=0;for(let i=0;i<length;i++){brown=(brown+(.04*Math.random()-.02))/1.02;data[i]=brown*3.5;}}
  const noise=ctx.createBufferSource();noise.buffer=buffer;noise.loop=true;
  const filter=ctx.createBiquadFilter();filter.type=world==='arhiv'?'bandpass':'lowpass';filter.frequency.value=world==='ostrov'?850:world==='arhiv'?1500:230;filter.Q.value=.45;
  const wind=ctx.createGain();wind.gain.value=world==='arhiv'?.035:.12;
  noise.connect(filter).connect(wind).connect(volume);noise.start();
  const tide=ctx.createOscillator(),depth=ctx.createGain();tide.frequency.value=world==='ostrov'?.14:.06;depth.gain.value=world==='ostrov'?.055:.025;tide.connect(depth).connect(wind.gain);tide.start();
  if(world==='iznanka'){
   const bass=ctx.createOscillator(),gain=ctx.createGain(),drift=ctx.createOscillator(),amount=ctx.createGain();bass.frequency.value=39;gain.gain.value=.018;drift.frequency.value=.09;amount.gain.value=3;drift.connect(amount).connect(bass.frequency);bass.connect(gain).connect(volume);bass.start();drift.start();
  }
  if(world==='arhiv')clock=setInterval(()=>{if(!context||!volume||context.state!=='running'||volume.gain.value<.01)return;const tick=context.createOscillator(),g=context.createGain(),now=context.currentTime;tick.frequency.value=1100;g.gain.setValueAtTime(.012,now);g.gain.exponentialRampToValueAtTime(.0001,now+.035);tick.connect(g).connect(volume);tick.start();tick.stop(now+.04)},1600);
 }
 function set(on:boolean){enabled=on;try{if(on){build();void context!.resume().catch(()=>{});volume!.gain.setTargetAtTime(.8,context!.currentTime,1.2)}else if(context&&volume&&context.state!=='closed')volume.gain.setTargetAtTime(0,context.currentTime,.25)}catch{}}
 function type(){
  if(!enabled||document.hidden||context?.state!=='running'||!keyBuffer||!keyFilter)return;
  const now=context.currentTime;if(now-lastKey<.105)return;lastKey=now;
  const tap=context.createBufferSource(),gain=context.createGain();tap.buffer=keyBuffer;tap.playbackRate.value=.9+Math.random()*.18;
  gain.gain.value=.025+Math.random()*.008;tap.connect(gain).connect(keyFilter);tap.onended=()=>{tap.disconnect();gain.disconnect();};tap.start();
 }
 function stop(){enabled=false;if(clock)clearInterval(clock);clock=null;if(context)void context.close().catch(()=>{});context=null;volume=null;keyBuffer=null;keyFilter=null;lastKey=-Infinity;}
 return{set,stop,type,state:()=>context?.state||'closed'};
}
