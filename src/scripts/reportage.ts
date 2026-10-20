export function initReportage(){
 const root=document.querySelector<HTMLElement>('[data-photo-gallery]');if(!root)return;
 const cards=[...root.querySelectorAll<HTMLElement>('[data-photo-card]')],filters=[...root.querySelectorAll<HTMLButtonElement>('[data-photo-filter]')];
 const dialog=root.querySelector<HTMLDialogElement>('[data-photo-dialog]')!,image=root.querySelector<HTMLImageElement>('[data-photo-large]')!,caption=root.querySelector<HTMLElement>('[data-photo-caption]')!,position=root.querySelector<HTMLElement>('[data-photo-position]')!,questLink=root.querySelector<HTMLAnchorElement>('[data-photo-quest-link]')!,error=root.querySelector<HTMLElement>('[data-photo-error]')!;
 let current:HTMLElement|null=null,opener:HTMLAnchorElement|null=null;
 const visible=()=>cards.filter(card=>!card.hidden);
 function show(card:HTMLElement){
  current=card;const link=card.querySelector<HTMLAnchorElement>('[data-reportage-open]')!,thumb=link.querySelector<HTMLImageElement>('img')!,items=visible();
  error.hidden=true;image.alt=thumb.alt;image.src=link.href;caption.textContent=`${link.dataset.photoStory} — ${link.dataset.photoTitle}`;position.textContent=`Кадр ${items.indexOf(card)+1} из ${items.length}`;questLink.href=link.dataset.photoLink!;
 }
 function step(delta:number){const items=visible();if(!current||!items.length)return;show(items[(items.indexOf(current)+delta+items.length)%items.length]);}
 filters.forEach(button=>button.addEventListener('click',()=>{const filter=button.dataset.photoFilter;filters.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));cards.forEach(card=>card.hidden=filter!=='all'&&card.dataset.photoQuest!==filter);root.querySelector('[data-photo-count]')!.textContent=`Показано кадров: ${visible().length}`;}));
 cards.forEach(card=>{const link=card.querySelector<HTMLAnchorElement>('[data-reportage-open]')!;link.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();opener=link;show(card);dialog.showModal();});});
 root.querySelectorAll<HTMLButtonElement>('[data-photo-step]').forEach(button=>button.addEventListener('click',()=>step(Number(button.dataset.photoStep))));
 root.querySelector('[data-photo-close]')!.addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
 dialog.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();step(event.key==='ArrowRight'?1:-1);}});
 dialog.addEventListener('close',()=>opener?.focus({preventScroll:true}));
 image.addEventListener('error',()=>error.hidden=false);
}
