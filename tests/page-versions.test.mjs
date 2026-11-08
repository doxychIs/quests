import test from 'node:test';
import assert from 'node:assert/strict';
import {setupDOM} from './dom-harness.mjs';

test('Информационная страница: переключатель меняет цвета, метаданные и сохраняет выбор',()=>{
 const x=setupDOM('about');try{
  const root=x.d.documentElement,button=x.d.querySelector('[data-theme-toggle]');
  assert.equal(root.dataset.siteTheme,'dark');assert.equal(button.getAttribute('aria-pressed'),'false');
  button.click();assert.equal(root.dataset.siteTheme,'light');assert.equal(button.getAttribute('aria-pressed'),'true');assert.match(button.getAttribute('aria-label'),/тёмную/);
  assert.equal(x.w.localStorage.getItem('inoe-theme'),'light');assert.equal(x.d.querySelector('meta[name="theme-color"]').content,'#fafafa');assert.equal(x.d.querySelector('meta[name="color-scheme"]').content,'light');
  button.click();assert.equal(root.dataset.siteTheme,'dark');assert.equal(x.w.localStorage.getItem('inoe-theme'),'dark');assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});

test('Тема восстанавливается на информационных страницах и не меняет оформление миров',()=>{
 for(const route of ['about','contacts','rules','certificates']){const x=setupDOM(route,{theme:'light'});try{
  assert.equal(x.d.documentElement.dataset.siteTheme,'light');assert.equal(x.d.querySelector('[data-theme-toggle]').getAttribute('aria-pressed'),'true');
  x.w.dispatchEvent(new x.w.StorageEvent('storage',{key:'inoe-theme',newValue:'dark'}));assert.equal(x.d.documentElement.dataset.siteTheme,'dark');assert.deepEqual(x.errors,[]);
 }finally{x.close()}}
 for(const route of ['arhiv','ostrov','iznanka','iznanka/information']){const x=setupDOM(route,{theme:'light',adult:true});try{
  assert.equal(x.d.documentElement.hasAttribute('data-site-theme'),false);assert.equal(x.d.querySelector('[data-theme-toggle]'),null);assert.deepEqual(x.errors,[]);
 }finally{x.close()}}
});

test('Две версии хоррора связаны настоящими ссылками, каталог читается без 3D и прокрутки для печати',()=>{
 const room=setupDOM('iznanka',{adult:true}),info=setupDOM('iznanka/information',{adult:true});try{
  assert.ok(room.d.querySelector('.room-site-header a[href="/iznanka/information/"]'));
  assert.ok(info.d.querySelector('a[href="/iznanka/"]'));assert.equal(info.d.querySelectorAll('.horror-info-quests article').length,4);
  assert.equal(info.d.querySelectorAll('.horror-info-quests a[href*="/quests/"]').length,4);assert.equal(info.d.querySelectorAll('.horror-info-quests a[href*="/book/"]').length,4);
  assert.ok(info.d.querySelector('video[loop][data-lazy-video]'));assert.equal(info.d.querySelector('[data-room-model],[data-horror-door],[data-passage-film],.scroll-type-run'),null);
  assert.equal(info.d.querySelector('main img'),null);assert.deepEqual([...room.errors,...info.errors],[]);
 }finally{room.close();info.close()}
});

test('Общие страницы: без стрелок, нумерации разделов и декоративных иллюстраций',()=>{
 for(const route of ['','about','contacts','certificates','rules','privacy']){const x=setupDOM(route);try{
  assert.doesNotMatch(x.d.querySelector('main').textContent,/[↗↘↙←→↑↓]|Глава \d|0[12345] \/ /);
  assert.equal(x.d.querySelector('main img:not(.hub-world-preview img),.section-index'),null);assert.deepEqual(x.errors,[]);
 }finally{x.close()}}
});
