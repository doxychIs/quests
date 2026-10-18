import {passageTimeline} from '../lib/horror-passage';
import {createFrameScrubber} from '../lib/scroll-cinema';
const calm=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.classList.contains('calm');
export function initHorrorCinema(){
 const film=document.querySelector<HTMLElement>('.horror-film');if(!film||film.dataset.ready)return;film.dataset.ready='yes';
 const video=film.querySelector<HTMLVideoElement>('[data-horror-film]')!,door=document.querySelector<HTMLElement>('[data-horror-door]')!;
 let visible=film.getBoundingClientRect().bottom>0&&film.getBoundingClientRect().top<innerHeight,manualPause=false,needsGesture=false,frame=0,awakeTimer:ReturnType<typeof setTimeout>;
 const pause=film.querySelector<HTMLButtonElement>('[data-film-pause]')!;
 // Set the media property as well as the attribute for muted autoplay on mobile browsers.
 video.muted=true;
 video.addEventListener('playing',()=>{needsGesture=false;film.classList.add('is-playing');pause.textContent='Пауза'});
 video.addEventListener('error',()=>{film.classList.remove('is-playing');needsGesture=true;pause.textContent='Повторить видео'});
 function playback(){if(document.documentElement.classList.contains('adult')&&visible&&!document.hidden&&!calm()&&!manualPause&&!needsGesture){if(!video.getAttribute('src'))video.src=matchMedia('(max-width:760px)').matches?video.dataset.srcMobile!:video.dataset.src!;video.play().catch((error:DOMException)=>{if(error.name==='AbortError')return;needsGesture=true;pause.textContent='Воспроизвести видео'})}else video.pause()}
 function reveal(){if(!document.documentElement.classList.contains('adult'))return;playback();const veil=document.querySelector<HTMLElement>('.horror-entry-veil');if(veil&&document.documentElement.classList.contains('horror-entering')){const a=veil.animate([{opacity:1},{opacity:0}],{duration:calm()?0:1100,fill:'forwards',easing:'ease-out'});a.finished.then(()=>{document.documentElement.classList.remove('horror-entering');veil.style.opacity='0';a.cancel()}).catch(()=>{})}}
 new IntersectionObserver(e=>{visible=e[0].isIntersecting;playback()},{threshold:.05}).observe(film);
 pause.addEventListener('click',()=>{if(needsGesture){needsGesture=false;manualPause=false;if(video.error)video.load()}else manualPause=!manualPause;pause.setAttribute('aria-pressed',String(manualPause));pause.textContent=manualPause?'Продолжить':'Пауза';playback()});
 film.addEventListener('pointermove',()=>{film.classList.add('is-awake');clearTimeout(awakeTimer);awakeTimer=setTimeout(()=>film.classList.remove('is-awake'),2500)});
 const passage=door.querySelector<HTMLVideoElement>('[data-passage-film]')!;
 const room=door.querySelector<HTMLElement>('[data-crt-room]')!;
 let passageFailed=false;
 const scrubber=createFrameScrubber(passage);
 passage.addEventListener('loadeddata',()=>{door.classList.add('passage-decoded');scrubber.seek()});
 passage.addEventListener('error',()=>{passageFailed=true;schedule()});
 function render(){
  frame=0;const r=door.getBoundingClientRect(),p=Math.max(0,Math.min(1,-r.top/Math.max(1,r.height-innerHeight)));
  const quiet=calm(),state=passageTimeline(p),ready=quiet||passageFailed||state.room;
  document.body.classList.toggle('past-corridor',scrollY>innerHeight*.75);
  const changed=door.classList.contains('room-open')!==ready;
  door.classList.toggle('room-open',ready);room.inert=!ready;
  door.dataset.passageProgress=p.toFixed(3);scrubber.setTime(state.time);
  const cover=Math.max(innerWidth,innerHeight*16/9),fit=Math.min(innerWidth,innerHeight*16/9);
  door.style.setProperty('--scene-width',`${cover+(fit-cover)*(quiet||passageFailed?1:state.fit)}px`);
  if(!quiet&&!passageFailed&&document.documentElement.classList.contains('adult')&&r.top<innerHeight*2&&r.bottom>0){
   if(!passage.getAttribute('src')){passage.preload='auto';passage.src=matchMedia('(max-width:760px)').matches?passage.dataset.srcMobile!:passage.dataset.src!}
   scrubber.seek();
  }
  if(changed)document.dispatchEvent(new CustomEvent('horror:room-state'));
 }
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(render)};
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);document.addEventListener('visibilitychange',playback);
 new MutationObserver(()=>{playback();schedule()}).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
 document.querySelector('#age-form')?.addEventListener('submit',()=>queueMicrotask(reveal));
 matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>{playback();schedule()});
 addEventListener('pagehide',()=>{clearTimeout(awakeTimer);video.pause();passage.pause();cancelAnimationFrame(frame)});
 addEventListener('pageshow',e=>{if(e.persisted){playback();render()}});
 reveal();render();
}
