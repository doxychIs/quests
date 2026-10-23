import {hiddenObjects,archiveScenes} from '../lib/hidden-objects';
import {shuffled,sceneBag} from '../lib/expedition';
import {soundCue} from './sound-cues';
export function initHiddenObjects(root:HTMLElement){
 if(root.dataset.ready)return;root.dataset.ready='yes';
 const $=<T extends HTMLElement=HTMLElement>(s:string)=>root.querySelector<T>(s)!;
 const view=$('[data-object-viewport]'),picture=$('[data-object-picture]'),image=$<HTMLImageElement>('[data-object-image]');
 const regions=[...root.querySelectorAll<SVGElement>('[data-find-object]')];
 const label=$('[data-object-name]'),prompt=$('[data-object-prompt]'),count=$('[data-object-count]'),status=$('[data-object-status]'),finish=$('[data-object-finish]');
 const zoomButton=$<HTMLButtonElement>('[data-object-zoom]'),hintButton=$<HTMLButtonElement>('[data-object-hint]');
 let order=shuffled(hiddenObjects),scenes=sceneBag(archiveScenes,undefined),current=0,zoom=false,loading=true,locked=false;
 let scene=scenes[0],timer:ReturnType<typeof setTimeout>|undefined;
 const failed=new Set<string>();
 function setZoom(on:boolean){zoom=on;picture.classList.toggle('is-enlarged',on);root.classList.toggle('is-zoomed',on);zoomButton.setAttribute('aria-pressed',String(on));zoomButton.textContent=on?'Вся картинка ⤡':'Увеличить ⤢'}
 function setLoading(on:boolean){loading=on;root.classList.toggle('is-loading',on);picture.setAttribute('aria-busy',String(on));regions.forEach(r=>r.setAttribute('tabindex',on?'-1':'0'));hintButton.disabled=on||current===order.length}
 function showScene(){
  locked=false;setLoading(true);root.dataset.scene=scene.id;root.dataset.target=order[current].id;
  $('[data-object-scene]').textContent=scene.title;label.textContent=order[current].name;prompt.textContent='Найдите на картинке';count.textContent=`${current+1} / ${order.length}`;
  regions.forEach(r=>{r.setAttribute('points',scene.areas[r.dataset.findObject as typeof hiddenObjects[number]['id']]);r.classList.remove('is-found','is-hinted');r.setAttribute('aria-disabled','false')});
  image.alt=scene.alt+' Найдите предмет, название которого написано под картинкой.';
  image.src=`${import.meta.env.BASE_URL}assets/archive-search-${scene.id}.webp`;
  status.textContent='Открываем следующую страницу…';view.scrollTo({top:0,left:0});
  if(image.complete&&image.naturalWidth)ready();
 }
 function ready(){if(current===order.length)return;setLoading(false);status.textContent='Шесть предметов, шесть мест. Вглядитесь в детали.'}
 image.addEventListener('load',ready);
 image.addEventListener('error',()=>{failed.add(scene.id);const alternative=archiveScenes.find(s=>!failed.has(s.id));if(alternative){scene=alternative;showScene()}else{setLoading(true);status.textContent='Не удалось открыть изображения. Нажмите «Начать заново», чтобы повторить загрузку.'}});
 function advance(){
  current++;
  if(current===order.length){root.dataset.finished='yes';root.dataset.target='';prompt.textContent='Расследование завершено';label.textContent='Все шесть предметов найдены';count.textContent='6 / 6';finish.hidden=false;regions.forEach(r=>r.setAttribute('tabindex','-1'));return}
  const focused=regions.includes(document.activeElement as SVGElement);scene=scenes[current];showScene();if(focused)view.focus({preventScroll:true});
 }
 function choose(region:SVGElement|null){
  if(loading||locked||current===order.length)return;
  if(region?.dataset.findObject!==order[current].id){status.textContent='Пока не то. Присмотритесь к деталям — спешить некуда.';return}
  locked=true;region.classList.remove('is-hinted');region.classList.add('is-found');region.setAttribute('aria-disabled','true');status.textContent=`Найдено: ${order[current].name.toLowerCase()}.`;
  soundCue(current===order.length-1?'complete':'found');hintButton.disabled=true;
  timer=setTimeout(advance,650);
 }
 picture.addEventListener('click',e=>choose(e.target instanceof Element?e.target.closest<SVGElement>('[data-find-object]'):null));
 regions.forEach(r=>r.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(r)}}));
 zoomButton.addEventListener('click',()=>{setZoom(!zoom);if(!zoom)view.scrollTo({top:0,left:0})});
 hintButton.addEventListener('click',()=>{if(loading||locked||current===order.length)return;const r=regions.find(r=>r.dataset.findObject===order[current].id)!;r.classList.add('is-hinted');status.textContent='Нужный предмет обведён тонкой линией. Нажмите на него.';if(zoom)r.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'})});
 $('[data-object-reset]').addEventListener('click',()=>{clearTimeout(timer);order=shuffled(hiddenObjects);scenes=sceneBag(archiveScenes,scene);scene=scenes[0];current=0;failed.clear();root.dataset.finished='no';finish.hidden=true;setZoom(false);showScene()});
 addEventListener('pagehide',()=>clearTimeout(timer));
 addEventListener('pageshow',()=>{if(locked&&current<order.length)advance()});
 root.dataset.finished='no';showScene();
}
