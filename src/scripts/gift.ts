import {giftNames,invitationSVG} from '../lib/gift-invitation';
import {soundCue} from './sound-cues';
export function initGift(){
 const form=document.querySelector<HTMLFormElement>('#gift-form');if(!form)return;
 const select=form.querySelector<HTMLSelectElement>('[name=world]')!;
 const card=document.querySelector<HTMLElement>('.hub-invite-card');
 let imprint:Animation|undefined;
 const initial=new URLSearchParams(location.search).get('world');if(initial&&giftNames[initial])select.value=initial;
 function values(){const fd=new FormData(form!);return {to:String(fd.get('recipient')||'вас').trim().slice(0,30)||'вас',message:String(fd.get('message')||'Пусть этот день станет приключением.').slice(0,120),world:String(fd.get('world'))}}
 function refresh(){
  const v=values();document.querySelector('[data-recipient]')!.textContent=v.to;
  card?.classList.toggle('is-personal',v.to!=='вас');card?.classList.remove('is-stamped');
  document.querySelector('[data-gift-world]')!.textContent=giftNames[v.world]||giftNames.all;
  document.querySelector('[data-gift-message]')!.textContent=v.message;
  document.querySelector<HTMLElement>('[data-certificate]')!.dataset.theme=v.world;
  const title=document.querySelector<HTMLElement>('[data-gift-title],.certificate-frame h2')!;title.style.fontSize=v.to.length>23?'31px':v.to.length>15?'38px':'';
 }
 form.addEventListener('input',refresh);form.addEventListener('change',refresh);refresh();
 form.querySelector('[name=recipient]')?.addEventListener('change',()=>{
  if(matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.classList.contains('calm'))return;
  imprint?.cancel();imprint=document.querySelector<HTMLElement>('[data-recipient]')?.animate([{filter:'blur(.6px)',opacity:.6},{filter:'blur(0)',opacity:1}],{duration:350,easing:'ease-out'});
 });
 form.addEventListener('submit',event=>{
  event.preventDefault();
  card?.classList.remove('is-stamped');if(card){void card.offsetWidth;card.classList.add('is-stamped')}
  const url=URL.createObjectURL(new Blob([invitationSVG(values())],{type:'image/svg+xml;charset=utf-8'})),link=document.createElement('a');
  link.href=url;link.download='GRAN-priglashenie.svg';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  document.querySelector('#gift-status')!.textContent='Приглашение сохранено. Его можно открыть в браузере и распечатать.';
  soundCue('complete');
 });
}
