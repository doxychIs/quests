import {roomCamera,roomCorridorProgress,roomFocusPose,roomOverviewPose,roomStagePose,roomStages,roomStations,roomEase,travelRoomPose,type RoomPose,type RoomStage,type RoomStationId} from '../lib/room-experience';
import {createRoomDisturbance,roomAtmosphereFrame,type RoomDisturbance,type RoomDisturbanceKind} from '../lib/room-atmosphere';
import {projectionCSS} from '../lib/room-projection';
import type {createRoomRenderer,ProjectedGlass,RoomScreenLabel} from '../lib/room-renderer';
import {soundCue} from './sound-cues';
import {createRoomSurfacePainter} from '../lib/room-surface-painter';

export function initRoomExperience(){
 const candidate=document.querySelector<HTMLElement>('div[data-room-experience]');if(!candidate||candidate.dataset.roomInitialized)return;
 const root=candidate,canvas=root.querySelector<HTMLCanvasElement>('[data-room-canvas]')!;
 if(!canvas)return;root.dataset.roomInitialized='true';root.dataset.roomMode='loading';
 const html=document.documentElement,query=matchMedia('(prefers-reduced-motion: reduce)'),events=new AbortController();
 const surfaces=new Map([...root.querySelectorAll<HTMLElement>('[data-room-surface]')].map(s=>[s.dataset.roomSurface as RoomStationId,s]));
 const hits=[...root.querySelectorAll<HTMLButtonElement>('[data-room-open]')];
 const programs=JSON.parse(root.querySelector('[data-room-programs]')?.textContent||'[]') as RoomScreenLabel[];
 let view:Awaited<ReturnType<typeof createRoomRenderer>>|undefined,loading=false,failed=false,destroyed=false,visible=false,suspended=false,contextLost=false;
 let painter:ReturnType<typeof createRoomSurfacePainter>|undefined;
 const videoFrames=new Map<HTMLVideoElement,number>();let lastVideoFrame=0;
 let projectorOn=false,projectorTime=0,projectorTimer:ReturnType<typeof setTimeout>|undefined,viewerOpen=false;
 let projectionURL=programs.find(program=>program.id==='gallery')?.image||'';
 let cameraOn=!!location.hash&&!['#atmosphere','#main'].includes(location.hash),cameraAmount=cameraOn?1:0,cameraLift:{from:number;at:number}|undefined,questDetails=false;
 root.dataset.roomCamera=String(cameraOn);root.dataset.roomBroadcastView='image';
 let lifeTime=0,lifeTimer:ReturnType<typeof setTimeout>|undefined;
 function syncLife(){
  const run=cameraOn&&cameraAmount>.98&&view?.liveMotion&&permitted()&&!reduced()&&root.dataset.roomMode==='3d'&&(view.needsLifeFrame?.()??(lastPose.position[2]>7||stage==='ward'||stage==='entry'));
  if(!run){clearTimeout(lifeTimer);lifeTimer=undefined;return;}
  if(lifeTimer)return;
  lifeTimer=setTimeout(()=>{lifeTimer=undefined;lifeTime+=83;paint(performance.now());},83);
 }
 function syncProjector(){
  const run=projectorOn&&active==='gallery'&&permitted()&&!reduced()&&root.dataset.roomMode==='3d';
  if(!run){clearTimeout(projectorTimer);projectorTimer=undefined;return;}
  if(projectorTimer)return;
  projectorTimer=setTimeout(()=>{projectorTimer=undefined;projectorTime+=71;paint(performance.now());},71);
 }
 let frame=0,previous=0,current=scrollY,target=scrollY,top=0,lastScroll=scrollY,lastPose=roomStagePose('entry',innerWidth/innerHeight),active:RoomStationId|undefined,hover:RoomStationId|undefined,stage:RoomStage='entry';
 let selected:RoomStationId|undefined,override:RoomPose|undefined,transition:{from:RoomPose;at:number}|undefined,suppressed:RoomStage|undefined,parallax={x:0,y:0};
 let pendingFocus:RoomStationId|undefined,pendingReturn:RoomStationId|undefined;
 let lastRender='',projected:Record<string,ProjectedGlass>={},pulse:string|undefined,pulseTimer:ReturnType<typeof setTimeout>|undefined,restoreTimer:ReturnType<typeof setTimeout>|undefined;
 let disturbance:RoomDisturbance|undefined,firstDisturbance=true,lastKind:RoomDisturbanceKind|undefined,walkDistance=0,lastStep=0,stepSide=1;
 const reduced=()=>query.matches||html.classList.contains('calm');
 const permitted=()=>!destroyed&&!suspended&&visible&&!document.hidden&&!contextLost&&!viewerOpen&&html.classList.contains('adult');
 const atmosphereAllowed=()=>cameraOn&&cameraAmount>.98&&permitted()&&!reduced()&&active!=='game'&&active!=='gallery'&&active!=='info'&&root.dataset.roomMode==='3d';
 // Scroll anchors use CSS svh, which can differ from innerHeight under mobile browser chrome.
 const viewportHeight=()=>canvas.clientHeight||innerHeight;
 const viewportWidth=()=>canvas.clientWidth||innerWidth;
 const aspect=()=>Math.max(.3,viewportWidth()/Math.max(1,viewportHeight()));
 function mirrorVideo(video:HTMLVideoElement){
  if(videoFrames.has(video)||!video.requestVideoFrameCallback||video.paused||video.ended||!permitted()||active!=='game')return;
  videoFrames.set(video,video.requestVideoFrameCallback(time=>{
   videoFrames.delete(video);if(!permitted()||active!=='game')return;
   if(time-lastVideoFrame>=(innerWidth<=760?66:30)){lastVideoFrame=time;schedule();}mirrorVideo(video);
  }));
 }
 const dispatchActive=(id?:RoomStationId|'all')=>document.dispatchEvent(new CustomEvent('room:surface-active',{detail:{id}}));
 function hideSurfaces(){for(const surface of surfaces.values()){surface.hidden=true;surface.inert=true;surface.setAttribute('aria-hidden','true');}}
 hideSurfaces();
 function setActive(id?:RoomStationId){
  if(root.dataset.roomMode==='fallback'){active=undefined;return;}
  if(active===id)return;active=id;questDetails=false;root.dataset.roomBroadcastView='image';
  root.querySelectorAll<HTMLElement>('[data-room-broadcast-for]').forEach(nav=>nav.hidden=nav.dataset.roomBroadcastFor!==id);
  root.querySelectorAll('[data-room-broadcast-details]').forEach(button=>{button.setAttribute('aria-pressed','false');button.textContent='Описание';});
  for(const [key,surface]of surfaces){const show=key===id;surface.hidden=!show;surface.inert=!show;surface.setAttribute('aria-hidden',String(!show));}
  dispatchActive(id);
  if(!atmosphereAllowed())stopAtmosphere();else atmosphere();
 }
 function setCamera(on:boolean){
  if(!html.classList.contains('adult'))return;
  if(on!==cameraOn){cameraLift={from:cameraAmount,at:performance.now()};cameraOn=on;root.dataset.roomCameraLifting=String(on&&!reduced());}
  root.dataset.roomCamera=String(on);
  root.querySelectorAll('[data-room-camera-power]').forEach(button=>{button.setAttribute('aria-pressed',String(on));button.textContent=on?'Опустить камеру':'Поднять камеру';});
  if(!on)stopAtmosphere();soundCue('tuner');lastRender='';schedule();
 }
 function stop(){if(frame)cancelAnimationFrame(frame);frame=0;previous=0;root.classList.remove('is-camera-moving');}
 function stopAtmosphere(){clearTimeout(lifeTimer);lifeTimer=undefined;clearTimeout(projectorTimer);projectorTimer=undefined;clearTimeout(pulseTimer);clearTimeout(restoreTimer);pulseTimer=restoreTimer=undefined;pulse=undefined;disturbance=undefined;root.dataset.roomDisturbance='idle';}
 const roomSound=(kind:'light'|'cloth'|'pipe'|'step',strength:number,pan:number)=>{
  if(permitted()&&!reduced())document.dispatchEvent(new CustomEvent('room:ambience',{detail:{kind,strength,pan}}));
 };
 function animateAtmosphere(){
  restoreTimer=undefined;
  if(!atmosphereAllowed()){stopAtmosphere();return;}
  const time=performance.now(),air=roomAtmosphereFrame(disturbance,time);
  if(air){
   pulse=air.signal?'quest_'+((disturbance?.fixture||0)%4):undefined;
   paint(time);
   if(!disturbance||!atmosphereAllowed())return;
   // Bounded bursts only. Mobile gets at most 15 ambient frames per second;
   // stationary intervals and an active game keep their on-demand renderer.
   restoreTimer=setTimeout(animateAtmosphere,innerWidth<=760?67:42);
  }else{disturbance=undefined;pulse=undefined;root.dataset.roomDisturbance='idle';paint(time);atmosphere();}
 }
 function atmosphere(){
  if(pulseTimer||disturbance||!atmosphereAllowed())return;
  pulseTimer=setTimeout(()=>{pulseTimer=undefined;if(!permitted()||reduced())return;
   if(active==='game')return;
   const corridor=lastPose.position[2]>7;
   const choices:RoomDisturbanceKind[]=corridor?['hand','hand','light','pipe','drip']:active?.startsWith('quest_')?['signal','signal','light']:active==='team'?['light','drip']:stage==='entry'?['light','cloth','pipe','signal','drip']:['light','pipe','signal'];
   const different=choices.filter(kind=>kind!==lastKind);
   const kind=firstDisturbance?'light':different[Math.floor(Math.random()*different.length)];
   let fixture=0;
   if(corridor){const positions=[10,14,18];fixture=1+positions.reduce((best,z,i)=>Math.abs(z-lastPose.position[2])<Math.abs(positions[best]-lastPose.position[2])?i:best,0);}
   if(kind==='hand'){const positions=[8,8.7,10.6,11.3,13.8,15.3,17,18.7];fixture=positions.reduce((best,z,i)=>Math.abs(z-lastPose.position[2])<Math.abs(positions[best]-lastPose.position[2])?i:best,0);}
   if(kind==='signal')fixture=active?.startsWith('quest_')?Number(active.slice(-1)):Math.floor(Math.random()*4);
   if(kind==='drip'&&active==='team')fixture=4;
   disturbance=createRoomDisturbance(kind,performance.now(),fixture);lastKind=kind;firstDisturbance=false;
   if(kind!=='signal')roomSound(kind==='hand'?'cloth':kind==='drip'?'pipe':kind,disturbance.strength*(kind==='drip'?.25:1),kind==='cloth'?.65:kind==='pipe'?-.55:0);
   root.dataset.roomDisturbance=kind;animateAtmosphere();
  },firstDisturbance?1100+Math.random()*800:3400+Math.random()*6000);
 }
 function fallback(){
  if(root.dataset.roomMode==='fallback')return;
  failed=true;stop();stopAtmosphere();active=selected=hover=undefined;override=transition=undefined;pendingFocus=pendingReturn=undefined;
  root.dataset.roomMode='fallback';root.dataset.roomReady='true';root.removeAttribute('data-room-textures');painter?.dispose();painter=undefined;const oldView=view;view=undefined;oldView?.dispose();
  hits.forEach(hit=>hit.hidden=true);for(const surface of surfaces.values()){surface.hidden=false;surface.inert=false;surface.removeAttribute('aria-hidden');surface.style.removeProperty('transform');}
  dispatchActive('all');root.querySelectorAll<HTMLElement>('[data-room-leave]').forEach(button=>button.hidden=true);
  if(location.hash)navigate(location.hash.slice(1));
 }
 async function prepare(){
  if(view||loading||failed||!permitted())return;
  if(typeof WebGL2RenderingContext==='undefined'){root.dataset.roomError='WebGL2 unavailable';fallback();return;}
  loading=true;
  try{
   const {createRoomRenderer}=await import('../lib/room-renderer');
   const loaded=await createRoomRenderer(canvas,root.dataset.roomModel!,{screens:programs,invalidate:()=>{lastRender='';schedule();}});
   if(destroyed||failed){loaded.dispose();return;}view=loaded;root.dataset.roomMode='3d';
   if(typeof view.updateSurface==='function'){
    painter=createRoomSurfacePainter(root.querySelector('[data-room-tv-content]')!,()=>{if(active)schedule();});root.dataset.roomTextures='true';root.dataset.roomCompact=String(innerWidth<=760);
    // Identical initial content at a distance and up close. This synchronous
    // measurement never exposes the inert input layers to paint or focus.
    for(const [id,surface]of surfaces){surface.hidden=false;surface.style.visibility='visible';const result=id!=='gallery'&&!id.startsWith('quest_')&&painter.capture(surface);if(result)view.updateSurface(id,result.canvas);surface.hidden=true;surface.style.removeProperty('visibility');}
    // Scroll/visibility can already select a station while the GLB is loading.
    // Priming hid all layers; force the first real paint to restore that selection.
    active=undefined;
   }
   if(projectorOn)view.setProjection?.(projectionURL);lastRender='';paint(performance.now());root.dataset.roomReady='true';atmosphere();
  }catch(error){root.dataset.roomError=error instanceof Error?error.message:String(error);fallback();}finally{loading=false;}
 }
 function project(){
  const virtualWidth=innerWidth<=760?640:960,virtualHeight=innerWidth<=760?460:690;
  for(const station of roomStations){
   const glass=projected[station.id],surface=surfaces.get(station.id),hit=hits.find(h=>h.dataset.roomOpen===station.id);
   if(!glass)continue;
   let matrix:string;try{matrix=`matrix3d(${projectionCSS(glass.quad,virtualWidth,virtualHeight).join(',')})`;}catch{continue;}
   if(surface&&active===station.id){surface.style.transform=matrix;surface.style.visibility=glass.visible?'visible':'hidden';}
   if(hit){
    const show=glass.visible&&(!active||station.id==='projector'&&active==='gallery')&&!transition;
    hit.hidden=!show;hit.inert=!show;hit.style.visibility=show?'visible':'hidden';hit.style.width=virtualWidth+'px';hit.style.height=virtualHeight+'px';hit.style.transform=matrix;hit.style.zIndex=String(Math.max(0,Math.round(10000-(glass.depth||0)*100)));
   }
  }
  if(!transition&&active&&pendingFocus===active){surfaces.get(active)?.focus({preventScroll:true});pendingFocus=undefined;}
  if(!transition&&pendingReturn){const button=hits.find(hit=>hit.dataset.roomOpen===pendingReturn);if(button&&!button.hidden){button.focus({preventScroll:true});pendingReturn=undefined;}}
 }
 function paint(time:number){
  if(!permitted()||root.dataset.roomMode==='fallback')return;
  if(cameraLift){const t=reduced()?1:Math.min(1,(time-cameraLift.at)/760);cameraAmount=cameraLift.from+((cameraOn?1:0)-cameraLift.from)*roomEase(t);if(t===1){cameraLift=undefined;root.dataset.roomCameraLifting='false';atmosphere();}}
  const camera=roomCamera(current-top,viewportHeight(),aspect());if(stage!==camera.stage){stage=camera.stage;suppressed=undefined;}
  root.dataset.roomStageActive=stage;root.dataset.roomCompact=String(innerWidth<=760);root.dataset.roomReduced=String(reduced());
  let pose=reduced()?(stage==='entry'?roomOverviewPose(aspect()):roomStagePose(stage,aspect())):camera.pose;
  const goal=selected?(selected==='gallery'?roomStagePose('gallery',aspect()):roomFocusPose(selected,aspect())):override||pose;
  let settled=camera.settled;
  if(transition){const t=reduced()?1:Math.min(1,(time-transition.at)/850);pose=travelRoomPose(transition.from,goal,roomEase(t));settled=t===1;if(settled)transition=undefined;}
  else if(selected||override){pose=goal;settled=true;}
  root.dataset.roomCameraSettled=String(settled&&Math.abs(current-target)<.3&&!cameraLift);
  const authoredSurface=roomStages.find(s=>s.id===stage)?.surface;
  // A portrait view first shows the attendant and counter; tapping the register
  // moves closer to the very same paper for reading, without a replacement UI.
  const auto=authoredSurface==='info'&&aspect()<.8?undefined:authoredSurface;
  const next=settled?(selected||(!override&&suppressed!==stage?auto:undefined)):undefined;
  setActive(next);
  if(!active&&!selected&&!override&&!reduced()&&(stage==='entry'||stage==='quests')){pose={...pose,position:[pose.position[0]+parallax.x*.055,pose.position[1]+parallax.y*.025,pose.position[2]]};}
  if(!active&&!selected&&!override&&!transition&&!reduced()&&stage==='entry'&&roomCorridorProgress(current-top,viewportHeight())<1){
   const distance=Math.abs(pose.position[2]-lastPose.position[2]);
   if(distance<.7)walkDistance+=distance;
   if(walkDistance>.78&&time-lastStep>420){walkDistance=0;lastStep=time;stepSide*=-1;roomSound('step',.28,stepSide*.16);}
  }else walkDistance=0;
  lastPose=pose;
  if(view){
   const air=roomAtmosphereFrame(disturbance,time);
   const cameraTime=reduced()?0:Math.floor(time/100)/10;
   const signature=JSON.stringify([pose,active,hover,pulse,air,projectorOn,projectorTime,lifeTime,cameraTime,cameraAmount,questDetails,innerWidth,innerHeight]);
   const renderState={active,hover,pulse,atmosphere:air,projectorOn,projectorTime,lifeTime,cameraTime,cameraAmount,questDetails,calm:reduced()};
   if(signature!==lastRender){projected=view.render(pose,renderState);lastRender=signature;}
   project();
   const surface=active&&active!=='gallery'&&(!active.startsWith('quest_')||questDetails)&&surfaces.get(active);
   if(surface&&painter){const result=painter.capture(surface);if(result?.changed){view.updateSurface(active!,result.canvas);projected=view.render(pose,renderState);}}
  }
  syncProjector();syncLife();
  document.dispatchEvent(new CustomEvent('horror:investigation-frame'));
 }
 function tick(time:number){
  frame=0;if(!permitted()){stop();return;}
  const dt=previous?Math.max(0,time-previous):16;previous=time;
  current=reduced()?target:current+(target-current)*(1-Math.exp(-dt/90));if(Math.abs(target-current)<.3)current=target;
  paint(time);
  if(current!==target||transition||cameraLift)frame=requestAnimationFrame(tick);else stop();
 }
 function schedule(){
  target=scrollY;
  if(!permitted()||root.dataset.roomMode==='fallback'){stop();return;}
  if(!frame){root.classList.add('is-camera-moving');frame=requestAnimationFrame(tick);}
 }
 function focusStation(id:RoomStationId){
  if(!roomStations.some(s=>s.id===id)||!permitted()||root.dataset.roomMode==='fallback')return;
  if(!cameraOn)setCamera(true);
  if(id==='door'){navigate('info');return;}
  if(id==='projector'){document.dispatchEvent(new CustomEvent('room:projector-toggle'));return;}
  selected=id;override=undefined;suppressed=undefined;pendingFocus=id;pendingReturn=undefined;transition={from:lastPose,at:performance.now()};setActive(undefined);soundCue('channel');schedule();
 }
 function leave(){
  if(root.dataset.roomMode==='fallback')return;
  if(!active&&!selected)return;
  const was=active||selected;selected=undefined;suppressed=stage;
  override=was==='gallery'?roomStagePose('gallery',aspect()):was==='info'?roomStagePose('quests',aspect()):was==='team'||was==='game'?roomOverviewPose(aspect()):was?.startsWith('quest_')?roomStagePose('quests',aspect()):{...lastPose,position:[lastPose.position[0]*.65,lastPose.position[1]+.2,Math.min(6.5,lastPose.position[2]+1.8)]};
  pendingReturn=was;pendingFocus=undefined;transition={from:lastPose,at:performance.now()};setActive(undefined);schedule();
 }
 function navigate(id:string){
  const destination=roomStages.find(s=>s.id===id||s.hash===id||id==='journal'&&s.id==='info');if(!destination)return;
  if(root.dataset.roomMode==='fallback'){
   const element=surfaces.get(destination.surface||(destination.id==='quests'||destination.id==='ward'?'quest_0':'info'));
   (destination.id==='entry'?root:element||root).scrollIntoView({block:'start',behavior:reduced()?'instant':'smooth'});
   element?.focus({preventScroll:true});root.querySelector<HTMLDetailsElement>('.room-directory')?.removeAttribute('open');return;
  }
  if(destination.id!=='entry'&&!cameraOn)setCamera(true);
  selected=undefined;override=undefined;suppressed=undefined;setActive(undefined);
  window.scrollTo({top:top+destination.anchor*viewportHeight(),behavior:reduced()?'instant':'smooth'});
  root.querySelector<HTMLDetailsElement>('.room-directory')?.removeAttribute('open');schedule();
 }
 const onScroll=()=>{
  if(scrollY===lastScroll)return;lastScroll=scrollY;
  if(selected||override){selected=undefined;override=undefined;transition={from:lastPose,at:performance.now()};setActive(undefined);}
  schedule();
 };
 function measure(){top=root.getBoundingClientRect().top+scrollY;current=target=scrollY;lastRender='';painter?.invalidate();schedule();}
 const io=new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting);root.dataset.roomVisible=String(visible);if(visible){void prepare();schedule();atmosphere();}else{stop();stopAtmosphere();}},{threshold:0});io.observe(root);
 const mutations=new MutationObserver(()=>{if(!html.classList.contains('adult')){setActive(undefined);stop();stopAtmosphere();}else{void prepare();if(root.dataset.roomMode==='fallback')dispatchActive('all');if(reduced())stopAtmosphere();else atmosphere();measure();}});mutations.observe(html,{attributes:true,attributeFilter:['class']});
 const resize=new ResizeObserver(measure);resize.observe(root.querySelector('[data-room-stage]')!);
 hits.forEach(hit=>{
  hit.addEventListener('click',event=>{const id=hit.dataset.roomOpen as RoomStationId;if(event.detail&&view?.canSelect&&!view.canSelect(id,event.clientX,event.clientY))return;focusStation(id);},{signal:events.signal});
  hit.addEventListener('pointerenter',event=>{const id=hit.dataset.roomOpen as RoomStationId;hover=view?.canSelect&&!view.canSelect(id,event.clientX,event.clientY)?undefined:id;schedule();},{signal:events.signal});hit.addEventListener('pointerleave',()=>{hover=undefined;schedule();},{signal:events.signal});
 });
 root.querySelectorAll<HTMLElement>('[data-room-go]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();navigate(link.dataset.roomGo!);},{signal:events.signal}));
 root.querySelectorAll('[data-room-fallback]').forEach(button=>button.addEventListener('click',fallback,{signal:events.signal}));
 root.querySelectorAll('[data-room-camera-power]').forEach(button=>{button.setAttribute('aria-pressed',String(cameraOn));button.textContent=cameraOn?'Опустить камеру':'Поднять камеру';button.addEventListener('click',()=>setCamera(!cameraOn),{signal:events.signal});});
 root.querySelectorAll('[data-room-broadcast-details]').forEach(button=>button.addEventListener('click',()=>{if(!active?.startsWith('quest_'))return;questDetails=!questDetails;root.dataset.roomBroadcastView=questDetails?'details':'image';button.setAttribute('aria-pressed',String(questDetails));button.textContent=questDetails?'Изображение':'Описание';painter?.invalidate();lastRender='';schedule();},{signal:events.signal}));
 root.querySelectorAll('.room-broadcast-controls [data-room-leave]').forEach(button=>button.addEventListener('click',leave,{signal:events.signal}));
 document.addEventListener('room:leave',leave,{signal:events.signal});document.addEventListener('room:navigate',event=>navigate((event as CustomEvent).detail.id),{signal:events.signal});
 document.addEventListener('room:content-frame',()=>{if(active==='game')schedule();},{signal:events.signal});
 document.addEventListener('room:projector-power',event=>{projectorOn=!!(event as CustomEvent).detail?.on;if(projectorOn)view?.setProjection?.(projectionURL);schedule();syncProjector();},{signal:events.signal});
 document.addEventListener('room:projection-frame',event=>{projectionURL=(event as CustomEvent).detail?.src||projectionURL;if(projectorOn)view?.setProjection?.(projectionURL);},{signal:events.signal});
 document.addEventListener('room:original-viewer',event=>{viewerOpen=!!(event as CustomEvent).detail?.open;if(viewerOpen){stop();stopAtmosphere();}else{measure();atmosphere();}},{signal:events.signal});
 root.querySelectorAll('video').forEach(video=>{video.addEventListener('play',()=>mirrorVideo(video),{signal:events.signal});video.addEventListener('timeupdate',()=>{if(active==='game'){schedule();mirrorVideo(video);}},{signal:events.signal});});
 document.addEventListener('keydown',event=>{
  // Native dialog cancellation can remove `open` before a bubbling listener.
  // An Escape that originated inside that dialog still belongs to the dialog.
  const fromDialog=event.target instanceof Element&&event.target.closest('dialog');
  if(event.key==='Escape'&&!event.defaultPrevented&&!fromDialog&&!document.querySelector('dialog[open]')&&!root.querySelector('[data-horror-scare]:not([hidden])'))leave();
 },{signal:events.signal});
 root.addEventListener('pointermove',event=>{if(active||reduced()||event.pointerType==='touch')return;parallax={x:event.clientX/viewportWidth()-.5,y:.5-event.clientY/viewportHeight()};schedule();},{passive:true,signal:events.signal});
 addEventListener('scroll',onScroll,{passive:true,signal:events.signal});addEventListener('resize',measure,{passive:true,signal:events.signal});
 const preferenceChange=()=>{if(reduced())stopAtmosphere();else atmosphere();measure();};query.addEventListener('change',preferenceChange);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();stopAtmosphere();}else{void prepare();measure();atmosphere();}},{signal:events.signal});
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;fallback();},{signal:events.signal});
 const hide=()=>{suspended=true;stop();stopAtmosphere();},show=()=>{suspended=false;measure();atmosphere();};
 addEventListener('pagehide',hide,{signal:events.signal});addEventListener('pageshow',show,{signal:events.signal});
 document.fonts?.ready.then(()=>{if(!destroyed)measure();});measure();
 return{destroy(){destroyed=true;stop();stopAtmosphere();for(const [video,id]of videoFrames)video.cancelVideoFrameCallback?.(id);videoFrames.clear();events.abort();io.disconnect();resize.disconnect();mutations.disconnect();query.removeEventListener('change',preferenceChange);painter?.dispose();view?.dispose();}};
}
