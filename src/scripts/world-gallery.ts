import {soundCue} from './sound-cues';
export function initWorldGalleries(){
 document.querySelectorAll<HTMLElement>('[data-world-gallery]').forEach(root=>{
  if(root.dataset.ready)return;root.dataset.ready='yes';
  const slides=[...root.querySelectorAll<HTMLElement>('[data-gallery-slide]')],picks=[...root.querySelectorAll<HTMLButtonElement>('[data-gallery-pick]')];
  let index=0,startX=0,startY=0,suppressClickUntil=0;
  function select(next:number){index=(next+slides.length)%slides.length;slides.forEach((s,i)=>s.hidden=i!==index);picks.forEach((p,i)=>p.setAttribute('aria-pressed',String(i===index)));root.querySelector('[data-gallery-count]')!.textContent=`${index+1} / ${slides.length}`;soundCue('select')}
  picks.forEach((p,i)=>p.addEventListener('click',()=>select(i)));
  root.querySelectorAll<HTMLElement>('[data-gallery-step]').forEach(b=>b.addEventListener('click',()=>select(index+Number(b.dataset.galleryStep))));
  root.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();select(index+(e.key==='ArrowRight'?1:-1))}});
  root.addEventListener('pointerdown',e=>{startX=e.clientX;startY=e.clientY},{passive:true});
  root.addEventListener('pointerup',e=>{const dx=e.clientX-startX,dy=e.clientY-startY;if(e.pointerType==='touch'&&Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.6){suppressClickUntil=performance.now()+400;select(index+(dx<0?1:-1))}},{passive:true});
  root.addEventListener('click',e=>{if(performance.now()<suppressClickUntil){e.preventDefault();e.stopPropagation()}},{capture:true});
 });
}
