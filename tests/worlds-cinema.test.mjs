import test from 'node:test';
import assert from 'node:assert/strict';
import {cinemaTimeline,createFrameScrubber} from '../src/lib/scroll-cinema.ts';
import {passageTimeline} from '../src/lib/horror-passage.ts';
import {setupDOM} from './dom-harness.mjs';

class Film extends EventTarget{
 readyState=1;seeking=false;duration=10;currentTime=0;muted=false;pauses=0;
 pause(){this.pauses++}
 play(){throw new Error('В пролёте запрещён автоматический запуск')}
}
test('Все миры используют ритм ХОРРОРА; кадр следует за позицией, включая обратный скролл',()=>{
 for(const p of [-1,0,.13,.5,.82,.86,1,2])assert.deepEqual(cinemaTimeline(p,6.5),passageTimeline(p));
 for(const end of [6.25,9.875]){
  const film=new Film(),scrub=createFrameScrubber(film);
  for(const p of [0,.25,.6,.85,.6,.25,0]){const expected=cinemaTimeline(p,end).time;scrub.setTime(expected);assert.equal(film.currentTime,expected)}
  const frozen=film.currentTime;film.dispatchEvent(new Event('seeked'));assert.equal(film.currentTime,frozen);
  assert.equal(film.pauses,1);assert.equal(film.muted,true);
 }
});
test('Медленная перемотка применяет последний запрошенный кадр, а не устаревшую очередь',()=>{
 const film=new Film(),scrub=createFrameScrubber(film);
 film.seeking=true;scrub.setTime(2);scrub.setTime(6);scrub.setTime(3);
 assert.equal(film.currentTime,0);
 film.seeking=false;film.dispatchEvent(new Event('seeked'));assert.equal(film.currentTime,3);
 film.readyState=0;scrub.setTime(7);assert.equal(film.currentTime,3);
 film.readyState=1;film.dispatchEvent(new Event('loadedmetadata'));assert.equal(film.currentTime,7);
 scrub.setTime(100);assert.equal(film.currentTime,9.97);
});
test('АРХИВ и ОСТРОВ: отдельные фоновые видео; пролёты без loop/autoplay',()=>{
 for(const route of ['arhiv','ostrov']){
  const x=setupDOM(route);try{
   const hero=x.d.querySelector('.story-hero video');assert.ok(hero);assert.match(hero.dataset.src,/hero\.mp4$/);assert.match(hero.dataset.srcMobile,/hero-mobile\.mp4$/);assert.equal(hero.loop,true);
   const film=x.d.querySelector('[data-scroll-film]');assert.equal(film.loop,false);assert.equal(film.autoplay,false);assert.equal(film.dataset.playing,'no');
   assert.equal(x.d.querySelectorAll('[data-lazy-video]').length,1);assert.ok(x.d.querySelector('[data-page-loader]'));assert.notEqual(hero.dataset.src,film.dataset.src);
   assert.deepEqual(x.errors,[]);
  }finally{x.close()}
 }
});
test('Спокойный режим не загружает пролёт, сразу показывает конечный кадр и доступные сигналы',()=>{
 for(const route of ['arhiv','ostrov']){
  const x=setupDOM(route,{calm:true});try{
   const scene=x.d.querySelector('[data-world-cinema]'),film=scene.querySelector('video');
   assert.equal(film.getAttribute('src'),null);assert.equal(scene.classList.contains('cinema-quiet'),true);
   assert.equal(scene.querySelector('[data-cinema-reveal]').inert,false);
   assert.deepEqual(x.errors,[]);
  }finally{x.close()}
 }
});
test('Сигналы ОСТРОВА открываются только на финальном плане; возврат скрывает их из навигации',()=>{
 const x=setupDOM('ostrov');try{
  const scene=x.d.querySelector('[data-world-cinema]'),film=scene.querySelector('video'),signals=scene.querySelector('.island-signals');
  assert.equal(signals.inert,true);assert.equal(signals.querySelectorAll('a').length,4);
  const pending=[];x.w.requestAnimationFrame=fn=>{pending.push(fn);return pending.length};
  Object.defineProperty(x.w,'innerHeight',{value:1000});
  Object.defineProperty(film,'readyState',{value:1});Object.defineProperty(film,'duration',{value:6.292});
  function scroll(p){scene.getBoundingClientRect=()=>({top:-p*4600,bottom:5600-p*4600,height:5600});x.w.dispatchEvent(new x.w.Event('scroll'));while(pending.length)pending.shift()(0)}
  scroll(.5);assert.equal(film.currentTime,cinemaTimeline(.5,6.25).time);assert.equal(signals.inert,true);
  scroll(.95);assert.equal(film.currentTime,6.25);assert.equal(signals.inert,false);
  scroll(.2);assert.equal(film.currentTime,cinemaTimeline(.2,6.25).time);assert.equal(signals.inert,true);
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
test('ОСТРОВ: четыре сигнала открывают краткие окна; отдельного каталога ниже сцены нет',()=>{
 const x=setupDOM('ostrov');try{
  const names=['Шёпот джунглей','Сердце зимы','Каменный лабиринт','Дыхание вулкана'];
  assert.deepEqual([...x.d.querySelectorAll('.signal-name')].map(e=>e.textContent),names);
  assert.deepEqual([...x.d.querySelectorAll('[data-world-preview] h3')].map(e=>e.textContent),names);
  assert.equal(x.d.querySelectorAll('.expedition-collection,.archive-collection,.quest-section').length,0);
  assert.equal(x.d.querySelector('#quests').closest('[data-world-cinema]')!==null,true);
  assert.doesNotMatch(x.d.body.textContent,/маяк|дирижабль|остров сокровищ|мастерская чудес/i);
 }finally{x.close()}
});
test('Картины и сигналы: окно внутри сцены, переключение, закрытие и возврат фокуса',()=>{
 for(const route of ['arhiv','ostrov']){
  const x=setupDOM(route,{calm:true});try{
   const scene=x.d.querySelector('[data-world-cinema]'),dialog=scene.querySelector('dialog');
   const links=[...scene.querySelectorAll(route==='arhiv'?'.painting-link':'.island-signal')];
   const previews=[...dialog.querySelectorAll('[data-world-preview]')];
   links[1].dispatchEvent(new x.w.MouseEvent('click',{bubbles:true,cancelable:true}));
   assert.equal(dialog.open,true);assert.equal(previews[1].hidden,false);
   assert.equal(previews.filter(p=>!p.hidden).length,1);
   assert.equal(dialog.getAttribute('aria-labelledby'),previews[1].querySelector('h3').id);
   assert.match(previews[1].querySelector('.quest-dialog-details').href,/\/quests\//);
   dialog.querySelector('[data-world-step="1"]').click();assert.equal(previews[2].hidden,false);
   dialog.dispatchEvent(new x.w.Event('cancel',{cancelable:true}));assert.equal(dialog.open,false);
   assert.equal(x.d.activeElement,links[1]);
   scene.querySelector('[data-cinema-enlarge]').click();assert.equal(scene.classList.contains('cinema-inspect'),true);
   scene.querySelector('[data-cinema-enlarge]').click();assert.equal(scene.classList.contains('cinema-inspect'),false);
   assert.deepEqual(x.errors,[]);
  }finally{x.close()}
 }
});
test('АРХИВ: четыре картины содержат изображения своих квестов, полный сюжет оставлен на отдельных страницах',()=>{
 const x=setupDOM('arhiv');try{
  const links=[...x.d.querySelectorAll('.painting-link')];
  assert.equal(links.length,4);
  assert.deepEqual(links.map(p=>p.querySelector('image').getAttribute('href')),['/assets/archive-1.webp','/assets/archive-2.webp','/assets/archive-3.webp','/assets/archive-4.webp']);
  assert.equal(x.d.querySelectorAll('.archive-collection,.quest-section').length,0);
  assert.equal(x.d.querySelectorAll('[data-world-preview] .story-lead').length,0);
 }finally{x.close()}
});
