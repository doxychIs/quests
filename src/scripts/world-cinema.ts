import {cinemaTimeline,createFrameScrubber} from '../lib/scroll-cinema';
import {bindSceneLoading} from './media-loading';

export function initWorldCinema(){
 document.querySelectorAll<HTMLElement>('[data-world-cinema]').forEach(scene=>{
  if(scene.dataset.ready)return;scene.dataset.ready='yes';
  const video=scene.querySelector<HTMLVideoElement>('[data-scroll-film]')!;
  const reveals=scene.querySelectorAll<HTMLElement>('[data-cinema-reveal]');
  const caption=scene.querySelector<HTMLElement>('[data-cinema-caption]')!;
  const percent=scene.querySelector<HTMLElement>('[data-cinema-percent]')!;
  const initialCaption=caption.textContent;
  const query=matchMedia('(prefers-reduced-motion: reduce)');
  const scrubber=createFrameScrubber(video);
  const loading=bindSceneLoading(video,scene);
  const viewport=scene.querySelector<HTMLElement>('[data-cinema-viewport]')!;
  const enlarge=scene.querySelector<HTMLButtonElement>('[data-cinema-enlarge]')!;
  const dialog=scene.querySelector<HTMLDialogElement>('[data-world-dialog]')!;
  const previews=[...dialog.querySelectorAll<HTMLElement>('[data-world-preview]')];
  const links=scene.querySelectorAll<HTMLElement>('[data-world-quest]');
  let frame=0,failed=false,suspended=false,inspecting=false,selected=0;
  let opener:HTMLElement|null=null;
  const close=()=>{if(dialog.open)dialog.close()};
  function select(index:number){
   selected=(index+previews.length)%previews.length;
   previews.forEach((p,i)=>p.hidden=i!==selected);
   dialog.setAttribute('aria-labelledby',`preview-${previews[selected].dataset.worldPreview}`);
   dialog.querySelector<HTMLElement>('[data-world-position]')!.textContent=`${selected+1} / ${previews.length}`;
  }
  links.forEach(link=>link.addEventListener('click',event=>{
   if(!scene.classList.contains('cinema-arrived'))return;
   event.preventDefault();opener=link;
   select(previews.findIndex(p=>p.dataset.worldPreview===link.dataset.worldQuest));
   if(!dialog.open)dialog.showModal();
  }));
  dialog.querySelector('[data-world-close]')!.addEventListener('click',close);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close()});
  dialog.addEventListener('close',()=>{opener?.focus({preventScroll:true});opener=null});
  dialog.addEventListener('click',event=>{
   if(event.target!==dialog)return;
   const r=dialog.getBoundingClientRect();
   if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();
  });
  dialog.querySelectorAll<HTMLElement>('[data-world-step]').forEach(b=>b.addEventListener('click',()=>select(selected+Number(b.dataset.worldStep))));
  enlarge.addEventListener('click',()=>{
   inspecting=!inspecting;scene.classList.toggle('cinema-inspect',inspecting);
   enlarge.setAttribute('aria-pressed',String(inspecting));
   enlarge.textContent=inspecting?'Вся сцена ⤡':'Рассмотреть ближе ⤢';
   render();
   if(inspecting){viewport.scrollLeft=Math.max(0,(viewport.scrollWidth-viewport.clientWidth)/2);viewport.scrollTop=Math.max(0,(viewport.scrollHeight-viewport.clientHeight)/2)}
  });
  function render(){
   frame=0;if(suspended||document.hidden)return;
   const rect=scene.getBoundingClientRect();
   const p=Math.max(0,Math.min(1,-rect.top/Math.max(1,rect.height-innerHeight)));
   const quiet=query.matches||document.documentElement.classList.contains('calm');
   const state=cinemaTimeline(p,Number(scene.dataset.cinemaEnd),Number(scene.dataset.cinemaFps));
   scene.classList.toggle('cinema-quiet',quiet);
   video.hidden=quiet||failed;
   scene.classList.toggle('cinema-failed',failed);
   const arrived=quiet||failed||state.room;
   scene.classList.toggle('cinema-arrived',arrived);
   if(!arrived){close();inspecting=false;scene.classList.remove('cinema-inspect');enlarge.setAttribute('aria-pressed','false');enlarge.textContent='Рассмотреть ближе ⤢'}
   // Тот же переход cover → fit, что в «Изнанке». Чёрные поля исходника
   // АРХИВА выходят за границу экрана только во время движения камеры.
   const cover=Math.max(innerWidth,innerHeight*(scene.dataset.cinemaWorld==='arhiv'?1280/586:16/9));
   const fit=Math.min(innerWidth,innerHeight*16/9);
   scene.style.setProperty('--scene-width',`${inspecting?Math.max(innerWidth,innerHeight*16/9)*1.25:cover+(fit-cover)*(quiet||failed?1:state.fit)}px`);
   scene.style.setProperty('--cinema-progress',String(quiet||failed?1:p));
   scene.dataset.cinemaProgress=p.toFixed(3);
   percent.textContent=`${Math.round((quiet||failed?1:p)*100)}%`;
   reveals.forEach(reveal=>reveal.inert=!arrived);
   caption.textContent=arrived?(scene.dataset.cinemaWorld==='arhiv'?'Нажмите на картину — её история откроется здесь.':'Нажмите на светящийся сигнал — выберите приключение.'):initialCaption;
   if(!quiet&&!failed&&rect.top<innerHeight*2&&rect.bottom>0){
    loading.start();
    scrubber.setTime(state.time);
   }
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(render)};
  video.addEventListener('loadeddata',()=>{scene.classList.add('cinema-decoded');schedule()});
  video.addEventListener('video:state',()=>{const next=loading.state.phase==='error';if(next!==failed){failed=next;schedule()}if(loading.state.phase==='loading')scene.classList.remove('cinema-decoded')});
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);
  new IntersectionObserver(schedule,{rootMargin:'100% 0px'}).observe(scene);
  query.addEventListener('change',schedule);
  new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',schedule);
  addEventListener('pagehide',()=>{suspended=true;close();video.pause();cancelAnimationFrame(frame);frame=0});
  addEventListener('pageshow',()=>{suspended=false;render()});
  render();
 });
}
