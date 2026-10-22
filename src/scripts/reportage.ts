export function initReportage(){
 const root=document.querySelector<HTMLElement>('[data-photo-gallery]');if(!root||root.dataset.photoReady)return;
 root.dataset.photoReady='true';
 const cards=[...root.querySelectorAll<HTMLElement>('[data-photo-card]')],filters=[...root.querySelectorAll<HTMLButtonElement>('[data-photo-filter]')];
 const tv=root.querySelector<HTMLElement>('[data-photo-tv]')!,track=root.querySelector<HTMLElement>('[data-photo-track]')!,sharp=root.querySelector<HTMLButtonElement>('[data-photo-sharp]')!;
 const dialog=root.querySelector<HTMLDialogElement>('[data-photo-dialog]')!,image=root.querySelector<HTMLImageElement>('[data-photo-large]')!,caption=root.querySelector<HTMLElement>('[data-photo-caption]')!,position=root.querySelector<HTMLElement>('[data-photo-position]')!,questLink=root.querySelector<HTMLAnchorElement>('[data-photo-quest-link]')!,error=root.querySelector<HTMLElement>('[data-photo-error]')!;
 const count=root.querySelector<HTMLElement>('[data-photo-count]')!,screenPosition=root.querySelector<HTMLElement>('[data-photo-screen-position]')!,signal=root.querySelector<HTMLElement>('[data-photo-signal]')!,screenError=root.querySelector<HTMLElement>('[data-photo-screen-error]')!;
 let items=cards,current=cards[0],opener:HTMLAnchorElement|null=null,ignoreClickUntil=0;
 const linkFor=(card:HTMLElement)=>card.querySelector<HTMLAnchorElement>('[data-reportage-open]')!;
 function status(){
  const img=linkFor(current).querySelector<HTMLImageElement>('img')!;
  const failed=current.dataset.photoFailed==='true';
  track.setAttribute('aria-busy',String(!img.complete&&!failed));screenError.hidden=!failed;
  signal.textContent=failed?'НЕТ СИГНАЛА':img.complete?'ЗАПИСЬ':'ЗАГРУЗКА';
 }
 function pixelate(card:HTMLElement){
  const link=linkFor(card),img=link.querySelector<HTMLImageElement>('img')!,canvas=link.querySelector<HTMLCanvasElement>('canvas')!;
  if(img.naturalWidth){try{const context=canvas.getContext('2d');if(context){context.drawImage(img,0,0,canvas.width,canvas.height);link.classList.add('has-pixels');}}catch{/* При недоступном canvas остаётся исходная фотография. */}}
  if(card===current)status();
 }
 function renderDialog(){
  const link=linkFor(current),thumb=link.querySelector<HTMLImageElement>('img')!;
  error.hidden=true;image.alt=thumb.alt;image.src=link.href;caption.textContent=`${link.dataset.photoStory} — ${link.dataset.photoTitle}`;position.textContent=count.textContent;questLink.href=link.dataset.photoLink!;
 }
 function show(card:HTMLElement){
  const refocus=current!==card&&current.contains(document.activeElement)&&!dialog.open;
  current=card;cards.forEach(c=>c.hidden=c!==card);
  const n=items.indexOf(card)+1;count.textContent=`Кадр ${n} из ${items.length}`;screenPosition.textContent=`${String(n).padStart(2,'0')} / ${String(items.length).padStart(2,'0')}`;
  tv.style.setProperty('--channel-turn',`${(cards.indexOf(card)*36)-35}deg`);
  tv.classList.remove('is-clear');sharp.setAttribute('aria-pressed','false');sharp.innerHTML='<span aria-hidden="true">▧</span> Прояснить кадр';
  linkFor(card).querySelector<HTMLImageElement>('img')!.loading='eager';status();
  if(refocus)linkFor(card).focus({preventScroll:true});
  if(dialog.open)renderDialog();
 }
 function step(delta:number){if(!items.length)return;show(items[(items.indexOf(current)+delta+items.length)%items.length]);}
 cards.forEach(card=>{
  const link=linkFor(card),img=link.querySelector<HTMLImageElement>('img')!;
  img.addEventListener('load',()=>{delete card.dataset.photoFailed;pixelate(card);});
  img.addEventListener('error',()=>{card.dataset.photoFailed='true';if(card===current)status();});
  if(img.complete)pixelate(card);
  link.addEventListener('click',event=>{
   if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;
   event.preventDefault();if(performance.now()<ignoreClickUntil)return;
   opener=link;renderDialog();dialog.showModal();
  });
 });
 filters.forEach(button=>button.addEventListener('click',()=>{
  const filter=button.dataset.photoFilter;filters.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  items=cards.filter(card=>filter==='all'||card.dataset.photoQuest===filter);if(items.length)show(items[0]);
 }));
 root.querySelectorAll<HTMLButtonElement>('[data-photo-browse]').forEach(button=>{button.disabled=false;button.addEventListener('click',()=>step(Number(button.dataset.photoBrowse)));});
 sharp.disabled=false;sharp.addEventListener('click',()=>{
  const clear=tv.classList.toggle('is-clear');sharp.setAttribute('aria-pressed',String(clear));sharp.innerHTML=clear?'<span aria-hidden="true">▦</span> Вернуть пиксели':'<span aria-hidden="true">▧</span> Прояснить кадр';
 });
 tv.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();step(event.key==='ArrowRight'?1:-1);}});
 let touch:{x:number;y:number}|null=null;
 track.addEventListener('touchstart',event=>{touch=event.touches.length===1?{x:event.touches[0].clientX,y:event.touches[0].clientY}:null;},{passive:true});
 track.addEventListener('touchcancel',()=>touch=null,{passive:true});
 track.addEventListener('touchend',event=>{
  const end=event.changedTouches[0];if(!touch||!end){touch=null;return;}
  const dx=end.clientX-touch.x,dy=end.clientY-touch.y;touch=null;
  if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.4){ignoreClickUntil=performance.now()+500;step(dx<0?1:-1);}
 },{passive:true});
 root.querySelectorAll<HTMLButtonElement>('[data-photo-step]').forEach(button=>button.addEventListener('click',()=>step(Number(button.dataset.photoStep))));
 root.querySelector('[data-photo-close]')!.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
 dialog.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();step(event.key==='ArrowRight'?1:-1);}});
 dialog.addEventListener('close',()=>{(opener?.closest<HTMLElement>('[data-photo-card]')?.hidden?linkFor(current):opener)?.focus({preventScroll:true});});
 image.addEventListener('error',()=>error.hidden=false);
 show(current);
}
