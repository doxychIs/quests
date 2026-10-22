import {soundCue} from './sound-cues';
import {roomScreens,roomSize,screenHomography,projectScreen,roundedScreenPath,type RoomScreen,type ScreenPoint} from '../lib/crt-room';
import {tvReadingCamera} from '../lib/tv-reading';
import {AnalogSignalRenderer} from '../lib/analog-signal';
import {analogProfiles,newSignalEvent,advanceSignalEvent} from '../lib/analog-profiles';
import {drawGraphicText} from '../lib/broadcast-glyphs';
import {hydrateGraphicText,releaseGraphicText} from './graphic-lettering';
// Растеризация изображения на сетке гомографии. Те же UV-координаты
// подойдут для HTMLVideoElement при следующем этапе, без изменения композиции.
function drawTriangle(ctx:CanvasRenderingContext2D,image:CanvasImageSource,s:ScreenPoint[],d:ScreenPoint[]){
 const [a,b,c]=s,[p,q,r]=d,det=a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y);if(Math.abs(det)<1e-8)return;
 const solve=(p0:number,p1:number,p2:number)=>[(p0*(b.y-c.y)+p1*(c.y-a.y)+p2*(a.y-b.y))/det,(p0*(c.x-b.x)+p1*(a.x-c.x)+p2*(b.x-a.x))/det,(p0*(b.x*c.y-c.x*b.y)+p1*(c.x*a.y-a.x*c.y)+p2*(a.x*b.y-b.x*a.y))/det];
 const [xx,xy,xt]=solve(p.x,q.x,r.x),[yx,yy,yt]=solve(p.y,q.y,r.y);
 const center={x:(p.x+q.x+r.x)/3,y:(p.y+q.y+r.y)/3};const bleed=(point:ScreenPoint)=>{const dx=point.x-center.x,dy=point.y-center.y,length=Math.hypot(dx,dy)||1;return{x:point.x+dx/length*1.2,y:point.y+dy/length*1.2}};const [bp,bq,br]=[p,q,r].map(bleed);
 ctx.save();ctx.beginPath();ctx.moveTo(bp.x,bp.y);ctx.lineTo(bq.x,bq.y);ctx.lineTo(br.x,br.y);ctx.closePath();ctx.clip();ctx.transform(xx,yx,xy,yy,xt,yt);ctx.drawImage(image,0,0);ctx.restore();
}
function projectImage(ctx:CanvasRenderingContext2D,image:HTMLCanvasElement,screen:RoomScreen){
 const h=screenHomography(screen.quad),nx=5,ny=4,w=image.width,hh=image.height;ctx.save();ctx.clip(new Path2D(roundedScreenPath(screen.quad,screen.radius)));
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const u=x/nx,v=y/ny,u1=(x+1)/nx,v1=(y+1)/ny;const source=[{x:u*w,y:v*hh},{x:u1*w,y:v*hh},{x:u1*w,y:v1*hh},{x:u*w,y:v1*hh}],dest=[projectScreen(h,u,v),projectScreen(h,u1,v),projectScreen(h,u1,v1),projectScreen(h,u,v1)];drawTriangle(ctx,image,[source[0],source[1],source[2]],[dest[0],dest[1],dest[2]]);drawTriangle(ctx,image,[source[0],source[2],source[3]],[dest[0],dest[2],dest[3]])}ctx.restore();
}
function prepareSignal(img:HTMLImageElement){
 const tile=document.createElement('canvas');tile.width=640;tile.height=480;const c=tile.getContext('2d');if(!c)return null;const ratio=Math.max(640/img.naturalWidth,480/img.naturalHeight),w=img.naturalWidth*ratio,h=img.naturalHeight*ratio;
 c.filter='saturate(.35) contrast(1.04)';c.drawImage(img,(640-w)/2,(480-h)/2,w,h);c.filter='none';return tile;
}
export function initHorrorRoom(){
 const root=document.querySelector<HTMLElement>('[data-crt-room]')!;if(!root||root.dataset.ready)return;root.dataset.ready='yes';
 const canvas=root.querySelector<HTMLCanvasElement>('[data-room-projection]')!,stage=root.querySelector<HTMLElement>('[data-room-stage]')!,viewport=root.querySelector<HTMLElement>('[data-room-viewport]')!,selection=root.querySelector<HTMLElement>('[data-room-selection]')!,instruction=root.querySelector<HTMLElement>('[data-room-instruction]')!,title=root.querySelector<HTMLElement>('[data-room-title]')!,info=root.querySelector<HTMLElement>('[data-room-info]')!,open=root.querySelector<HTMLAnchorElement>('[data-room-open]')!;
 const anchors=[...root.querySelectorAll<SVGAElement>('[data-room-screen]')],index=[...root.querySelectorAll<HTMLAnchorElement>('[data-room-index]')];
 const panel=root.querySelector<HTMLElement>('[data-broadcast-panel]')!;
 const noise=panel.querySelector<HTMLCanvasElement>('[data-crt-noise]')!;
 let noiseContext:CanvasRenderingContext2D|null=null,noisePixels:ImageData|null=null,noiseFrame=0,lastNoise=-1000,noiseSeed=1937;
 let analog:AnalogSignalRenderer|undefined,roomClock=0,lastClock=0,panelVisible=false;
 const panelEvents=new Map(roomScreens.map(screen=>[screen.id,newSignalEvent()]));
 const displacement=root.querySelector<SVGFEDisplacementMapElement>('[data-analog-displacement]');
 const redOffset=root.querySelector<SVGFEOffsetElement>('[data-analog-red]'),blueOffset=root.querySelector<SVGFEOffsetElement>('[data-analog-blue]');
 const advanceClock=(t:number)=>{if(lastClock)roomClock+=Math.min((t-lastClock)/1000,.2);lastClock=t;return roomClock};
 let restorePending=location.hash.startsWith('#tv-');
 const savedScrollRestoration=history.scrollRestoration;if('scrollRestoration' in history)history.scrollRestoration='manual';

 function alignRoom(){const arrival=document.getElementById('quests');if(arrival)window.scrollTo({top:Math.max(0,arrival.getBoundingClientRect().top+scrollY-100),behavior:'instant'});const frame=root.closest<HTMLElement>('.horror-door-sticky');if(frame)frame.scrollTop=0;}
 const textures=new Map<string,HTMLCanvasElement>(),buffers=new Map<string,HTMLCanvasElement>();
 const clips=new Map([...root.querySelectorAll<HTMLVideoElement>('[data-signal-video]')].map(v=>[v.dataset.signalVideo!,v]));
 const clipNames=roomScreens.map(screen=>screen.id);
 let selected:string|null=null,touchArmed:string|null=null,loaded=false,visible=false,ctx:CanvasRenderingContext2D|null=null,raf=0,lastFrame=-1000,stopped=false;
 let activeSlug:string|null=null,lastFocus:Element|null=null,readingTimer:ReturnType<typeof setTimeout>|undefined;
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.classList.contains('calm');
 const permitted=()=>document.documentElement.classList.contains('adult');
 function grain(t:number){
  noiseFrame=0;if(!visible||!panelVisible||panel.hidden||!permitted()||document.hidden||reduced()||stopped)return;
  if(!noiseContext)try{noiseContext=noise.getContext('2d')}catch{}
  if(noiseContext&&t-lastNoise>110){
   lastNoise=t;const time=advanceClock(t);noisePixels??=noiseContext.createImageData(noise.width,noise.height);
   if(noisePixels?.data){
    const data=noisePixels.data;
    for(let i=0;i<data.length;i+=4){noiseSeed=(noiseSeed*1664525+1013904223)>>>0;const n=noiseSeed>>>24;data[i]=174;data[i+1]=181;data[i+2]=174;data[i+3]=n>208?24:0}
    noiseContext.putImageData(noisePixels,0,0);
   }
   const id=roomScreens.find(screen=>screen.slug===activeSlug)?.id||'wood-floor',p=analogProfiles[id];
   const amount=advanceSignalEvent(panelEvents.get(id)!,time,p);
   const displacementScale=String(.28+amount*1.25);if(displacement?.getAttribute('scale')!==displacementScale)displacement?.setAttribute('scale',displacementScale);
   panel.style.setProperty('--signal-exposure',String(1+Math.sin(time*.71+p.seed)*.006));
  }
  noiseFrame=requestAnimationFrame(grain);
 }
 function syncGrain(){
  const run=visible&&panelVisible&&!panel.hidden&&permitted()&&!document.hidden&&!reduced()&&!stopped;
  root.classList.toggle('is-signal-still',!run);
  if(run&&!noiseFrame)noiseFrame=requestAnimationFrame(grain);
  if(!run&&noiseFrame){cancelAnimationFrame(noiseFrame);noiseFrame=0}
 }
 root.classList.toggle('debug',new URLSearchParams(location.search).get('roomDebug')==='1');
 [...clips.values()].forEach((video,i)=>{video.playbackRate=.72+i*.07;video.addEventListener('loadedmetadata',()=>{if(Number.isFinite(video.duration)&&video.duration>0)video.currentTime=(i*1.73)%video.duration})});
 function signal(screen:RoomScreen,i:number,t:number){
  const base=textures.get(screen.id);if(!base)return null;
  let tile=buffers.get(screen.id);if(!tile){tile=document.createElement('canvas');tile.width=640;tile.height=480;buffers.set(screen.id,tile)}
  const c=tile.getContext('2d');if(!c)return base;
  const active=selected===screen.id,quiet=reduced();
  c.globalAlpha=1;c.globalCompositeOperation='source-over';c.fillStyle='#080c0d';c.fillRect(0,0,640,480);c.drawImage(base,0,0);
  const v=clips.get(clipNames[i]);const interrupt=!quiet;
  if(interrupt&&v&&v.readyState>=2){
   c.save();c.globalAlpha=active?.94:.86;c.filter='saturate(.32) contrast(1.04)';
   const scale=Math.max(640/v.videoWidth,480/v.videoHeight),w=v.videoWidth*scale,h=v.videoHeight*scale;
   c.drawImage(v,(640-w)/2,(480-h)/2,w,h);c.restore();
  }
  const a=anchors.find(a=>a.dataset.roomScreen===screen.id);
  const label=a||root.querySelector<SVGElement>(`[data-screen-id="${screen.id}"]`);
  const reveal=label?.dataset.typeCount!==undefined?{count:Number(label.dataset.typeCount),caret:label.dataset.typeState==='pending'&&Math.floor(t*1.7+i*.37)%2===0}:undefined;
  if(a){
   const shade=c.createLinearGradient(0,320,0,480);shade.addColorStop(0,'#070b0b00');shade.addColorStop(1,'#070b0bd9');c.fillStyle=shade;c.fillRect(0,320,640,160);
   drawGraphicText(c,a.dataset.questName!,36,401,28,active?'#bfc6b8':'#a5b1a3',i,566,reveal);
  }else if(screen.id==='unidentified-face'){
   drawGraphicText(c,'НЕ ВЫКЛЮЧАЙ',36,424,19,'#929a8b',i,560,reveal);
  }
  // Letter shapes and footage now travel through the SAME signal path, in this order.
  const processed=analog?.render(screen.id,tile,t,quiet)||tile;root.dataset.analogRenderer=analog?.mode||'canvas';return processed;
 }
 function draw(t=roomClock){
  if(!ctx)return;root.dataset.signalFrames=String(Number(root.dataset.signalFrames||0)+1);const scale=canvas.width/roomSize.width;ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,roomSize.width,roomSize.height);
  roomScreens.forEach((s,i)=>{const tile=signal(s,i,t);if(!tile)return;
   const center=projectScreen(screenHomography(s.quad),.5,.5),w=Math.hypot(s.quad[1].x-s.quad[0].x,s.quad[1].y-s.quad[0].y);
   // Faint spill lands below the cabinet; the existing photographed body owns its cast shadow.
   ctx!.save();ctx!.globalCompositeOperation='screen';ctx!.translate(center.x,center.y+w*.64);ctx!.scale(1,.22);const spill=ctx!.createRadialGradient(0,0,1,0,0,w*.8);spill.addColorStop(0,'#9aaca40c');spill.addColorStop(1,'#9aaca400');ctx!.fillStyle=spill;ctx!.fillRect(-w,-w,w*2,w*2);ctx!.restore();
   ctx!.save();ctx!.strokeStyle='#010303a8';ctx!.lineWidth=3;ctx!.shadowColor='#000a';ctx!.shadowBlur=5;ctx!.stroke(new Path2D(roundedScreenPath(s.quad,s.radius)));ctx!.restore();
   ctx!.globalAlpha=1;projectImage(ctx!,tile,s)});ctx.globalAlpha=1;
 }
 function tick(t:number){raf=0;if(stopped||!visible||!permitted()||document.hidden||reduced()||!panel.hidden||!ctx)return;if(t-lastFrame>(innerWidth<=760?125:83)){lastFrame=t;draw(advanceClock(t))}raf=requestAnimationFrame(tick)}
 function synchronize(){
  const run=visible&&(root.closest('[data-horror-door]')?.classList.contains('room-open')??true)&&permitted()&&!document.hidden&&!reduced()&&panel.hidden&&!stopped;
  for(const v of clips.values()){if(run){if(!v.getAttribute('src'))v.src=v.dataset.src!;v.play().catch(()=>{})}else v.pause()}
  if(run&&ctx&&!raf)raf=requestAnimationFrame(tick);if(!run&&raf){cancelAnimationFrame(raf);raf=0}if(!visible||document.hidden||reduced())lastClock=0;if(ctx)draw();syncGrain();
 }
 function resize(){if(activeSlug)positionProgram(activeSlug);const w=Math.max(640,Math.min(roomSize.width,Math.round(stage.clientWidth*Math.min(2,devicePixelRatio||1))));canvas.width=w;canvas.height=Math.round(w*roomSize.height/roomSize.width);draw()}
 function load(){
  if(loaded||!permitted())return;loaded=true;try{ctx=canvas.getContext('2d')}catch{}if(!ctx)return;analog=new AnalogSignalRenderer();resize();
  for(const [i,s] of roomScreens.entries()){
   const a=anchors.find(a=>a.dataset.roomScreen===s.id);const img=new Image();
   img.onload=()=>{const texture=prepareSignal(img);if(texture){textures.set(s.id,texture);draw();synchronize()}};
   img.src=a?.dataset.questImage||(i===4?new URL('horror-face-poster.jpg',new URL(anchors[0].dataset.questImage!,location.href)).href:anchors[0].dataset.questImage!);
  }
  document.fonts?.ready.then(()=>draw());synchronize();
 }
 function select(id:string|null){selected=id;const a=anchors.find(a=>a.dataset.roomScreen===id);
  index.forEach(link=>link.classList.toggle('is-selected',link.dataset.roomIndex===id));anchors.forEach(link=>link.classList.toggle('is-active',link.dataset.roomScreen===id));
  if(a){title.textContent=a.dataset.questName!;info.textContent=a.dataset.questInfo!;open.href=a.getAttribute('href')!;selection.hidden=false;instruction.hidden=true}else{selection.hidden=true;instruction.hidden=false}draw();
 }
 function positionProgram(slug:string){
  const screen=roomScreens.find(s=>s.slug===slug);if(!screen)return;
  const width=stage.clientWidth,vw=viewport.clientWidth||innerWidth,vh=viewport.clientHeight||innerHeight;
  const camera=width>0?tvReadingCamera(screen.quad,width,vw,vh):null;
  const pw=camera?.width||(innerWidth<=760?350:960),ph=pw*.75;
  panel.style.width=pw+'px';panel.style.height=ph+'px';panel.style.transform='none';
  panel.style.left=(camera?.left||0)+'px';panel.style.top=(camera?.top||0)+'px';
  if(camera)stage.style.transform=`matrix3d(${camera.css.join(',')})`;
  const p=analogProfiles[screen.id];root.dataset.analogProfile=screen.id;
  panel.style.setProperty('--glass-gain',String(.91+p.gain*.09));panel.style.setProperty('--glass-scan',String(p.scan*.68));panel.style.setProperty('--glass-ghost',String(p.ghost));
  redOffset?.setAttribute('dx',String(p.bleed*.48));blueOffset?.setAttribute('dx',String(-p.bleed*.29));
  displacement?.setAttribute('scale',reduced()?'0':'.28');
  root.querySelector('[data-analog-timebase]')?.setAttribute('seed',String(p.seed));
  panel.style.setProperty('--glass-pitch',Math.max(.75,ph/240)+'px');

 }
 function showProgram(slug:string,push=true){
  const program=[...root.querySelectorAll<HTMLElement>('[data-broadcast-program]')].find(p=>p.dataset.broadcastProgram===slug);if(!program)return;
  alignRoom();hydrateGraphicText(root.querySelector('[data-broadcast-close]')!);hydrateGraphicText(program);
  root.querySelectorAll<HTMLElement>('[data-broadcast-program]').forEach(p=>p.hidden=p!==program);
  if(push&&location.hash!=='#tv-'+slug)history.pushState({...history.state,granBroadcast:slug},'','#tv-'+slug);
  root.classList.remove('is-enlarged');root.classList.add('is-reading');viewport.scrollLeft=0;viewport.scrollTop=0;activeSlug=slug;root.dataset.activeQuest=slug;
  root.classList.remove('is-screen-ready');clearTimeout(readingTimer);
  panel.hidden=false;positionProgram(slug);
  if(reduced())root.classList.add('is-screen-ready');else readingTimer=setTimeout(()=>root.classList.add('is-screen-ready'),980);
  const glass=panel.querySelector<HTMLElement>('.broadcast-glass')!;glass.scrollTop=0;
  panel.focus({preventScroll:true});synchronize();
 }
 function closeProgram(withHistory=true){
  const wasOpen=!panel.hidden;panel.hidden=true;activeSlug=null;delete root.dataset.activeQuest;clearTimeout(readingTimer);root.classList.remove('is-reading','is-screen-ready');stage.style.transform='';
  const frame=root.closest<HTMLElement>('.horror-door-sticky');if(frame)frame.scrollTop=0;
  root.querySelectorAll('[data-broadcast-program]').forEach(releaseGraphicText);
  synchronize();if(wasOpen&&withHistory&&history.state?.granBroadcast)history.back();
  (lastFocus as HTMLElement|null)?.focus?.({preventScroll:true});
 }
 function enter(a:SVGAElement){
  if(!permitted()||!panel.hidden)return;lastFocus=document.activeElement;select(a.dataset.roomScreen!);showProgram(a.dataset.questSlug!);soundCue('open');
 }
 function activate(e:MouseEvent,a:SVGAElement){if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button>0)return;e.preventDefault();void enter(a)}
 for(const a of anchors){a.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')select(a.dataset.roomScreen!)});a.addEventListener('focus',()=>select(a.dataset.roomScreen!));a.addEventListener('click',e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button>0)return;if(e.detail>0&&matchMedia('(pointer:coarse)').matches&&touchArmed!==a.dataset.roomScreen){e.preventDefault();touchArmed=a.dataset.roomScreen!;select(touchArmed);return}activate(e,a)})}
 for(const a of index){a.addEventListener('pointerenter',()=>select(a.dataset.roomIndex!));a.addEventListener('focus',()=>select(a.dataset.roomIndex!));a.addEventListener('click',e=>{const target=anchors.find(s=>s.dataset.roomScreen===a.dataset.roomIndex);if(target)activate(e,target)})}
 open.addEventListener('click',e=>{const target=anchors.find(a=>a.dataset.roomScreen===selected);if(target)activate(e,target)});
 root.addEventListener('pointerleave',e=>{if(e.pointerType!=='touch'&&!root.contains(document.activeElement))select(null)});
 root.addEventListener('focusout',()=>queueMicrotask(()=>{if(!root.contains(document.activeElement))select(null)}));
 const enlarge=root.querySelector<HTMLButtonElement>('[data-room-enlarge]')!;
 enlarge.addEventListener('click',()=>{const on=!root.classList.contains('is-enlarged');root.classList.toggle('is-enlarged',on);enlarge.setAttribute('aria-pressed',String(on));enlarge.innerHTML=on?'Вся комната <span aria-hidden="true">−</span>':'Рассмотреть ближе <span aria-hidden="true">＋</span>';resize();if(on){viewport.scrollLeft=(stage.clientWidth-viewport.clientWidth)*.42;viewport.scrollTop=(stage.clientHeight-viewport.clientHeight)*.5}viewport.focus({preventScroll:true})});
 root.querySelector('[data-broadcast-close]')?.addEventListener('click',()=>closeProgram());
 new IntersectionObserver(entries=>{panelVisible=entries.some(entry=>entry.isIntersecting);syncGrain()},{threshold:0}).observe(panel);
 viewport.addEventListener('wheel',e=>{if(!panel.hidden&&!panel.contains(e.target as Node))e.preventDefault()},{passive:false});
 root.querySelectorAll<HTMLButtonElement>('[data-broadcast-tab]').forEach(button=>button.addEventListener('click',()=>{if(button.getAttribute('aria-pressed')!=='true')soundCue('tuner');const program=button.closest<HTMLElement>('[data-broadcast-program]')!;program.querySelectorAll('[data-broadcast-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));program.querySelectorAll<HTMLElement>('[data-broadcast-pane]').forEach(p=>p.hidden=p.dataset.broadcastPane!==button.dataset.broadcastTab)}));
 addEventListener('popstate',()=>{const slug=location.hash.startsWith('#tv-')?location.hash.slice(4):'';if(slug&&permitted())showProgram(slug,false);else closeProgram(false)});
 addEventListener('keydown',e=>{if(e.key==='Escape'){if(!panel.hidden){e.preventDefault();closeProgram()}else if(root.classList.contains('is-enlarged'))enlarge.click()}});
 document.addEventListener('horror:room-state',()=>{if(!root.closest('[data-horror-door]')?.classList.contains('room-open')&&!panel.hidden)closeProgram(false);synchronize()});
 new ResizeObserver(resize).observe(stage);new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting);if(visible){load();if(root.classList.contains('is-enlarged')&&viewport.scrollLeft===0)viewport.scrollLeft=(stage.clientWidth-viewport.clientWidth)*.42}synchronize()},{rootMargin:'0px'}).observe(root);
 addEventListener('resize',()=>{if(activeSlug){alignRoom();positionProgram(activeSlug)}});
 function restoreEntry(){if(!restorePending||!permitted())return;restorePending=false;alignRoom();showProgram(location.hash.slice(4),false)}
 document.querySelector('#age-form')?.addEventListener('submit',()=>queueMicrotask(()=>{load();restoreEntry()}));
 document.addEventListener('visibilitychange',synchronize);new MutationObserver(()=>{if(permitted())load();restoreEntry();synchronize()}).observe(document.documentElement,{attributes:true,attributeFilter:['class']});matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change',synchronize);
 addEventListener('pagehide',()=>{if(savedScrollRestoration)history.scrollRestoration=savedScrollRestoration;stopped=true;clearTimeout(readingTimer);cancelAnimationFrame(raf);cancelAnimationFrame(noiseFrame);noiseFrame=0;clips.forEach(v=>v.pause())});
 addEventListener('pageshow',e=>{if(e.persisted){if('scrollRestoration' in history)history.scrollRestoration='manual';stopped=false;synchronize();if(location.hash.startsWith('#tv-')&&permitted()){alignRoom();showProgram(location.hash.slice(4),false)}}});
 restoreEntry();
}
