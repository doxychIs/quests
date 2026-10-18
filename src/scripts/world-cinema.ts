import {cinemaTimeline,createFrameScrubber} from '../lib/scroll-cinema';

export function initWorldCinema(){
 document.querySelectorAll<HTMLElement>('[data-world-cinema]').forEach(scene=>{
  if(scene.dataset.ready)return;scene.dataset.ready='yes';
  const video=scene.querySelector<HTMLVideoElement>('[data-scroll-film]')!;
  const reveal=scene.querySelector<HTMLElement>('[data-cinema-reveal]')!;
  const error=scene.querySelector<HTMLElement>('.cinema-error')!;
  const caption=scene.querySelector<HTMLElement>('[data-cinema-caption]')!;
  const percent=scene.querySelector<HTMLElement>('[data-cinema-percent]')!;
  const initialCaption=caption.textContent;
  const query=matchMedia('(prefers-reduced-motion: reduce)');
  const scrubber=createFrameScrubber(video);
  let frame=0,failed=false,suspended=false;
  function render(){
   frame=0;if(suspended||document.hidden)return;
   const rect=scene.getBoundingClientRect();
   const p=Math.max(0,Math.min(1,-rect.top/Math.max(1,rect.height-innerHeight)));
   const quiet=query.matches||document.documentElement.classList.contains('calm');
   const state=cinemaTimeline(p,Number(scene.dataset.cinemaEnd),Number(scene.dataset.cinemaFps));
   scene.classList.toggle('cinema-quiet',quiet);
   video.hidden=quiet||failed;
   scene.classList.toggle('cinema-failed',failed);
   scene.classList.toggle('cinema-arrived',quiet||failed||state.room);
   scene.style.setProperty('--cinema-progress',String(quiet||failed?1:p));
   scene.dataset.cinemaProgress=p.toFixed(3);
   percent.textContent=`${Math.round((quiet||failed?1:p)*100)}%`;
   reveal.inert=!(quiet||failed||state.room);
   error.hidden=!failed;
   caption.textContent=quiet?'Сцена без движения. Выберите историю или продолжайте вниз.':state.room?'Выберите свою историю или продолжайте вниз.':initialCaption;
   if(!quiet&&!failed&&rect.top<innerHeight*2&&rect.bottom>0){
    if(!video.getAttribute('src')){video.preload='auto';video.src=matchMedia('(max-width:760px)').matches?video.dataset.srcMobile!:video.dataset.src!}
    scrubber.setTime(state.time);
   }
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(render)};
  video.addEventListener('loadeddata',()=>{scene.classList.add('cinema-decoded');schedule()});
  video.addEventListener('error',()=>{failed=true;schedule()});
  scene.querySelector('[data-cinema-retry]')?.addEventListener('click',()=>{failed=false;scene.classList.remove('cinema-decoded');video.load();render()});
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);
  new IntersectionObserver(schedule,{rootMargin:'100% 0px'}).observe(scene);
  query.addEventListener('change',schedule);
  new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',schedule);
  addEventListener('pagehide',()=>{suspended=true;video.pause();cancelAnimationFrame(frame);frame=0});
  addEventListener('pageshow',()=>{suspended=false;render()});
  render();
 });
}
