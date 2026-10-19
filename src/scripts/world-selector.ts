import {prepareVideo} from '../lib/video-loading';
export function initWorldSelector(){
 const root=document.querySelector<HTMLElement>('[data-world-selector]');if(!root)return;
 const links=[...root.querySelectorAll<HTMLAnchorElement>('[data-world-zone]')];
 const film=root.querySelector<HTMLVideoElement>('[data-hub-film]');
 let visible=false;
 function select(world:string){
  root!.dataset.activeWorld=world;
  root!.querySelectorAll<HTMLElement>('[data-scene]').forEach(s=>s.classList.toggle('is-current',s.dataset.scene===world));
  links.forEach(link=>link.classList.toggle('is-current',link.dataset.worldZone===world));
  const caption=root!.querySelector<HTMLElement>('[data-selector-caption]'),selected=links.find(link=>link.dataset.worldZone===world);if(caption&&selected?.dataset.worldCaption)caption.textContent=selected.dataset.worldCaption;
  if(!film)return;
  if(visible&&!document.hidden&&world==='ostrov'&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&!document.documentElement.classList.contains('calm')){
   prepareVideo(film).start();film.play().catch(()=>{});
  }else film.pause();
 }
 links.forEach(link=>{link.addEventListener('pointerenter',()=>select(link.dataset.worldZone!));link.addEventListener('focus',()=>select(link.dataset.worldZone!));link.addEventListener('pointerdown',()=>select(link.dataset.worldZone!));});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)film?.pause();else select(root!.dataset.activeWorld!)});
 new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting);select(root!.dataset.activeWorld||'arhiv')},{threshold:0}).observe(root);
 new MutationObserver(()=>select(root!.dataset.activeWorld||'arhiv')).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
 matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>select(root!.dataset.activeWorld||'arhiv'));
 addEventListener('pagehide',()=>film?.pause());select('arhiv');
}
