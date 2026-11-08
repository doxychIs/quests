import {logoPose,logoProgress,type LogoRect} from '../lib/hub-logo';
import {HERO_PIN_END,clamp01,handScrollState,introLetterProgress,smoothstep} from '../lib/hub-hand-motion';
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
   const hand=await createHubHand(host!,host!.dataset.handSrc!,abort.signal,fallback);
   if(destroyed||abort.signal.aborted){hand.dispose();return}
   clearTimeout(loadTimer);controller=hand;
   hero!.dataset.handState=calm()?'reduced':'ready';measure();
  }catch(error){if(active()){fallback();if(!abort.signal.aborted)console.warn('ИНОЕ: 3D недоступно, навигация сохранена.',error)}}
 }
 function update(){
  frame=0;if(!active()||document.hidden)return;
  const reduced=calm(),simplified=reduced||failed;
  const duration=controller?.duration||10;
  const scroll=Math.max(0,scrollY-start);
  const state=handScrollState(scroll/travel,duration);
  // A failure or reduced motion must never hide the available text/navigation.
  hero!.dataset.introPhase=reduced?'reduced':failed?'fallback':controller?state.phase:'loading';
  logo!.style.opacity=simplified?'1':controller&&state.time>0?'1':'0';
  if(measureNeeded){
   const r=home!.getBoundingClientRect(),section=hero!.getBoundingClientRect();
   if(r.width<1)return;
   const headerHeight=target!.closest('header')!.clientHeight;
   start=Math.max(0,section.top+scrollY-headerHeight);
   origin={left:r.left,top:section.top+scrollY+home!.offsetTop,width:r.width,height:r.height};
   pinTravel=Math.max(1,hero!.offsetHeight-stage!.offsetHeight);
   travel=simplified?pinTravel:pinTravel/HERO_PIN_END;
   controller?.resize(Math.max(1,Math.min(stage!.clientHeight*.68,home!.offsetTop-32)));
   measureNeeded=false;
  }
  const position=Math.max(0,scrollY-start),progress=clamp01(position/travel);
  const poseState=handScrollState(progress,duration);
  const docking=reduced?(position>=stage!.clientHeight*.5?1:0):failed?logoProgress(position,pinTravel):poseState.docking;
  const from=reduced?{...origin,top:origin.top-scrollY}:origin;
  const pose=logoPose(from,target!.getBoundingClientRect(),docking);
  logo!.style.setProperty('--logo-x',`${pose.x.toFixed(3)}px`);
  logo!.style.setProperty('--logo-y',`${pose.y.toFixed(3)}px`);
  logo!.style.setProperty('--logo-scale',String(pose.scale));
  logo!.style.setProperty('--brand-gleam',String(.98+Math.sin(progress*Math.PI)*.06));
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
   letter.style.setProperty('--letter-mask',amount===1?'none':`inset(0 0 ${(1-amount)*100}% 0)`);
   letter.style.transform=`translate3d(0,${((1-amount)*.30).toFixed(4)}em,0)`;
  });
  logo!.style.opacity=simplified||controller&&revealed>0?'1':'0';
  logo!.tabIndex=simplified||revealed>.1?0:-1;
  hero!.dataset.introPhase=reduced?'reduced':failed?'fallback':controller?poseState.phase:'loading';
  hero!.dataset.scrollProgress=progress.toFixed(5);hero!.dataset.dockProgress=docking.toFixed(5);
  hero!.dataset.pinReleased=String(position>=pinTravel);
  const navOpacity=simplified?1:smoothstep(progress/.1);
  document.documentElement.style.setProperty('--hub-nav-opacity',String(navOpacity));
  document.documentElement.style.setProperty('--hub-nav-events',navOpacity>.01?'auto':'none');
  host!.style.opacity=controller&&!reduced?String(poseState.opacity):'0';
  controller?.setVisible(visible&&!reduced);
  controller?.seek(reduced?duration:poseState.time);
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
 document.fonts?.ready.then(measure);update();if(!calm())void load();
}
