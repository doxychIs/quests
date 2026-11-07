import {logoPose,logoProgress,type LogoRect} from '../lib/hub-logo';

/** One physical word follows scroll. No autoplay, cloned flying text or idle animation loop. */
export function initHubHero(){
 const hero=document.querySelector<HTMLElement>('[data-hub-hero]');
 const logo=hero?.querySelector<HTMLElement>('[data-hub-logo]');
 const home=hero?.querySelector<HTMLElement>('.hub-logo-home');
 const target=document.querySelector<HTMLElement>('[data-logo-target]');
 if(!hero||!logo||!home||!target)return;
 const media=matchMedia('(prefers-reduced-motion: reduce)');
 let origin:LogoRect={left:0,top:0,width:1,height:1},travel=1,frame=0,measureNeeded=true;
 const calm=()=>media.matches||document.documentElement.classList.contains('calm');
 function update(){
  frame=0;
  if(document.hidden)return;
  if(measureNeeded){
   const r=home!.getBoundingClientRect();
   if(r.width<1||r.height<1)return;
   origin={left:r.left,top:r.top+scrollY,width:r.width,height:r.height};
   travel=Math.max(1,hero!.offsetHeight*.86);measureNeeded=false;
  }
  const end=target!.getBoundingClientRect();
  const reduced=calm(),p=reduced?(hero!.getBoundingClientRect().bottom<=end.bottom+40?1:0):logoProgress(scrollY,travel);
  const start={...origin,top:origin.top-(reduced?scrollY:0)};
  const pose=logoPose(start,end,p);
  logo!.style.setProperty('--logo-x',`${pose.x.toFixed(3)}px`);
  logo!.style.setProperty('--logo-y',`${pose.y.toFixed(3)}px`);
  logo!.style.setProperty('--logo-scale',String(pose.scale));
  logo!.dataset.logoDocked=String(p===1);
  hero!.dataset.logoReady='true';
 }
 function schedule(){if(!frame&&!document.hidden)frame=requestAnimationFrame(update)}
 function measure(){measureNeeded=true;schedule()}
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',measure);
 addEventListener('pageshow',measure);media.addEventListener('change',schedule);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0}else measure()});
 new ResizeObserver(measure).observe(home);
 new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
 document.fonts?.ready.then(measure);
 update();
}
