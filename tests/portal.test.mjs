import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {setupDOM} from './dom-harness.mjs';
import {invitationSVG,giftNames} from '../src/lib/gift-invitation.ts';

test('Главная: выбор мира с клавиатуры меняет подсказку; фоновое видео не работает вне экрана',()=>{
 const x=setupDOM('');try{
  const root=x.d.querySelector('[data-world-selector]'),film=root.querySelector('video');
  const worlds=[...root.querySelectorAll('[data-world-zone]')];assert.equal(worlds.length,3);assert.equal(film.getAttribute('src'),null);
  x.intersect(root,true);worlds[2].dispatchEvent(new x.w.Event('focus'));
  assert.equal(root.dataset.activeWorld,'ostrov');assert.match(root.querySelector('[data-selector-caption]').textContent,/маленьких исследователей/);
  assert.equal(film.dataset.playing,'yes');x.intersect(root,false);assert.equal(film.dataset.playing,'no');
  assert.equal(root.querySelector('img[data-safe-src]').getAttribute('src'),null);assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
test('Правила и конфиденциальность: все пункты содержания ведут к существующим разделам',()=>{
 for(const route of ['rules','privacy']){const x=setupDOM(route);try{
  const links=[...x.d.querySelectorAll('.legal-navigation a')];assert.ok(links.length>=4);
  for(const link of links){const section=x.d.getElementById(link.hash.slice(1));assert.ok(section);assert.ok(section.querySelector('h2'));assert.ok(section.querySelector('p').textContent.length>100)}
  assert.equal(x.d.body.dataset.page,route);assert.deepEqual(x.errors,[]);
 }finally{x.close()}}
});
test('Подарочное приглашение: каждый мир экспортируется автономно, имя и пожелание безопасно сохраняются в SVG',()=>{
 for(const world of Object.keys(giftNames)){
  const svg=invitationSVG({to:'Анна <&>',message:'Попутного ветра! <script>не код</script>',world});
  const dom=new JSDOM(svg,{contentType:'image/svg+xml'});try{
   const doc=dom.window.document;assert.equal(doc.querySelectorAll('script,image,foreignObject').length,0);
   assert.match(doc.documentElement.textContent,/Для Анна <&>\./);assert.ok(doc.documentElement.textContent.includes(giftNames[world]));
   assert.ok(doc.documentElement.textContent.includes('<script>не код</script>'));assert.match(doc.documentElement.textContent,/Не является оплаченным сертификатом/);
   assert.equal(doc.documentElement.getAttribute('viewBox'),'0 0 1200 800');
  }finally{dom.window.close()}
 }
});
