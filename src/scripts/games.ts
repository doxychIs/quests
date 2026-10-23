import {initHiddenObjects} from './hidden-objects';
import {initTreasureHunt} from './treasure-hunt';
import {soundCue} from './sound-cues';
import {playHorrorScare} from './horror-scares';
import {createVisibleLoop} from './visible-loop';
import {Maze,mazePath,mazeCheckpoints,distance} from '../lib/maze';
const $=<T extends Element=HTMLElement>(s:string,p:ParentNode=document)=>p.querySelector<T>(s)!;
function canvasSetup(root:HTMLElement){const canvas=$<HTMLCanvasElement>('canvas',root);const dpr=Math.min(devicePixelRatio||1,2);canvas.width=1000*dpr;canvas.height=460*dpr;const ctx=canvas.getContext('2d')!;ctx.setTransform(dpr,0,0,dpr,0,0);return{canvas,ctx}}
function controls(root:HTMLElement,canvas:HTMLCanvasElement){const keys=new Set<string>();const allowed=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyW','KeyA','KeyS','KeyD'];root.addEventListener('keydown',e=>{if(allowed.includes(e.code)){e.preventDefault();keys.add(e.code)}});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());document.addEventListener('visibilitychange',()=>keys.clear());root.querySelectorAll<HTMLButtonElement>('[data-key]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key!);canvas.focus({preventScroll:true})});const up=()=>keys.delete(b.dataset.key!);b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up)});return keys}
function result(root:HTMLElement){const r=$<HTMLElement>('.game-result',root);r.hidden=false;r.tabIndex=-1;r.focus({preventScroll:true});soundCue('complete');return r}
export function initGames(){
 document.querySelectorAll<HTMLElement>('[data-game]').forEach(root=>{if(root.dataset.game==='maze')maze(root);if(root.dataset.game==='treasure-hunt')initTreasureHunt(root);if(root.dataset.game==='hidden-object')initHiddenObjects(root)})
}
function maze(root:HTMLElement){const {canvas,ctx:c}=canvasSetup(root);const model=new Maze();const keys=controls(root,canvas);let running=false,dragging=false,finished=false;const status=$('[data-status]',root),start=$<HTMLButtonElement>('[data-start]',root),stage=$('[data-stage]',root);let pointerTrail:{x:number;y:number}[]=[];
 const reset=()=>{model.reset();root.dataset.finished='no';running=false;finished=false;dragging=false;pointerTrail=[];$<HTMLElement>('.game-result',root).hidden=true;start.textContent='Начать испытание';status.textContent='Доведите сигнал до выхода';stage.textContent='01 / 03';draw();loop.sync()};
 function apply(x:number,y:number){const before={...model.pos};const s=model.move({x,y});if(s==='wall'){status.textContent='Стена. Вы вернулись к контрольной точке.';dragging=false;pointerTrail=[]}else if(s==='won'&&!finished){finished=true;running=false;status.textContent='Все три участка пройдены';start.textContent='Испытание пройдено';root.dataset.finished='yes';const r=result(root);playHorrorScare(root);try{if(sessionStorage.getItem('gran-surprise')==='yes'){$('[data-result-copy]',r).textContent=`Сигнал дошёл. На другом конце линии открылась дверь. Касаний стен: ${model.mistakes}.`}}catch{}}else{if(distance(before,model.pos)>1)pointerTrail.push({...model.pos});if(pointerTrail.length>90)pointerTrail.shift();stage.textContent=`${Math.min(model.stage+1,3).toString().padStart(2,'0')} / 03`;if(model.stage)status.textContent=`Контрольная точка ${model.stage} / 3`}draw()}
 function draw(){
  c.clearRect(0,0,1000,460);c.fillStyle='#080e12';c.fillRect(0,0,1000,460);c.strokeStyle='#a5c8df08';c.lineWidth=1;for(let x=20;x<1000;x+=40){c.beginPath();c.moveTo(x,0);c.lineTo(x,460);c.stroke()}for(let y=20;y<460;y+=40){c.beginPath();c.moveTo(0,y);c.lineTo(1000,y);c.stroke()}
  c.lineJoin='miter';c.lineCap='square';c.beginPath();mazePath.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.lineWidth=48;c.strokeStyle='#7e9aa8';c.shadowColor='#98b6c7';c.shadowBlur=9;c.stroke();c.shadowBlur=0;
  c.fillStyle='#b70d27';c.fillRect(902,309,38,42);
  c.fillStyle='#d7e8f0';c.fillRect(model.pos.x-6,model.pos.y-6,12,12);c.strokeStyle='#dce8ec';c.lineWidth=1;c.strokeRect(model.pos.x-6,model.pos.y-6,12,12);

 }
 const coordinate=(e:PointerEvent)=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*1000/r.width,y:(e.clientY-r.top)*460/r.height}};
 canvas.addEventListener('pointerdown',e=>{if(!running)return;const p=coordinate(e);if(distance(p,model.pos)>35){status.textContent='Коснитесь светлого квадрата, чтобы вести его.';return}dragging=true;canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});e.preventDefault()});canvas.addEventListener('pointermove',e=>{if(dragging&&running){const p=coordinate(e);apply(p.x,p.y)}});canvas.addEventListener('pointerup',()=>dragging=false);canvas.addEventListener('pointercancel',()=>dragging=false);
 start.addEventListener('click',()=>{if(finished)reset();running=!running;start.textContent=running?'Пауза':'Продолжить';canvas.focus({preventScroll:true});draw();loop.sync()});$('[data-restart]',root).addEventListener('click',reset);$('[data-replay]',root).addEventListener('click',()=>{reset();start.click()});
 function tick(t:number,dt:number){if(running){const dx=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA'));const dy=Number(keys.has('ArrowDown')||keys.has('KeyS'))-Number(keys.has('ArrowUp')||keys.has('KeyW'));if(dx||dy){const n=Math.hypot(dx,dy);apply(model.pos.x+dx/n*135*dt,model.pos.y+dy/n*135*dt)}}}
 const loop=createVisibleLoop(root,tick,()=>running);draw();
}
