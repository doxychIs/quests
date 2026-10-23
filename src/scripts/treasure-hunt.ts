import {spawnTreasures,treasureNames,treasureDistance,detectorStrength,type Point} from '../lib/expedition';
import {soundCue} from './sound-cues';
export function initTreasureHunt(root:HTMLElement){
 if(root.dataset.ready)return;root.dataset.ready='yes';
 const $=<T extends HTMLElement=HTMLElement>(s:string)=>root.querySelector<T>(s)!;
 const board=$('[data-treasure-board]'),detector=$('[data-detector]'),status=$('[data-treasure-status]'),meter=$<HTMLMeterElement>('[data-detector-meter]'),dig=$<HTMLButtonElement>('[data-treasure-dig]'),next=$<HTMLButtonElement>('[data-treasure-next]'),help=$<HTMLButtonElement>('[data-treasure-help]'),hint=$('[data-treasure-hint]'),finish=$('[data-treasure-finish]');
 let targets=spawnTreasures(),round=0,position:Point={x:50,y:65},active=false,found=false,dragging=false,lastPulse=0;
 const positionElement=(element:HTMLElement,p:Point)=>{element.style.left=p.x+'%';element.style.top=p.y+'%'};
 function scan(p:Point,announce=true){
  if(!active||found)return;
  position={x:Math.max(3,Math.min(97,p.x)),y:Math.max(5,Math.min(94,p.y))};positionElement(detector,position);
  const strength=detectorStrength(position,targets[round]),near=treasureDistance(position,targets[round])<6;
  const level=near?'hot':strength>.4?'warm':'cold';board.dataset.signal=level;meter.value=Math.round(strength*100);
  const copy=near?'Вот оно! Здесь можно копнуть.':strength>.4?'Сигнал усиливается. Вы на верном пути!':'Пока тихо. Исследуйте другие берега.';
  if(announce&&status.textContent!==copy)status.textContent=copy;
  const now=performance.now();if(announce&&strength>.15&&now-lastPulse>650-strength*440){lastPulse=now;document.dispatchEvent(new CustomEvent('gran-detector',{detail:strength}))}
 }
 function digHere(){
  if(!active||found)return;
  if(treasureDistance(position,targets[round])>=6){status.textContent='Тут только песок. Ищите место с сильным сигналом.';return}
  found=true;hint.hidden=true;dig.disabled=true;help.disabled=true;
  const mark=document.createElement('span');mark.textContent='✦';mark.title=treasureNames[round];positionElement(mark,targets[round]);$('[data-treasure-marks]').append(mark);
  status.textContent=`Найдено: ${treasureNames[round].toLowerCase()}!`;root.dataset.found=String(round+1);soundCue(round===3?'complete':'found');
  if(round===3){active=false;root.dataset.finished='yes';detector.hidden=true;finish.hidden=false;finish.tabIndex=-1;finish.focus({preventScroll:true});$('[data-treasure-round]').textContent='Все 4 находки собраны'}
  else next.hidden=false;
 }
 function begin(){active=true;found=false;root.dataset.finished='no';$('[data-treasure-welcome]').hidden=true;detector.hidden=false;dig.disabled=false;help.disabled=false;board.classList.add('is-searching');scan(position);board.focus({preventScroll:true})}
 function reset(){targets=spawnTreasures();round=0;position={x:50,y:65};active=false;found=false;dragging=false;root.dataset.found='0';root.dataset.finished='no';finish.hidden=true;next.hidden=true;hint.hidden=true;$('[data-treasure-marks]').replaceChildren();$('[data-treasure-round]').textContent='Находка 1 / 4';meter.value=0;begin()}
 const coordinate=(e:PointerEvent)=>{const r=board.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*100,y:(e.clientY-r.top)/r.height*100}};
 board.addEventListener('pointermove',e=>{if(active&&(e.pointerType!=='touch'||dragging))scan(coordinate(e))});
 board.addEventListener('pointerdown',e=>{if(!active||found||e.button!==0)return;dragging=true;board.setPointerCapture(e.pointerId);board.focus({preventScroll:true});scan(coordinate(e));e.preventDefault()});
 board.addEventListener('pointerup',e=>{if(!dragging)return;dragging=false;scan(coordinate(e));digHere()});
 board.addEventListener('pointercancel',()=>dragging=false);board.addEventListener('lostpointercapture',()=>dragging=false);
 board.addEventListener('keydown',e=>{if(e.target!==board||!active)return;const moves:Record<string,Point>={ArrowLeft:{x:-2,y:0},ArrowRight:{x:2,y:0},ArrowUp:{x:0,y:-3},ArrowDown:{x:0,y:3}};if(moves[e.key]){e.preventDefault();scan({x:position.x+moves[e.key].x,y:position.y+moves[e.key].y})}else if(e.key==='Enter'||e.key===' '){e.preventDefault();digHere()}});
 $('[data-treasure-start]').addEventListener('click',begin);dig.addEventListener('click',digHere);
 next.addEventListener('click',()=>{round++;found=false;next.hidden=true;hint.hidden=true;dig.disabled=false;help.disabled=false;$('[data-treasure-round]').textContent=`Находка ${round+1} / 4`;scan(position);board.focus({preventScroll:true})});
 help.addEventListener('click',()=>{hint.hidden=false;positionElement(hint,targets[round]);status.textContent='Ищите внутри отмеченного круга. Прибор укажет точное место.'});
 $('[data-treasure-reset]').addEventListener('click',reset);$('[data-treasure-replay]').addEventListener('click',reset);
 document.addEventListener('visibilitychange',()=>dragging=false);
}
