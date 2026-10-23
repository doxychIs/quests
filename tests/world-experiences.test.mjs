import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {shuffled,sceneBag,spawnTreasures,treasureDistance,detectorStrength} from '../src/lib/expedition.ts';
import {archiveScenes,hiddenObjects} from '../src/lib/hidden-objects.ts';
import {setupDOM} from './dom-harness.mjs';
function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
test('Случайные мешки сохраняют все элементы и не повторяют сцену на границе',()=>{
 const rng=seeded(20),source=[1,2,3,4,5,6];let last;
 const signatures=new Set();for(let i=0;i<100;i++){const bag=sceneBag(source,last,rng);assert.deepEqual([...bag].sort(),source);assert.notEqual(bag[0],last);last=bag.at(-1);signatures.add(bag.join())}
 assert.ok(signatures.size>70);assert.deepEqual(source,[1,2,3,4,5,6]);assert.deepEqual(shuffled([],rng),[]);
});
test('Сокровища меняют расположение, не пересекаются; близость не зависит от разрешения экрана',()=>{
 const rng=seeded(98),signatures=new Set();for(let n=0;n<200;n++){
  const points=spawnTreasures(rng);assert.equal(points.length,4);signatures.add(JSON.stringify(points));
  for(const [i,p] of points.entries()){assert.ok(p.x>10&&p.x<92&&p.y>12&&p.y<76);assert.equal(detectorStrength(p,p),1);assert.equal(detectorStrength(p,{x:p.x+100,y:p.y}),0);for(const q of points.slice(i+1))assert.ok(treasureDistance(p,q)>9)}
 }assert.equal(signatures.size,200);
});
test('Каждая сцена содержит шесть разных размеченных целей и существующее изображение WebP',()=>{
 assert.equal(archiveScenes.length,6);assert.equal(hiddenObjects.length,6);
 for(const scene of archiveScenes){assert.ok(fs.statSync(`public/assets/archive-search-${scene.id}.webp`).size<600000);for(const item of hiddenObjects){const points=scene.areas[item.id].split(' ').map(p=>p.split(',').map(Number));assert.ok(points.length>=4);for(const [x,y] of points)assert.ok(x>=0&&x<=1536&&y>=0&&y<=1024)}}
});
test('Галереи открывают общий тематический диалог вне пролёта; карта выбирается фокусом и касанием',()=>{
 for(const world of ['arhiv','ostrov']){const x=setupDOM(world);try{
  const gallery=x.d.querySelector('[data-world-gallery]'),dialog=x.d.querySelector('[data-world-dialog]');
  gallery.querySelector('[data-gallery-step="1"]').click();assert.equal(gallery.querySelector('[data-gallery-count]').textContent,'2 / 4');
  const entry=gallery.querySelector('[data-gallery-slide]:not([hidden]) [data-world-quest]');
  const modified=new x.w.MouseEvent('click',{bubbles:true,cancelable:true,ctrlKey:true});entry.dispatchEvent(modified);assert.equal(modified.defaultPrevented,false);assert.equal(dialog.open,false);
  entry.dispatchEvent(new x.w.MouseEvent('click',{bubbles:true,cancelable:true}));assert.equal(dialog.open,true);assert.ok(x.d.documentElement.classList.contains('world-dialog-open'));
  assert.equal(dialog.querySelector('[data-world-preview]:not([hidden])').dataset.worldPreview,entry.dataset.worldQuest);
  if(world==='ostrov'){const points=dialog.querySelectorAll('[data-map-point]');assert.equal(points.length,4);points[3].focus();assert.equal(points[3].getAttribute('aria-pressed'),'true');assert.match(dialog.querySelector('[data-world-preview]:not([hidden]) .quest-dialog-details').href,/dyhanie-vulkana/);points[0].click();assert.equal(points[0].getAttribute('aria-pressed'),'true')}
  else{assert.equal(dialog.querySelectorAll('.astral-ghost[aria-hidden=true]').length,4)}
  dialog.querySelector('[data-world-close]').click();assert.equal(dialog.open,false);assert.equal(x.d.activeElement,entry);assert.ok(!x.d.documentElement.classList.contains('world-dialog-open'));assert.deepEqual(x.errors,[]);
 }finally{x.close()}}
});
test('Металлоискатель: четыре раунда, подсказка, touch, защита от двойного поиска и повтор',()=>{
 const x=setupDOM('ostrov');try{
  const game=x.d.querySelector('[data-game=treasure-hunt]'),board=game.querySelector('[data-treasure-board]');
  board.setPointerCapture=()=>{};board.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:650});
  game.querySelector('[data-treasure-start]').click();assert.equal(game.querySelector('[data-treasure-welcome]').hidden,true);
  const locations=[];
  for(let round=0;round<4;round++){
   game.querySelector('[data-treasure-help]').click();const hint=game.querySelector('[data-treasure-hint]'),px=parseFloat(hint.style.left)*10,py=parseFloat(hint.style.top)*6.5;locations.push([px,py]);
   for(const type of ['pointerdown','pointerup']){const event=new x.w.Event(type,{bubbles:true,cancelable:true});Object.assign(event,{pointerType:'touch',button:0,pointerId:1,clientX:px,clientY:py});board.dispatchEvent(event)}
   assert.equal(game.dataset.found,String(round+1));assert.equal(game.querySelectorAll('[data-treasure-marks]>span').length,round+1);
   game.querySelector('[data-treasure-dig]').click();assert.equal(game.dataset.found,String(round+1));
   if(round<3)game.querySelector('[data-treasure-next]').click();
  }
  assert.equal(game.dataset.finished,'yes');assert.equal(game.querySelector('[data-treasure-finish]').hidden,false);
  game.querySelector('[data-treasure-replay]').click();assert.equal(game.dataset.finished,'no');assert.equal(game.querySelectorAll('[data-treasure-marks]>span').length,0);
  const before=game.querySelector('[data-detector]').style.left;board.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));assert.notEqual(game.querySelector('[data-detector]').style.left,before);assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
test('Ошибка изображения не выдаёт отсутствующую цель: подмена доступной сценой и возможность повторить',()=>{
 const x=setupDOM('arhiv');try{const game=x.d.querySelector('[data-game=hidden-object]'),image=game.querySelector('img'),scenes=new Set();for(let i=0;i<6;i++){scenes.add(game.dataset.scene);image.dispatchEvent(new x.w.Event('error'))}assert.equal(scenes.size,6);assert.match(game.querySelector('[data-object-status]').textContent,/Не удалось/);assert.equal(game.classList.contains('is-loading'),true);game.querySelector('[data-object-reset]').click();image.dispatchEvent(new x.w.Event('load'));assert.equal(game.classList.contains('is-loading'),false);assert.deepEqual(x.errors,[])}finally{x.close()}
});
test('Поиск предметов продолжает раунд после возврата страницы из кэша браузера',()=>{
 const x=setupDOM('arhiv');try{
  const game=x.d.querySelector('[data-game=hidden-object]'),scene=game.dataset.scene,target=game.dataset.target;
  game.querySelector('img').dispatchEvent(new x.w.Event('load'));
  game.querySelector(`[data-find-object="${target}"]`).dispatchEvent(new x.w.MouseEvent('click',{bubbles:true}));
  x.w.dispatchEvent(new x.w.Event('pagehide'));x.w.dispatchEvent(new x.w.Event('pageshow'));
  assert.notEqual(game.dataset.scene,scene);assert.notEqual(game.dataset.target,target);assert.equal(game.querySelector('[data-object-count]').textContent,'2 / 6');assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
test('Горизонтальный свайп галереи не открывает картину случайным завершающим щелчком',()=>{
 const x=setupDOM('arhiv');try{
  const gallery=x.d.querySelector('[data-world-gallery]'),entry=gallery.querySelector('[data-gallery-entry]');
  for(const [type,clientX] of [['pointerdown',250],['pointerup',80]]){const e=new x.w.Event(type,{bubbles:true});Object.assign(e,{pointerType:'touch',clientX,clientY:100});entry.dispatchEvent(e)}
  const click=new x.w.MouseEvent('click',{bubbles:true,cancelable:true});entry.dispatchEvent(click);
  assert.equal(click.defaultPrevented,true);assert.equal(gallery.querySelector('[data-gallery-count]').textContent,'2 / 4');assert.equal(x.d.querySelector('[data-world-dialog]').open,false);assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
