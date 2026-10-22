import test from 'node:test';
import assert from 'node:assert/strict';
import {setupDOM} from './dom-harness.mjs';
import {horrorPhotos,horrorSettings} from '../src/lib/horror-settings.ts';

test('Ручка ТВ: колёсико листает в обе стороны, серия событий не пролистывает всё; вне ручки прокрутка свободна',()=>{
 const x=setupDOM('iznanka',{adult:true});try{
  const root=x.d.querySelector('[data-photo-gallery]'),tuner=root.querySelector('[data-photo-tuner]'),count=root.querySelector('[data-photo-count]');let now=1000;x.w.performance.now=()=>now;
  const wheel=(target,options={})=>{const event=new x.w.WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true,...options});target.dispatchEvent(event);return event};
  assert.equal(tuner.disabled,false);assert.ok(x.d.getElementById(tuner.getAttribute('aria-describedby')));
  assert.equal(wheel(tuner).defaultPrevented,true);assert.match(count.textContent,/2 из 8/);assert.equal(tuner.style.getPropertyValue('--tuner-angle'),'36deg');
  wheel(tuner);assert.match(count.textContent,/2 из 8/);
  now+=200;wheel(tuner,{deltaY:-100});assert.match(count.textContent,/1 из 8/);assert.equal(tuner.style.getPropertyValue('--tuner-angle'),'0deg');
  now+=200;wheel(tuner,{deltaY:3,deltaMode:1});assert.match(count.textContent,/2 из 8/);
  now+=200;assert.equal(wheel(tuner,{ctrlKey:true}).defaultPrevented,false);assert.match(count.textContent,/2 из 8/);
  assert.equal(wheel(root).defaultPrevented,false);assert.match(count.textContent,/2 из 8/);
  tuner.click();assert.match(count.textContent,/3 из 8/);tuner.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true}));assert.match(count.textContent,/2 из 8/);
  root.querySelector('[data-photo-filter="lesnik"]').click();now+=200;wheel(tuner,{deltaY:-100});assert.match(count.textContent,/2 из 2/);assert.match(root.querySelector('[data-photo-card]:not([hidden]) img').src,/forest-actor/);assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});

test('Телевизор: переключение каналов и кадров, увеличение и возврат фокуса',()=>{
 const x=setupDOM('iznanka',{adult:true});try{
  const root=x.d.querySelector('[data-photo-gallery]'),dialog=root.querySelector('[data-photo-dialog]'),active=()=>root.querySelector('[data-photo-card]:not([hidden])');
  assert.equal(root.querySelectorAll('[data-photo-card]:not([hidden])').length,1);
  root.querySelector('[data-photo-filter="lesnik"]').click();assert.equal(active().dataset.photoQuest,'lesnik');assert.match(root.querySelector('[data-photo-count]').textContent,/1 из 2/);
  root.querySelector('[data-photo-browse="1"]').click();assert.match(active().querySelector('img').src,/forest-actor/);
  root.querySelector('[data-photo-tv]').dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.match(active().querySelector('img').src,/forest-room/);
  active().querySelector('a').focus();active().querySelector('a').dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(x.d.activeElement,active().querySelector('a'));assert.match(active().querySelector('img').src,/forest-actor/);
  active().querySelector('a').dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.match(active().querySelector('img').src,/forest-room/);
  const first=active().querySelector('a');first.dispatchEvent(new x.w.MouseEvent('click',{bubbles:true,cancelable:true,ctrlKey:true}));assert.equal(dialog.open,false);
  first.dispatchEvent(new x.w.MouseEvent('click',{bubbles:true,cancelable:true}));assert.equal(dialog.open,true);assert.match(dialog.querySelector('img').src,/forest-room/);
  dialog.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.match(dialog.querySelector('img').src,/forest-actor/);assert.match(dialog.querySelector('[data-photo-position]').textContent,/2 из 2/);
  assert.match(dialog.querySelector('[data-photo-quest-link]').href,/\/iznanka\/quests\/lesnik\/#location$/);
  root.querySelector('[data-photo-close]').click();assert.equal(dialog.open,false);assert.equal(x.d.activeElement,active().querySelector('a'));
  root.querySelector('[data-photo-filter="all"]').click();assert.match(root.querySelector('[data-photo-count]').textContent,/1 из 8/);
  root.querySelector('[data-photo-browse="-1"]').click();assert.match(root.querySelector('[data-photo-count]').textContent,/8 из 8/);
  assert.equal(root.querySelectorAll('.scroll-type-run').length,0);assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});

test('Телевизор: прояснение, сенсорное листание и фотография при недоступном canvas',()=>{
 const x=setupDOM('iznanka',{adult:true,coarse:true});try{
  const root=x.d.querySelector('[data-photo-gallery]'),tv=root.querySelector('[data-photo-tv]'),track=root.querySelector('[data-photo-track]'),sharp=root.querySelector('[data-photo-sharp]'),active=()=>root.querySelector('[data-photo-card]:not([hidden])');
  sharp.click();assert.equal(sharp.getAttribute('aria-pressed'),'true');assert.ok(tv.classList.contains('is-clear'));
  root.querySelector('[data-photo-browse="1"]').click();assert.equal(sharp.getAttribute('aria-pressed'),'false');assert.ok(!tv.classList.contains('is-clear'));
  const touch=(name,xPos,yPos)=>{const e=new x.w.Event(name,{bubbles:true});Object.defineProperty(e,name==='touchstart'?'touches':'changedTouches',{value:[{clientX:xPos,clientY:yPos}]});track.dispatchEvent(e)};
  touch('touchstart',280,150);touch('touchend',90,160);assert.match(root.querySelector('[data-photo-count]').textContent,/3 из 8/);
  active().querySelector('a').dispatchEvent(new x.w.MouseEvent('click',{bubbles:true,cancelable:true}));assert.equal(root.querySelector('dialog').open,false);
  touch('touchstart',150,100);touch('touchend',160,280);assert.match(root.querySelector('[data-photo-count]').textContent,/3 из 8/);
  const img=active().querySelector('img');Object.defineProperty(img,'naturalWidth',{value:1200});img.dispatchEvent(new x.w.Event('load'));assert.ok(active().querySelector('a').classList.contains('has-pixels'));
  x.w.HTMLCanvasElement.prototype.getContext=()=>null;
  root.querySelector('[data-photo-browse="1"]').click();const fallback=active().querySelector('img');Object.defineProperty(fallback,'naturalWidth',{value:1200});fallback.dispatchEvent(new x.w.Event('load'));assert.ok(!active().querySelector('a').classList.contains('has-pixels'));assert.ok(fallback.src.endsWith('.webp'));
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});

test('Квесты: у каждой истории своя локация и роль; её галерея не содержит кадров других историй',()=>{
 assert.equal(new Set(Object.values(horrorSettings).map(s=>s.place)).size,4);
 for(const [slug,setting] of Object.entries(horrorSettings)){
  const x=setupDOM('iznanka/quests/'+slug,{adult:true});try{
   const info=x.d.querySelector('#location');assert.ok(info.textContent.includes(setting.place));assert.ok(info.textContent.includes(setting.actor));assert.ok(info.textContent.includes(setting.format));
   const expected=horrorPhotos.filter(photo=>photo.quest===slug).map(photo=>photo.image),links=[...x.d.querySelectorAll('.detail-gallery [data-lightbox-src]')];assert.equal(links.length,2);assert.ok(links.every(link=>expected.some(image=>link.dataset.lightboxSrc.endsWith('/'+image+'.webp'))));assert.equal(info.querySelectorAll('.scroll-type-run').length,0);assert.deepEqual(x.errors,[]);
  }finally{x.close()}
 }
});
