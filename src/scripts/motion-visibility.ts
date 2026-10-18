/** Pause infinite animations at their current time instead of restarting them on scroll. */
export function initAnimationVisibility(){
 const html=document.documentElement;
 const tabState=()=>html.classList.toggle('motion-tab-hidden',document.hidden);
 tabState();
 if(typeof document.getAnimations!=='function'){document.addEventListener('visibilitychange',tabState);return}
 type Tracked={visible:boolean;animations:Set<Animation>;held:Set<Animation>};
 const targets=new Map<Element,Tracked>();let scheduled=0,suspended=false;
 const inView=(el:Element)=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.right>0&&r.top<innerHeight&&r.left<innerWidth};
 function sync(el:Element,state:Tracked){
  const permitted=!(el.closest('.restricted')&&!html.classList.contains('adult'));
  const run=!suspended&&!document.hidden&&state.visible&&permitted;
  for(const animation of state.animations){
   if(!run){if(animation.playState==='running'||animation.pending){animation.pause();state.held.add(animation)}}
   else if(state.held.has(animation)&&animation.playState==='paused'){
    // Respect independent CSS pauses, including the TV's stopped-signal mode.
    const css=getComputedStyle(el).animationPlayState.split(',').map(s=>s.trim());
    if(css.every(s=>s==='paused'))continue;
    animation.play();state.held.delete(animation);
   }
  }
  const status=[...state.animations].some(a=>a.playState==='running'||a.pending)?'running':'paused';
  if(el.getAttribute('data-motion-state')!==status)el.setAttribute('data-motion-state',status);
 }
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){const state=targets.get(entry.target);if(state){state.visible=entry.isIntersecting;sync(entry.target,state)}}},{threshold:0});
 function refresh(){
  scheduled=0;const active=new Set(document.getAnimations());
  for(const [el,state]of targets){for(const a of state.animations)if(!active.has(a)){state.animations.delete(a);state.held.delete(a)}if(!el.isConnected||!state.animations.size){observer.unobserve(el);targets.delete(el);el.removeAttribute('data-motion-state')}}
  for(const a of active){const effect=a.effect as KeyframeEffect|null,el=effect?.target;if(!(el instanceof Element)||effect?.getTiming().iterations!==Infinity)continue;
   let state=targets.get(el);if(!state){state={visible:inView(el),animations:new Set(),held:new Set()};targets.set(el,state);observer.observe(el)}state.animations.add(a);
  }
  for(const [el,state]of targets)sync(el,state);
 }
 function schedule(){if(document.hidden){refresh();return}if(!scheduled)scheduled=requestAnimationFrame(refresh)}
 function visibility(){tabState();if(scheduled){cancelAnimationFrame(scheduled);scheduled=0}refresh()}
 const mutations=new MutationObserver(schedule);mutations.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','open']});
 const preferences=new MutationObserver(schedule);preferences.observe(html,{attributes:true,attributeFilter:['class']});
 document.addEventListener('animationstart',schedule);document.addEventListener('animationcancel',schedule);document.addEventListener('visibilitychange',visibility);
 addEventListener('pagehide',()=>{suspended=true;if(scheduled)cancelAnimationFrame(scheduled);scheduled=0;for(const [el,state]of targets)sync(el,state)});
 addEventListener('pageshow',()=>{suspended=false;visibility()});
 refresh();document.fonts?.ready.then(schedule);
}

/** Ambient video auto-pauses outside the actual viewport; native manual pauses persist. */
export function initLazyVideoVisibility(){
 const query=matchMedia('(prefers-reduced-motion: reduce)');
 const calm=()=>query.matches||document.documentElement.classList.contains('calm');
 const states=new Map<HTMLVideoElement,{visible:boolean;wanted:boolean;autoPaused:boolean}>();let suspended=false;
 function sync(video:HTMLVideoElement){const state=states.get(video)!;
  if(!suspended&&state.visible&&!document.hidden&&!calm()&&state.wanted){
   if(!video.getAttribute('src')&&video.dataset.src)video.src=matchMedia('(max-width:760px)').matches&&video.dataset.srcMobile?video.dataset.srcMobile:video.dataset.src;
   state.autoPaused=false;video.play().catch(()=>{});
  }else{state.autoPaused=true;video.pause()}
 }
 const syncAll=()=>states.forEach((_,video)=>sync(video));
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){const video=entry.target as HTMLVideoElement;states.get(video)!.visible=entry.isIntersecting;sync(video)}},{threshold:0});
 document.querySelectorAll<HTMLVideoElement>('[data-lazy-video]').forEach(video=>{
  const state={visible:false,wanted:true,autoPaused:true};states.set(video,state);observer.observe(video);
  video.addEventListener('pause',()=>{if(!state.autoPaused&&state.visible&&!document.hidden&&video.paused)state.wanted=false});
  video.addEventListener('play',()=>{state.wanted=true;if(suspended||!state.visible||document.hidden||calm()){state.autoPaused=true;video.pause()}else state.autoPaused=false});
 });
 document.addEventListener('visibilitychange',syncAll);query.addEventListener('change',syncAll);
 new MutationObserver(syncAll).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
 addEventListener('pagehide',()=>{suspended=true;syncAll()});addEventListener('pageshow',()=>{suspended=false;syncAll()});
}
