import {soundCue} from './sound-cues';

/** Controls live in the projected television glass; nothing enters the top layer. */
export function initRoomTelevisionContent(scope:ParentNode=document){
 scope.querySelectorAll<HTMLElement>('[data-room-tv-content]').forEach(root=>{
  if(root.dataset.roomContentReady)return;root.dataset.roomContentReady='true';
  const surfaces=[...root.querySelectorAll<HTMLElement>('[data-room-surface]')];
  let activeId='';
  const adult=()=>document.documentElement.classList.contains('adult');
  function hydrate(surface:HTMLElement,all=false){
   if(!adult())return;
   surface.querySelectorAll<HTMLImageElement>('img[data-room-src]').forEach(image=>{
    if(image.getAttribute('src')||!all&&image.closest('[data-room-pane][hidden],[data-room-photo][hidden]'))return;
    image.loading=all?'lazy':'eager';image.src=image.dataset.roomSrc!;
   });
  }
  function activateImages(){
   if(activeId==='all')surfaces.forEach(surface=>hydrate(surface,true));
   else{const surface=surfaces.find(surface=>surface.dataset.roomSurface===activeId);if(surface)hydrate(surface);}
  }
  document.addEventListener('room:surface-active',event=>{activeId=(event as CustomEvent<{id:string}>).detail?.id||'';activateImages();});
  new MutationObserver(activateImages).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
  for(const surface of surfaces){
   const id=surface.dataset.roomSurface!;
   surface.querySelector('[data-room-leave]')?.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('room:leave',{detail:{id}})));
   const tabs=[...surface.querySelectorAll<HTMLButtonElement>('[data-room-tab]')];
   surface.querySelectorAll<HTMLElement>('.room-screen-scroll').forEach(scroller=>scroller.addEventListener('wheel',event=>{
    if(event.ctrlKey)return;
    const canScroll=event.deltaY>0?scroller.scrollTop+scroller.clientHeight<scroller.scrollHeight-2:scroller.scrollTop>1;
    if(canScroll)event.stopPropagation();
   },{passive:true}));
   tabs.forEach(button=>button.addEventListener('click',()=>{
    tabs.forEach(tab=>tab.setAttribute('aria-pressed',String(tab===button)));
    surface.querySelectorAll<HTMLElement>('[data-room-pane]').forEach(pane=>pane.hidden=pane.dataset.roomPane!==button.dataset.roomTab);
    if(activeId===id||activeId==='all')hydrate(surface,activeId==='all');
    surface.querySelector<HTMLElement>('.room-screen-scroll')?.scrollTo({top:0});
    soundCue('tuner');
   }));
   surface.querySelector('[data-room-readability]')?.addEventListener('click',event=>{
    const button=event.currentTarget as HTMLButtonElement,large=surface.classList.toggle('room-readable');
    button.setAttribute('aria-pressed',String(large));button.textContent=large?'Обычный текст':'Крупнее текст';
   });
   surface.querySelectorAll<HTMLButtonElement>('[data-room-navigate]').forEach(button=>button.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('room:navigate',{detail:{id:button.dataset.roomNavigate}}))));
   let frameOpener:HTMLButtonElement|undefined;
   const viewer=surface.querySelector<HTMLElement>('[data-room-inline-viewer]'),large=surface.querySelector<HTMLImageElement>('[data-room-frame-large]');
   const closeFrame=()=>{if(!viewer)return;viewer.hidden=true;frameOpener?.focus({preventScroll:true});};
   surface.querySelectorAll<HTMLButtonElement>('[data-room-frame-open]').forEach(button=>button.addEventListener('click',()=>{
    if(!viewer||!large||!adult())return;frameOpener=button;large.src=button.dataset.roomFrameSrc!;large.alt=button.dataset.roomFrameAlt!;viewer.hidden=false;viewer.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});
   }));
   surface.querySelector('[data-room-frame-close]')?.addEventListener('click',closeFrame);
   surface.addEventListener('keydown',event=>{if(event.key==='Escape'&&viewer&&!viewer.hidden){event.preventDefault();event.stopPropagation();closeFrame();}});
  }
  // Preserve the Maze's actual 1000:460 playfield rather than squeezing its
  // pixels into the space left by controls. Pointer coordinates stay accurate.
  const gameGlass=root.querySelector<HTMLElement>('.room-game .maze-tv-screen'),gameCanvas=gameGlass?.querySelector<HTMLCanvasElement>('canvas');
  if(gameGlass&&gameCanvas&&typeof ResizeObserver!=='undefined'){
   const fit=()=>{const width=gameGlass.clientWidth,height=gameGlass.clientHeight-(gameGlass.querySelector<HTMLElement>('.game-toolbar')?.offsetHeight||0);if(width<1||height<1)return;const fitted=Math.min(width,height*1000/460);gameCanvas.style.setProperty('--room-maze-width',`${fitted.toFixed(2)}px`);gameCanvas.style.setProperty('--room-maze-height',`${(fitted*460/1000).toFixed(2)}px`);};
   new ResizeObserver(fit).observe(gameGlass);fit();
  }
  const gallery=surfaces.find(surface=>surface.dataset.roomSurface==='gallery');
  if(!gallery)return;
  let projectorOn=false;
  const powerButtons=[...document.querySelectorAll<HTMLButtonElement>('[data-room-projector-power]')];
  function power(on:boolean){
   if(!adult())return;projectorOn=on;gallery!.dataset.roomProjectorOn=String(on);
   powerButtons.forEach(button=>{button.setAttribute('aria-pressed',String(on));button.textContent=on?'Выключить проектор':'Включить проектор';});
   document.dispatchEvent(new CustomEvent('room:projector-power',{detail:{on}}));soundCue('channel');
  }
  powerButtons.forEach(button=>button.addEventListener('click',()=>power(!projectorOn)));
  document.addEventListener('room:projector-toggle',()=>power(!projectorOn));
  const cards=[...gallery.querySelectorAll<HTMLElement>('[data-room-photo]')],filters=[...gallery.querySelectorAll<HTMLButtonElement>('[data-room-photo-filter]')],track=gallery.querySelector<HTMLElement>('[data-room-photo-track]')!,count=gallery.querySelector<HTMLElement>('[data-room-photo-position]')!,error=gallery.querySelector<HTMLElement>('[data-room-photo-error]')!,clear=gallery.querySelector<HTMLButtonElement>('[data-room-photo-clear]')!,tuner=gallery.querySelector<HTMLButtonElement>('[data-room-photo-tuner]')!;
  const original=document.querySelector<HTMLDialogElement>('[data-room-original-viewer]'),originalImage=original?.querySelector<HTMLImageElement>('[data-room-original-image]'),originalCaption=original?.querySelector<HTMLElement>('[data-room-original-caption]'),originalLink=original?.querySelector<HTMLAnchorElement>('[data-room-original-link]');
  let originalOpener:HTMLElement|undefined;
  let originalOverflow='';
  document.querySelectorAll<HTMLButtonElement>('[data-room-broadcast-zoom]').forEach(button=>button.addEventListener('click',()=>{
   if(!original||!originalImage||!adult())return;
   originalOpener=button;originalImage.src=button.dataset.roomFrameSrc!;originalImage.alt=button.dataset.roomFrameAlt||'Кадр квеста';
   const title=original.querySelector('#room-original-title');if(title)title.textContent='Кадр квеста';
   if(originalCaption)originalCaption.textContent=originalImage.alt;if(originalLink)originalLink.href=originalImage.src;
   if(!original.open){originalOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';original.showModal();}
   document.dispatchEvent(new CustomEvent('room:original-viewer',{detail:{open:true}}));
  }));
  let items=cards,current=cards[0],angle=0,ignoreClickUntil=0;
  function status(){const img=current.querySelector<HTMLImageElement>('img')!;error.hidden=current.dataset.failed!=='true';track.setAttribute('aria-busy',String(!img.complete&&current.dataset.failed!=='true'));}
  function show(card:HTMLElement){
   const refocus=current!==card&&current.contains(document.activeElement);
   current=card;cards.forEach(item=>item.hidden=item!==card);const n=items.indexOf(card)+1;count.textContent=`Кадр ${n} из ${items.length}`;
   document.querySelectorAll('[data-room-film-position]').forEach(label=>label.textContent=`${n} / ${items.length}`);
   const photo=card.querySelector<HTMLImageElement>('img')!;document.dispatchEvent(new CustomEvent('room:projection-frame',{detail:{src:photo.dataset.roomSrc||photo.src}}));
   gallery!.classList.remove('room-gallery-clear');clear.setAttribute('aria-pressed','false');clear.textContent='Чётче';clear.setAttribute('aria-label','Прояснить кадр');
   if(activeId==='gallery'||activeId==='all')hydrate(gallery!,activeId==='all');tuner.style.setProperty('--room-tuner-angle',`${angle}deg`);status();
   if(refocus)card.querySelector<HTMLButtonElement>('[data-room-photo-zoom]')?.focus({preventScroll:true});
  }
  function step(delta:number){if(!items.length)return;angle+=delta*35;show(items[(items.indexOf(current)+delta+items.length)%items.length]);soundCue('tuner');}
  function zoom(force?:boolean){
   if(!original||!originalImage||!adult())return;
   const open=typeof force==='boolean'?force:!original.open;
   if(!open){if(original.open)original.close();return;}
   const photo=current.querySelector<HTMLImageElement>('img')!;originalOpener=current.querySelector<HTMLButtonElement>('[data-room-photo-zoom]')!;
   const title=original.querySelector('#room-original-title');if(title)title.textContent='Кадр галереи';
   originalImage.src=photo.dataset.roomSrc||photo.src;originalImage.alt=photo.alt;if(originalCaption)originalCaption.textContent=photo.alt;if(originalLink)originalLink.href=originalImage.src;
   gallery!.classList.add('room-gallery-expanded');originalOpener.setAttribute('aria-expanded','true');if(!original.open){originalOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden';}original.showModal();document.dispatchEvent(new CustomEvent('room:original-viewer',{detail:{open:true}}));
  }
  original?.addEventListener('close',()=>{document.documentElement.style.overflow=originalOverflow;gallery.classList.remove('room-gallery-expanded');cards.forEach(card=>card.querySelector('[data-room-photo-zoom]')?.setAttribute('aria-expanded','false'));document.dispatchEvent(new CustomEvent('room:original-viewer',{detail:{open:false}}));originalOpener?.focus({preventScroll:true});});
  original?.addEventListener('click',event=>{if(event.target===original)original.close();});
  original?.addEventListener('keydown',event=>{if(event.key==='Escape')event.stopPropagation();});
  cards.forEach(card=>{
   const img=card.querySelector<HTMLImageElement>('img')!;img.addEventListener('error',()=>{card.dataset.failed='true';if(card===current)status();});img.addEventListener('load',()=>{delete card.dataset.failed;if(card===current)status();});
   card.querySelector('[data-room-photo-zoom]')?.addEventListener('click',()=>{if(performance.now()>=ignoreClickUntil)zoom();});
  });
  gallery.querySelectorAll<HTMLButtonElement>('[data-room-photo-step]').forEach(button=>button.addEventListener('click',()=>step(Number(button.dataset.roomPhotoStep))));
  document.querySelectorAll<HTMLButtonElement>('[data-room-film-step]').forEach(button=>button.addEventListener('click',()=>step(Number(button.dataset.roomFilmStep))));
  filters.forEach(button=>button.addEventListener('click',()=>{filters.forEach(item=>item.setAttribute('aria-pressed',String(item===button)));items=cards.filter(card=>button.dataset.roomPhotoFilter==='all'||card.dataset.roomPhoto===button.dataset.roomPhotoFilter);if(items.length)show(items[0]);}));
  clear.addEventListener('click',()=>{const active=gallery.classList.toggle('room-gallery-clear');clear.setAttribute('aria-pressed',String(active));clear.textContent=active?'Фактура':'Чётче';clear.setAttribute('aria-label',active?'Вернуть фактуру':'Прояснить кадр');});
  tuner.addEventListener('click',()=>step(1));
  let wheel=0,at=0,locked=0,direction=0;
  tuner.addEventListener('wheel',event=>{
   if(event.ctrlKey||!event.deltaY||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;event.preventDefault();event.stopPropagation();const now=performance.now();if(now<locked)return;
   const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1),next=Math.sign(delta);if(now-at>250||next!==direction)wheel=0;direction=next;at=now;wheel+=delta;
   if(Math.abs(wheel)>=40){step(next);wheel=0;locked=now+160;}
  },{passive:false});
  // Wheel packets advance physical film frames, not the camera. At either end
  // a fresh outward gesture releases normal page scroll, so the room has no trap.
  let filmWheel=0,filmAt=0,filmLocked=0,filmDirection=0;
  document.addEventListener('wheel',event=>{
   if(!projectorOn||activeId!=='gallery'||!adult()||document.hidden||original?.open||event.defaultPrevented||event.ctrlKey||!event.deltaY||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
   if(event.target instanceof Element&&event.target.closest('.room-utility,.room-site-header,.room-projector-switch,.room-film-controls,dialog'))return;
   const now=performance.now(),delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1),direction=Math.sign(delta),fresh=now-filmAt>240||direction!==filmDirection;
   if(fresh)filmWheel=0;
   filmDirection=direction;filmAt=now;
   const index=items.indexOf(current),edge=direction<0?index===0:index===items.length-1;
   if(edge&&fresh&&now>=filmLocked)return;
   event.preventDefault();
   if(edge)return;
   if(now<filmLocked)return;
   filmWheel+=delta;if(Math.abs(filmWheel)>=55){step(direction);filmWheel=0;filmLocked=now+420;}
  },{passive:false});
  gallery.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();step(event.key==='ArrowRight'?1:-1);}else if(event.key==='Escape'&&gallery.classList.contains('room-gallery-expanded')){event.preventDefault();event.stopPropagation();zoom(false);}});
  let touch:{x:number;y:number}|undefined;
  track.addEventListener('touchstart',event=>{touch=event.touches.length===1?{x:event.touches[0].clientX,y:event.touches[0].clientY}:undefined;},{passive:true});
  track.addEventListener('touchcancel',()=>touch=undefined,{passive:true});
  track.addEventListener('touchmove',event=>{if(!touch||!projectorOn||activeId!=='gallery'||event.touches.length!==1)return;const dy=event.touches[0].clientY-touch.y,index=items.indexOf(current);if(Math.abs(dy)>10&&(dy<0?index<items.length-1:index>0))event.preventDefault();},{passive:false});
  track.addEventListener('touchend',event=>{const end=event.changedTouches[0];if(!touch||!end){touch=undefined;return;}const dx=end.clientX-touch.x,dy=end.clientY-touch.y;touch=undefined;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.4){ignoreClickUntil=performance.now()+500;step(dx<0?1:-1);}else if(projectorOn&&activeId==='gallery'&&Math.abs(dy)>45){const direction=dy<0?1:-1,index=items.indexOf(current);if(direction>0?index<items.length-1:index>0){ignoreClickUntil=performance.now()+500;step(direction);}}},{passive:true});
  document.addEventListener('room:surface-active',event=>{const active=(event as CustomEvent<{id:string}>).detail?.id;if(active!=='gallery')zoom(false);});
  show(current);
 });
}
