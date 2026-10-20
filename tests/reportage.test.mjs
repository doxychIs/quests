import test from 'node:test';
import assert from 'node:assert/strict';
import {setupDOM} from './dom-harness.mjs';
import {horrorPhotos,horrorSettings} from '../src/lib/horror-settings.ts';

test('Галерея: фильтр ограничивает кадры, стрелки листают выбранную историю, закрытие возвращает фокус',()=>{
 const x=setupDOM('iznanka',{adult:true,nullCanvas:true});try{
  const root=x.d.querySelector('[data-photo-gallery]'),dialog=root.querySelector('[data-photo-dialog]');
  root.querySelector('[data-photo-filter="lesnik"]').click();
  const cards=[...root.querySelectorAll('[data-photo-card]')].filter(c=>!c.hidden);assert.equal(cards.length,2);assert.ok(cards.every(c=>c.dataset.photoQuest==='lesnik'));
  const first=cards[0].querySelector('a');first.dispatchEvent(new x.w.MouseEvent('click',{bubbles:true,cancelable:true,ctrlKey:true}));assert.equal(dialog.open,false);
  first.dispatchEvent(new x.w.MouseEvent('click',{bubbles:true,cancelable:true}));assert.equal(dialog.open,true);assert.match(dialog.querySelector('img').src,/forest-room/);
  dialog.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.match(dialog.querySelector('img').src,/forest-actor/);assert.match(dialog.querySelector('[data-photo-position]').textContent,/2 из 2/);
  root.querySelector('[data-photo-step="1"]').click();assert.match(dialog.querySelector('img').src,/forest-room/);assert.match(dialog.querySelector('[data-photo-quest-link]').href,/\/iznanka\/quests\/lesnik\/#location$/);
  root.querySelector('[data-photo-close]').click();assert.equal(dialog.open,false);assert.equal(x.d.activeElement,first);
  root.querySelector('[data-photo-filter="all"]').click();assert.equal([...root.querySelectorAll('[data-photo-card]')].filter(c=>!c.hidden).length,8);assert.equal(root.querySelectorAll('.scroll-type-run').length,0);assert.deepEqual(x.errors,[]);
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
