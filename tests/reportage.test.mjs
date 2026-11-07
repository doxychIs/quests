import test from 'node:test';
import assert from 'node:assert/strict';
import {setupDOM} from './dom-harness.mjs';
const setupRoom=(route,options)=>{const result=setupDOM(route,options);const room=result.d.querySelector('div[data-room-experience]');if(room)result.intersect(room,true);return result;};
import {horrorPhotos,horrorSettings} from '../src/lib/horror-settings.ts';

const gallery=x=>x.d.querySelector('[data-room-surface="gallery"]');
const active=root=>root.querySelector('[data-room-photo]:not([hidden])');

test('Галерея в 3D-ТВ: ручка листает в обе стороны, серия wheel не прокручивает всё, вне ручки scroll свободен',()=>{
 const x=setupRoom('iznanka',{adult:true});try{
  const root=gallery(x),tuner=root.querySelector('[data-room-photo-tuner]'),count=root.querySelector('[data-room-photo-position]');let now=1000;x.w.performance.now=()=>now;
  const wheel=(target,options={})=>{const event=new x.w.WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true,...options});target.dispatchEvent(event);return event};
  assert.equal(wheel(tuner).defaultPrevented,true);assert.match(count.textContent,/2 из 8/);
  wheel(tuner);assert.match(count.textContent,/2 из 8/);
  now+=200;wheel(tuner,{deltaY:-100});assert.match(count.textContent,/1 из 8/);
  now+=200;wheel(tuner,{deltaY:3,deltaMode:1});assert.match(count.textContent,/2 из 8/);
  now+=200;assert.equal(wheel(tuner,{ctrlKey:true}).defaultPrevented,false);assert.match(count.textContent,/2 из 8/);
  assert.equal(wheel(root).defaultPrevented,false);assert.match(count.textContent,/2 из 8/);
  tuner.click();assert.match(count.textContent,/3 из 8/);
  root.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true}));assert.match(count.textContent,/2 из 8/);
  root.querySelector('[data-room-photo-filter="lesnik"]').click();now+=200;wheel(tuner,{deltaY:-100});assert.match(count.textContent,/2 из 2/);assert.match(active(root).querySelector('img').src,/forest-actor/);
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});

test('Кинопроектор включается явно; wheel листает по кадру и освобождает страницу свежим жестом на границах плёнки',()=>{
 const x=setupRoom('iznanka',{adult:true});try{
  const root=gallery(x),count=root.querySelector('[data-room-photo-position]'),buttons=[...x.d.querySelectorAll('[data-room-projector-power]')];
  let now=1000;x.w.performance.now=()=>now;
  const powers=[];x.d.addEventListener('room:projector-power',event=>powers.push(event.detail.on));
  const activate=id=>x.d.dispatchEvent(new x.w.CustomEvent('room:surface-active',{detail:{id}}));
  const wheel=(options={},target=x.d.body)=>{const event=new x.w.WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true,...options});target.dispatchEvent(event);return event;};
  activate('gallery');assert.equal(root.dataset.roomProjectorOn,'false');assert.equal(wheel().defaultPrevented,false);assert.match(count.textContent,/1 из 8/);
  assert.ok(buttons.length>=2,'Выключатель есть у экрана и в доступном пульте');buttons[0].click();
  assert.equal(root.dataset.roomProjectorOn,'true');assert.deepEqual(powers,[true]);assert.ok(buttons.every(button=>button.getAttribute('aria-pressed')==='true'));
  assert.equal(wheel({deltaY:-100}).defaultPrevented,false,'В начале плёнки можно прокрутить назад по сайту');
  now+=500;assert.equal(wheel().defaultPrevented,true);assert.match(count.textContent,/2 из 8/);
  for(let i=0;i<20;i++){now+=10;assert.equal(wheel().defaultPrevented,true);}
  assert.match(count.textContent,/2 из 8/,'Один инерционный пакет колёсика не пролистывает всю галерею');
  now+=500;assert.equal(wheel({ctrlKey:true}).defaultPrevented,false);assert.equal(wheel({deltaX:180}).defaultPrevented,false);
  assert.equal(wheel({},buttons[0]).defaultPrevented,false,'Выключатель не перехватывает прокрутку страницы');
  for(let n=3;n<=8;n++){now+=500;assert.equal(wheel().defaultPrevented,true);assert.match(count.textContent,new RegExp(`${n} из 8`));}
  now+=10;assert.equal(wheel().defaultPrevented,true,'Хвост жеста, доведшего до конца, не выбрасывает камеру из комнаты');
  now+=500;assert.equal(wheel().defaultPrevented,false,'Новый жест после последнего кадра продолжает скролл сайта');assert.match(count.textContent,/8 из 8/);
  now+=500;assert.equal(wheel({deltaY:-100}).defaultPrevented,true);assert.match(count.textContent,/7 из 8/);
  activate('ward');now+=500;assert.equal(wheel().defaultPrevented,false);assert.match(count.textContent,/7 из 8/,'Выключатель не блокирует прокрутку других сцен');
  activate('gallery');buttons.at(-1).click();assert.equal(root.dataset.roomProjectorOn,'false');assert.deepEqual(powers,[true,false]);
  now+=500;assert.equal(wheel().defaultPrevented,false);assert.ok(buttons.every(button=>button.getAttribute('aria-pressed')==='false'));
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});

test('Проектор учитывает границы отфильтрованной плёнки и не ловит wheel в скрытой вкладке',()=>{
 const x=setupRoom('iznanka',{adult:true});try{
  const root=gallery(x),count=root.querySelector('[data-room-photo-position]');let now=1000,hidden=false;x.w.performance.now=()=>now;
  Object.defineProperty(x.d,'hidden',{get:()=>hidden,configurable:true});
  x.d.dispatchEvent(new x.w.CustomEvent('room:surface-active',{detail:{id:'gallery'}}));x.d.dispatchEvent(new x.w.CustomEvent('room:projector-toggle'));
  root.querySelector('[data-room-photo-filter="lesnik"]').click();assert.match(count.textContent,/1 из 2/);
  const wheel=deltaY=>{const event=new x.w.WheelEvent('wheel',{deltaY,bubbles:true,cancelable:true});x.d.body.dispatchEvent(event);return event;};
  assert.equal(wheel(100).defaultPrevented,true);assert.match(count.textContent,/2 из 2/);
  now+=500;assert.equal(wheel(100).defaultPrevented,false);assert.match(count.textContent,/2 из 2/);
  hidden=true;now+=500;assert.equal(wheel(-100).defaultPrevented,false);assert.match(count.textContent,/2 из 2/);
  hidden=false;now+=500;assert.equal(wheel(-3*16).defaultPrevented,true);assert.match(count.textContent,/2 из 2/,'Мелкие дельты накапливаются до одного шага');
  now+=10;assert.equal(wheel(-12).defaultPrevented,true);assert.match(count.textContent,/1 из 2/);
  now+=500;assert.equal(wheel(-100).defaultPrevented,false);assert.match(count.textContent,/1 из 2/);
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});

test('Галерея: все восемь записей, фильтры, клавиатура, оригинал в отдельном просмотре и возврат фокуса',()=>{
 const x=setupRoom('iznanka',{adult:true});try{
  const root=gallery(x);assert.equal(root.querySelectorAll('[data-room-photo]').length,8);assert.equal(root.querySelectorAll('[data-room-photo]:not([hidden])').length,1);
  root.querySelector('[data-room-photo-filter="lesnik"]').click();assert.equal(active(root).dataset.roomPhoto,'lesnik');assert.match(root.querySelector('[data-room-photo-position]').textContent,/1 из 2/);
  root.querySelector('[data-room-photo-step="1"]').click();assert.match(active(root).querySelector('img').src,/forest-actor/);
  root.querySelector('[data-room-photo-track]').dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.match(active(root).querySelector('img').src,/forest-room/);
  active(root).querySelector('button').focus();active(root).querySelector('button').dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  assert.equal(x.d.activeElement,active(root).querySelector('button'),'Листание не оставляет фокус в скрытом кадре');
  const opener=active(root).querySelector('[data-room-photo-zoom]');opener.click();assert.equal(root.classList.contains('room-gallery-expanded'),true);assert.equal(opener.getAttribute('aria-expanded'),'true');
  const viewer=x.d.querySelector('[data-room-original-viewer]');assert.equal(viewer.open,true,'Оригинал открывается за пределами пиксельного рендера');assert.equal(x.d.documentElement.style.overflow,'hidden','Прокрутка оригинала не перемещает камеру под ним');
  assert.equal(viewer.querySelector('img').src,active(root).querySelector('img').src);assert.equal(viewer.querySelector('img').alt,active(root).querySelector('img').alt);
  const wheel=new x.w.WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true});viewer.dispatchEvent(wheel);assert.equal(wheel.defaultPrevented,false,'Просмотр оригинала не листает плёнку');
  root.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(root.classList.contains('room-gallery-expanded'),false);assert.equal(x.d.documentElement.style.overflow,'');
  assert.match(active(root).querySelector('figcaption a').href,/\/iznanka\/quests\/lesnik\/#location$/);
  root.querySelector('[data-room-photo-filter="all"]').click();assert.match(root.querySelector('[data-room-photo-position]').textContent,/1 из 8/);
  root.querySelector('[data-room-photo-step="-1"]').click();assert.match(root.querySelector('[data-room-photo-position]').textContent,/8 из 8/);
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});

test('Галерея: touch не мешает вертикальному скроллу, нет случайного увеличения после swipe, ошибка кадра обработана',()=>{
 const x=setupRoom('iznanka',{adult:true,coarse:true});try{
  const root=gallery(x),track=root.querySelector('[data-room-photo-track]'),clear=root.querySelector('[data-room-photo-clear]');let now=1000;x.w.performance.now=()=>now;
  clear.click();assert.equal(clear.getAttribute('aria-pressed'),'true');assert.equal(root.classList.contains('room-gallery-clear'),true);
  const touch=(name,xPos,yPos)=>{const event=new x.w.Event(name,{bubbles:true});Object.defineProperty(event,name==='touchstart'?'touches':'changedTouches',{value:[{clientX:xPos,clientY:yPos}]});track.dispatchEvent(event)};
  touch('touchstart',280,150);touch('touchend',90,160);assert.match(root.querySelector('[data-room-photo-position]').textContent,/2 из 8/);
  active(root).querySelector('[data-room-photo-zoom]').click();assert.equal(root.classList.contains('room-gallery-expanded'),false);
  now+=501;active(root).querySelector('[data-room-photo-zoom]').click();assert.equal(root.classList.contains('room-gallery-expanded'),true);
  touch('touchstart',150,100);touch('touchend',160,280);assert.match(root.querySelector('[data-room-photo-position]').textContent,/2 из 8/);
  const img=active(root).querySelector('img');img.dispatchEvent(new x.w.Event('error'));assert.equal(root.querySelector('[data-room-photo-error]').hidden,false);
  img.dispatchEvent(new x.w.Event('load'));assert.equal(root.querySelector('[data-room-photo-error]').hidden,true);
  x.d.dispatchEvent(new x.w.CustomEvent('room:surface-active',{detail:{id:'game'}}));assert.equal(root.classList.contains('room-gallery-expanded'),false);
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});

test('Квесты: у каждого своя локация и роль, галерея не содержит кадров других квестов',()=>{
 assert.equal(new Set(Object.values(horrorSettings).map(s=>s.place)).size,4);
 for(const [slug,setting] of Object.entries(horrorSettings)){
  const x=setupDOM('iznanka/quests/'+slug,{adult:true});try{
   const info=x.d.querySelector('#location');assert.ok(info.textContent.includes(setting.place));assert.ok(info.textContent.includes(setting.actor));assert.ok(info.textContent.includes(setting.format));
   const expected=horrorPhotos.filter(photo=>photo.quest===slug).map(photo=>photo.image),links=[...x.d.querySelectorAll('.detail-gallery [data-lightbox-src]')];assert.equal(links.length,2);assert.ok(links.every(link=>expected.some(image=>link.dataset.lightboxSrc.endsWith('/'+image+'.webp'))));assert.equal(info.querySelectorAll('.scroll-type-run').length,0);assert.deepEqual(x.errors,[]);
  }finally{x.close()}
 }
});
