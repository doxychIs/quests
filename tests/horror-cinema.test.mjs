import test from 'node:test';
import assert from 'node:assert/strict';
import {setupDOM} from './dom-harness.mjs';
const setupRoom=(route,options)=>{const result=setupDOM(route,options);const room=result.d.querySelector('div[data-room-experience]');if(room)result.intersect(room,true);return result;};
import {mazePath} from '../src/lib/maze.ts';

test('Вход в хоррор начинается в единой комнате, без прежнего hero, коридора и замочной скважины',()=>{
 const x=setupRoom('iznanka',{adult:true});try{
  assert.equal(x.d.querySelectorAll('div[data-room-experience]').length,1);
  assert.equal(x.d.querySelectorAll('[data-room-canvas]').length,1);
  assert.equal(x.d.querySelector('.horror-film,[data-horror-door],[data-passage-film],[data-investigation]'),null);
  assert.equal(x.d.querySelectorAll('[data-room-quest]').length,4);
  assert.ok(x.d.querySelector('[data-room-surface="gallery"]'));
  assert.ok(x.d.querySelector('[data-room-surface="game"] [data-game="maze"]'));
  assert.ok(x.d.querySelector('[data-room-surface="team"] [data-team-picker]'));
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
test('Подробности квестов остаются на экранах: вкладки, реальные условия, галерея и запись',()=>{
 const x=setupRoom('iznanka',{adult:true});try{
  const quest=x.d.querySelector('[data-room-quest="poslednyaya-smena"]');
  assert.match(quest.querySelector('.room-quest-actions a').href,/\/iznanka\/book\/poslednyaya-smena\/$/);
  quest.querySelector('[data-room-tab="details"]').click();
  assert.equal(quest.querySelector('[data-room-pane="story"]').hidden,true);
  assert.equal(quest.querySelector('[data-room-pane="details"]').hidden,false);
  assert.match(quest.querySelector('[data-room-pane="details"]').textContent,/75 минут/);
  quest.querySelector('[data-room-tab="frames"]').click();
  assert.equal(quest.querySelectorAll('[data-room-pane="frames"] figure').length,2);
  const imageButton=quest.querySelector('[data-room-frame-open]');imageButton.click();
  assert.equal(quest.querySelector('[data-room-inline-viewer]').hidden,false);
  const event=new x.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});
  quest.dispatchEvent(event);assert.equal(event.defaultPrevented,true);
  assert.equal(quest.querySelector('[data-room-inline-viewer]').hidden,true);
  assert.equal(x.d.activeElement,imageButton);
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
function winMaze(x){const game=x.d.querySelector('[data-game=maze]'),canvas=game.querySelector('canvas');canvas.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:460});canvas.setPointerCapture=()=>{};game.querySelector('[data-start]').click();canvas.dispatchEvent(new x.w.MouseEvent('pointerdown',{clientX:65,clientY:365,bubbles:true,cancelable:true}));for(const p of mazePath.slice(1))canvas.dispatchEvent(new x.w.MouseEvent('pointermove',{clientX:p.x,clientY:p.y,bubbles:true,cancelable:true}));return game}
test('Лабиринт: скример в экране ТВ запускается только после победы и отдельного согласия',()=>{for(const surprise of [false,true]){const x=setupRoom('iznanka',{adult:true,surprise});try{const g=winMaze(x);assert.equal(g.querySelector('.game-result').hidden,false);const scare=g.querySelector('[data-horror-scare]');assert.equal(scare.hidden,!surprise);assert.ok(scare.closest('.maze-tv-screen'));assert.equal(scare.tagName,'DIV');if(surprise){assert.match(scare.querySelector('video').src,/horror-scare.mp4$/);assert.equal(scare.querySelector('video').dataset.playing,'yes');assert.equal(scare.querySelector('video').muted,true);scare.querySelector('[data-scare-close]').click();assert.equal(scare.hidden,true);assert.equal(scare.querySelector('video').dataset.playing,'no')}assert.deepEqual(x.errors,[])}finally{x.close()}}});
test('Скример: Escape, конец видео, уход из игры и сброс закрывают передачу; повторное прохождение работает',()=>{for(const exit of ['escape','ended','leave','restart','start']){const x=setupRoom('iznanka',{adult:true,surprise:true});try{let g=winMaze(x);const scene=g.querySelector('[data-horror-scare]'),video=scene.querySelector('video');if(exit==='escape')x.d.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));if(exit==='ended')video.dispatchEvent(new x.w.Event('ended'));if(exit==='leave')x.intersect(g,false);if(exit==='restart')g.querySelector('[data-restart]').click();if(exit==='start')g.querySelector('[data-start]').click();assert.equal(scene.hidden,true);assert.equal(video.dataset.playing,'no');g.querySelector('[data-restart]').click();assert.equal(g.dataset.finished,'no');g=winMaze(x);assert.equal(scene.hidden,false);assert.deepEqual(x.errors,[])}finally{x.close()}}});
test('Скример: прокрутка и начало игры не запускают видео, в спокойном режиме финал без скримера',()=>{for(const calm of [false,true]){const x=setupRoom('iznanka',{adult:true,surprise:true,calm});try{const scene=x.d.querySelector('[data-horror-scare]');assert.equal(x.d.querySelector('[data-haunt-button]'),null);x.w.dispatchEvent(new x.w.Event('scroll'));assert.equal(scene.hidden,true);assert.equal(scene.querySelector('video').getAttribute('src'),null);winMaze(x);assert.equal(scene.hidden,calm);assert.deepEqual(x.errors,[])}finally{x.close()}}});
test('Скример: отзыв согласия закрывает текущую передачу',async()=>{const x=setupRoom('iznanka',{adult:true,surprise:true});try{const g=winMaze(x),scene=g.querySelector('[data-horror-scare]'),setting=x.d.querySelector('#surprise-setting');setting.checked=false;setting.dispatchEvent(new x.w.Event('change',{bubbles:true}));await Promise.resolve();assert.equal(scene.hidden,true);assert.equal(scene.querySelector('video').dataset.playing,'no');assert.deepEqual(x.errors,[])}finally{x.close()}});
