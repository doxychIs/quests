import {hiddenObjects} from '../lib/hidden-objects';
import {soundCue} from './sound-cues';

export function initHiddenObjects(root:HTMLElement){
 if(root.dataset.ready)return;root.dataset.ready='yes';
 const view=root.querySelector<HTMLElement>('[data-object-viewport]')!;
 const picture=root.querySelector<HTMLElement>('[data-object-picture]')!;
 const regions=[...root.querySelectorAll<SVGElement>('[data-find-object]')];
 const label=root.querySelector<HTMLElement>('[data-object-name]')!;
 const prompt=root.querySelector<HTMLElement>('[data-object-prompt]')!;
 const count=root.querySelector<HTMLElement>('[data-object-count]')!;
 const status=root.querySelector<HTMLElement>('[data-object-status]')!;
 const finish=root.querySelector<HTMLElement>('[data-object-finish]')!;
 const zoomButton=root.querySelector<HTMLButtonElement>('[data-object-zoom]')!;
 const hintButton=root.querySelector<HTMLButtonElement>('[data-object-hint]')!;
 let current=0,zoom=false;
 const setZoom=(on:boolean)=>{
  zoom=on;picture.classList.toggle('is-enlarged',on);root.classList.toggle('is-zoomed',on);
  zoomButton.setAttribute('aria-pressed',String(on));
  zoomButton.textContent=on?'Вся картинка ⤡':'Увеличить ⤢';
 };
 function render(){
  const done=current===hiddenObjects.length;
  prompt.textContent=done?'Расследование завершено':'Найдите на картинке';
  label.textContent=done?'Все восемь предметов найдены':hiddenObjects[current].name;
  count.textContent=done?'8 / 8':`${current+1} / ${hiddenObjects.length}`;
  finish.hidden=!done;hintButton.disabled=done;
  root.dataset.finished=done?'yes':'no';
 }
 function choose(region:SVGElement|null){
  if(current===hiddenObjects.length)return;
  if(region?.dataset.findObject===hiddenObjects[current].id){
   region.classList.remove('is-hinted');region.classList.add('is-found');
   region.setAttribute('aria-disabled','true');region.setAttribute('tabindex','-1');
   status.textContent=`Найдено: ${hiddenObjects[current].name.toLowerCase()}.`;
   current++;render();soundCue(current===hiddenObjects.length?'complete':'found');
  }else status.textContent='Пока не то. Присмотритесь к деталям — спешить некуда.';
 }
 picture.addEventListener('click',event=>{
  const target=event.target instanceof Element?event.target.closest<SVGElement>('[data-find-object]'):null;
  choose(target);
 });
 regions.forEach(region=>region.addEventListener('keydown',event=>{
  if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(region)}
 }));
 zoomButton.addEventListener('click',()=>{
  setZoom(!zoom);if(!zoom)view.scrollTo({top:0,left:0});
 });
 hintButton.addEventListener('click',()=>{
  if(current===hiddenObjects.length)return;
  const region=regions[current];region.classList.add('is-hinted');
  status.textContent='Нужный предмет обведён тонкой линией. Нажмите на него.';
  if(zoom)region.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
 });
 root.querySelector('[data-object-reset]')!.addEventListener('click',()=>{
  current=0;regions.forEach(region=>{
   region.classList.remove('is-found','is-hinted');region.setAttribute('aria-disabled','false');region.setAttribute('tabindex','0');
  });status.textContent='';setZoom(false);view.scrollTo({top:0,left:0});render();
 });
 render();
}
