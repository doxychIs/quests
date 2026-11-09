import {logoPose,logoProgress,type LogoRect} from '../lib/hub-logo';
import {HERO_PIN_END,clamp01,handScrollState,introLetterProgress,smoothstep,smootherstep,smoothScrollProgress} from '../lib/hub-hand-motion';
import type {HandController} from './hub-hand';

/** Native scrolling drives the entry, hold and exit of one pinned scene. */
export function initHubHero(){
 const hero=document.querySelector<HTMLElement>('[data-hub-hero]');
 const logo=hero?.querySelector<HTMLAnchorElement>('[data-hub-logo]');
 const home=hero?.querySelector<HTMLElement>('.hub-logo-home');
 const stage=hero?.querySelector<HTMLElement>('[data-hand-stage]');
 const host=hero?.querySelector<HTMLElement>('[data-hand-scene]');
 const target=document.querySelector<HTMLElement>('[data-logo-target]');
 if(!hero||!logo||!home||!stage||!host||!target)return;
 const letters=[...logo.querySelectorAll<HTMLElement>('.hub-logo-letter')];
 const media=matchMedia('(prefers-reduced-motion: reduce)'),abort=new AbortController();
 let controller:HandController|undefined,started=false,destroyed=false,visible=true;
 let failed=false,frame=0,measureNeeded=true,loadTimer=0;
 let origin:LogoRect={left:0,top:0,width:1,height:1},pinTravel=1,travel=1,start=0;
 let displayedProgress=0,positioned=false,lastFrame=0;
 const calm=()=>media.matches||document.documentElement.classList.contains('calm');
 const active=()=>!destroyed&&typeof document!=='undefined'&&!!document.documentElement;
 function schedule(){if(!frame&&active()&&!document.hidden)frame=requestAnimationFrame(update)}
 function measure(){measureNeeded=true;schedule()}
 function fallback(){
  clearTimeout(loadTimer);failed=true;controller?.dispose();controller=undefined;
  hero!.dataset.handState='fallback';measure();
 }
 async function load(){
  if(started||destroyed||calm())return;started=true;
  loadTimer=window.setTimeout(()=>{fallback();abort.abort()},12000);
  try{
   const {createHubHand}=await import('./hub-hand');
   if(!active()||abort.signal.aborted)return;
   const hand=await createHubHand(host!,host!.dataset.handSrc!,abort.signal,fallback,schedule);
   if(destroyed||abort.signal.aborted){hand.dispose();return}
   clearTimeout(loadTimer);controller=hand;
   hero!.dataset.handState=calm()?'reduced':'ready';measure();
  }catch(error){if(active()){fallback();if(!abort.signal.aborted)console.warn('ИНОЕ: 3D недоступно, навигация сохранена.',error)}}
 }
 function update(now=performance.now()){
  frame=0;if(!active()||document.hidden)return;
  const seconds=lastFrame?Math.min(.05,(now-lastFrame)/1000):1/60;lastFrame=now;
  const reduced=calm(),simplified=reduced||failed;
  const duration=controller?.duration||10;
  hero!.dataset.introPhase=reduced?'reduced':failed?'fallback':controller?'appearance':'loading';
  if(simplified){
   logo!.style.opacity='1';logo!.tabIndex=0;
   document.documentElement.style.setProperty('--hub-nav-opacity','1');
   document.documentElement.style.setProperty('--hub-nav-events','auto');
  }
  const remeasuring=measureNeeded;
  if(measureNeeded){
   const r=home!.getBoundingClientRect(),section=hero!.getBoundingClientRect();
   if(r.width<1)return;
   const headerHeight=target!.closest('header')!.clientHeight;
   start=Math.max(0,section.top+scrollY-headerHeight);
   origin={left:r.left,top:section.top+scrollY+home!.offsetTop,width:r.width,height:r.height};
   pinTravel=Math.max(1,hero!.offsetHeight-stage!.offsetHeight);
   travel=simplified?pinTravel:pinTravel/HERO_PIN_END;
   controller?.resize();
   measureNeeded=false;
  }
  const position=Math.max(0,scrollY-start),targetProgress=clamp01(position/travel);
  const instant=simplified||!positioned||remeasuring||!visible||targetProgress===0||targetProgress===1;
  displayedProgress=instant?targetProgress:smoothScrollProgress(displayedProgress,targetProgress,seconds);positioned=true;
  const progress=displayedProgress;
  const poseState=handScrollState(progress,duration);
  const opening=smootherstep((poseState.time/duration-.24)/.4);
  const presence=simplified?0:smootherstep(progress/.1)*(1-smootherstep((progress-.89)/.11));
  const docking=reduced?(position>=stage!.clientHeight*.5?1:0):failed?logoProgress(position,pinTravel):poseState.docking;
  let from=reduced?{...origin,top:origin.top-scrollY}:origin;
  if(!simplified&&controller){
   const anchor=controller.anchor,rect=stage!.getBoundingClientRect();
   const margin=Math.max(16,rect.width*.04),half=origin.width/2;
   const center=Math.max(margin+half,Math.min(rect.width-margin-half,anchor.x*rect.width));
   const bottom=Math.min(anchor.y*rect.height-rect.height*.10,anchor.top*rect.height-rect.height*.06);
   from={...origin,left:rect.left+center-half,top:rect.top+Math.max(20,bottom-origin.height)};
  }
  const pose=logoPose(from,target!.getBoundingClientRect(),docking);
  logo!.style.setProperty('--logo-x',`${pose.x.toFixed(3)}px`);
  logo!.style.setProperty('--logo-y',`${pose.y.toFixed(3)}px`);
  logo!.style.setProperty('--logo-scale',String(pose.scale));
  logo!.style.setProperty('--brand-gleam',String(.98+opening*(1-docking)*.14));
  logo!.style.setProperty('--logo-magic',String(simplified?0:opening*(1-docking)));
  logo!.style.setProperty('--logo-float',String(simplified?0:opening*(1-docking)));
  logo!.style.setProperty('--logo-tilt-x',`${(5*(1-docking)).toFixed(3)}deg`);
  logo!.style.setProperty('--logo-tilt-y',`${(-9*(1-docking)).toFixed(3)}deg`);
  logo!.style.setProperty('--logo-tilt-z',`${(-.4*(1-docking)).toFixed(3)}deg`);
  logo!.style.setProperty('--logo-depth',`${(.045*(1-docking)).toFixed(4)}em`);
  logo!.style.setProperty('--logo-side-opacity',String(1-docking));
  logo!.dataset.logoDocked=String(docking===1);
  let revealed=0;
  letters.forEach((letter,index)=>{
   const amount=simplified||poseState.docking>0?1:introLetterProgress(poseState.time,duration,index);
   revealed=Math.max(revealed,amount);
   letter.style.setProperty('--letter-reveal',String(amount));
   letter.style.setProperty('--letter-mask',amount===1?'none':`linear-gradient(180deg,#000 0%,#000 ${Math.max(0,amount*125-20).toFixed(2)}%,transparent ${(amount*125+5).toFixed(2)}%)`);
   const sheen=smootherstep((poseState.time/duration-.29-index*.055)/.54);
   letter.style.setProperty('--letter-sheen-x',`${(-150+sheen*500).toFixed(2)}px`);
   letter.style.setProperty('--letter-sheen-opacity',String(simplified?0:Math.sin(sheen*Math.PI)*(1-docking)*.86));
   letter.style.setProperty('--letter-filter',amount===1?'none':`blur(${((1-amount)*3.5).toFixed(3)}px)`);
   letter.style.transform=`translate3d(0,${((1-amount)*.24).toFixed(4)}em,0) rotateX(${((1-amount)*24).toFixed(3)}deg) rotateZ(${((1-amount)*(index-1.5)*.7).toFixed(3)}deg)`;
  });
  logo!.style.opacity=simplified||controller&&revealed>0?'1':'0';
  logo!.tabIndex=simplified||revealed>.1?0:-1;
  hero!.dataset.introPhase=reduced?'reduced':failed?'fallback':controller?poseState.phase:'loading';
  hero!.dataset.scrollProgress=progress.toFixed(5);hero!.dataset.dockProgress=docking.toFixed(5);
  hero!.dataset.scrollTarget=targetProgress.toFixed(5);
  hero!.dataset.pinReleased=String(position>=pinTravel);
  const navOpacity=simplified?1:smoothstep(progress/.1);
  document.documentElement.style.setProperty('--hub-nav-opacity',String(navOpacity));
  document.documentElement.style.setProperty('--hub-nav-events',navOpacity>.01?'auto':'none');
  host!.style.opacity=controller&&!reduced?String(poseState.opacity):'0';
  controller?.setVisible(visible&&!reduced);
  controller?.seek(reduced?duration:poseState.time,{presence,opening,progress,arrival:poseState.arrival,reveal:revealed*(1-docking)});
  if(!simplified&&visible&&Math.abs(progress-targetProgress)>=.00002)schedule();
 }
 function motionChange(){
  hero!.dataset.handState=calm()?'reduced':failed?'fallback':controller?'ready':'loading';
  if(!calm()&&!started)void load();measure();
 }
 function visibility(){controller?.setVisible(!document.hidden&&visible&&!calm());if(!document.hidden)measure();else{cancelAnimationFrame(frame);frame=0}}
 const resizeObserver=new ResizeObserver(measure);resizeObserver.observe(stage);resizeObserver.observe(home);resizeObserver.observe(target);
 const intersection=new IntersectionObserver(entries=>{
  visible=entries[0].isIntersecting;controller?.setVisible(visible&&!calm());if(visible){void load();schedule()}
 },{threshold:0});intersection.observe(stage);
 const settingsObserver=new MutationObserver(motionChange);settingsObserver.observe(document.documentElement,{attributes:true,attributeFilter:['class']});
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',measure);addEventListener('pageshow',measure);
 media.addEventListener('change',motionChange);document.addEventListener('visibilitychange',visibility);
 addEventListener('pagehide',event=>{
  cancelAnimationFrame(frame);frame=0;if(event.persisted)return;
  destroyed=true;clearTimeout(loadTimer);abort.abort();controller?.dispose();resizeObserver.disconnect();intersection.disconnect();settingsObserver.disconnect();
  removeEventListener('scroll',schedule);removeEventListener('resize',measure);removeEventListener('pageshow',measure);
  document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',motionChange);
 });
 hero.dataset.handState=calm()?'reduced':'loading';hero.dataset.logoReady='true';
 const initialHash=location.hash;
 document.fonts?.ready.then(()=>{
  measure();
  // Keep an explicit link to the world selector below the expanded pinned scene.
  if(['#worlds','#how'].includes(initialHash)&&location.hash===initialHash)
   requestAnimationFrame(()=>document.getElementById(initialHash.slice(1))?.scrollIntoView({block:'start',behavior:'instant'}));
 });update();if(!calm())void load();
}
