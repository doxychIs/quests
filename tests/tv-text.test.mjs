import test from 'node:test';
import assert from 'node:assert/strict';
import {setupDOM} from './dom-harness.mjs';
const setupRoom=(route,options)=>{const result=setupDOM(route,options);const room=result.d.querySelector('div[data-room-experience]');if(room)result.intersect(room,true);return result;};
import {quests} from '../src/lib/data.ts';

test('Тексты ТВ читаются сразу, вкладки не зависят от внешней прокрутки, масштаб текста управляется отдельно',()=>{
 const x=setupRoom('iznanka',{adult:true});try{
  for(const q of quests.filter(quest=>quest.world==='iznanka')){
   const surface=x.d.querySelector(`[data-room-quest="${q.slug}"]`);
   assert.ok(surface.querySelector('h2 [data-graphic-text]'));
   assert.ok(surface.querySelector('[data-room-pane="story"]').textContent.includes(q.story));
   assert.ok(surface.querySelector('[data-room-pane="story"]').textContent.includes(q.task));
   for(const tab of ['details','place','story']){
    surface.querySelector(`[data-room-tab="${tab}"]`).click();
    const pane=surface.querySelector(`[data-room-pane="${tab}"]`);
    assert.equal(pane.hidden,false);
    assert.equal(pane.querySelectorAll('[data-type-hidden]').length,0);
    assert.equal(pane.querySelectorAll('.scroll-type-run').length,0,'Интерактивный экран не ждёт прокрутки страницы');
   }
   const readable=surface.querySelector('[data-room-readability]');readable.click();
   assert.equal(readable.getAttribute('aria-pressed'),'true');assert.ok(surface.classList.contains('room-readable'));
   readable.click();assert.equal(readable.getAttribute('aria-pressed'),'false');
  }
  assert.equal(x.d.querySelectorAll('[data-room-tv-content] [data-type-hidden]').length,0);
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
