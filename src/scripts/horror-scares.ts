let closeScare:(()=>void)|null=null;
const calm=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.classList.contains('calm');
function allowed(){try{return document.documentElement.classList.contains('adult')&&sessionStorage.getItem('gran-surprise')==='yes'&&!calm()&&!document.hidden}catch{return false}}
// Only a completed maze may open the transmission, inside its own TV screen.
export function playHorrorScare(game:HTMLElement){
 const scene=game.querySelector<HTMLElement>('[data-horror-scare]');
 if(game.dataset.game!=='maze'||game.dataset.finished!=='yes'||!scene||!scene.hidden||!allowed())return false;
 initHorrorScares();
 const video=scene.querySelector<HTMLVideoElement>('video')!;
 if(!video.getAttribute('src'))video.src=video.dataset.src!;
 try{video.currentTime=0}catch{}
 scene.hidden=false;scene.focus({preventScroll:true});
 scene.scrollIntoView({block:'center',behavior:'instant'});
 video.muted=document.querySelector('.sound-toggle')?.getAttribute('aria-pressed')!=='true';
 const loading=setTimeout(()=>{if(video.readyState<2)closeScare?.()},12000);
 video.play().then(()=>{clearTimeout(loading);if(!scene.hidden)scene.scrollIntoView({block:'center',behavior:'instant'})}).catch(()=>{clearTimeout(loading);closeScare?.()});
 return true;
}
export function initHorrorScares(){
 const scene=document.querySelector<HTMLElement>('[data-horror-scare]');
 if(!scene||scene.dataset.ready)return;scene.dataset.ready='yes';
 const video=scene.querySelector<HTMLVideoElement>('video')!,game=scene.closest<HTMLElement>('[data-game=maze]')!;
 closeScare=()=>{const active=!scene.hidden;video.pause();video.muted=true;scene.hidden=true;if(active)game.querySelector<HTMLElement>('.game-result:not([hidden])')?.focus({preventScroll:true})};
 scene.querySelector('[data-scare-close]')?.addEventListener('click',()=>closeScare?.());
 video.addEventListener('ended',()=>closeScare?.());video.addEventListener('error',()=>closeScare?.());
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!scene.hidden){e.preventDefault();closeScare?.()}});
 game.querySelector('[data-restart]')?.addEventListener('click',()=>closeScare?.());
 game.querySelector('[data-replay]')?.addEventListener('click',()=>closeScare?.());
 game.querySelector('[data-start]')?.addEventListener('click',()=>closeScare?.());
 const preferences=()=>{if(!allowed())closeScare?.()};
 document.querySelector('#surprise-setting')?.addEventListener('change',()=>queueMicrotask(preferences));
 new MutationObserver(preferences).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)closeScare?.()});
 new IntersectionObserver(entries=>{if(!entries.some(e=>e.isIntersecting))closeScare?.()}).observe(game);
 new IntersectionObserver(entries=>{if(!entries.some(e=>e.isIntersecting))closeScare?.()}).observe(scene);
 const toggle=document.querySelector<HTMLElement>('.sound-toggle');
 const volume=()=>{video.muted=toggle?.getAttribute('aria-pressed')!=='true';video.volume=Math.max(0,Math.min(.5,Number(toggle?.dataset.audioVolume??.35)))};
 volume();if(toggle)new MutationObserver(volume).observe(toggle,{attributes:true,attributeFilter:['aria-pressed','data-audio-volume']});
 addEventListener('pagehide',()=>closeScare?.());
}
