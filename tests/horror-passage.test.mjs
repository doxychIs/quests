import test from 'node:test';
import assert from 'node:assert/strict';
import {passageTimeline,passageEnd} from '../src/lib/horror-passage.ts';
import {setupDOM} from './dom-harness.mjs';

test('Проход: скролл привязан к кадрам, разворачивается назад и останавливается на общем плане',()=>{
 const forward=[0,.1,.25,.5,.82,1].map(p=>passageTimeline(p));
 for(let i=1;i<forward.length;i++)assert.ok(forward[i].time>=forward[i-1].time);
 assert.equal(forward[0].time,0);assert.equal(forward.at(-1).time,passageEnd);
 assert.ok(passageTimeline(.25).time<passageTimeline(.5).time);
 assert.equal(passageTimeline(.8).room,false);assert.equal(passageTimeline(1).room,true);
 assert.equal(passageTimeline(1).fit,1);assert.equal(passageTimeline(-1).time,0);assert.equal(passageTimeline(3).time,passageEnd);
});

test('Проход: режим без движения сразу открывает комнату и не загружает проход',()=>{
 const x=setupDOM('iznanka',{adult:true,calm:true});
 try{assert.equal(x.d.querySelector('[data-passage-film]').getAttribute('src'),null);assert.ok(x.d.querySelector('[data-horror-door]').classList.contains('room-open'));assert.deepEqual(x.errors,[])}finally{x.close()}
});

test('ТВ: описание находится в исходной сцене; Escape возвращает её без блокировки страницы',()=>{
 const x=setupDOM('iznanka',{adult:true,nullCanvas:true});
 try{
  const panel=x.d.querySelector('[data-broadcast-panel]'),link=x.d.querySelector('[data-room-screen]');
  link.dispatchEvent(new x.w.MouseEvent('click',{bubbles:true,cancelable:true}));
  assert.equal(panel.hidden,false);assert.ok(panel.closest('[data-room-viewport]'));assert.equal(panel.style.transform,'none');
  assert.equal(x.d.documentElement.style.overflow,'');assert.equal(x.d.querySelector('[data-broadcast-dialog]'),null);
  x.w.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'Escape'}));
  assert.equal(panel.hidden,true);assert.equal(x.d.querySelector('[data-room-stage]').style.transform,'');assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
