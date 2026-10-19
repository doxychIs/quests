import test from 'node:test';
import assert from 'node:assert/strict';
import {setupDOM} from './dom-harness.mjs';

test('Рукопись: слова сохраняют связность и доступный текст; перо пишет только в видимой области',()=>{
 const x=setupDOM('arhiv');try{
  const title=x.d.querySelector('#world-title'),words=title.querySelectorAll('.manuscript-word');
  assert.equal(title.textContent,'Архив');assert.equal(words.length,1);
  assert.equal(title.dataset.writingState,'pending');
  const pending=[];x.w.requestAnimationFrame=fn=>{pending.push(fn);return pending.length};
  x.intersect(title);pending.shift()(0);
  const initial=words[0].style.getPropertyValue('--ink');assert.notEqual(initial,'0.00%');
  x.intersect(title,false);while(pending.length)pending.shift()(16);
  assert.equal(words[0].style.getPropertyValue('--ink'),initial);
  x.intersect(title);for(let i=0;pending.length&&i<400;i++)pending.shift()(32+i*16);
  assert.equal(title.dataset.writingState,'complete');assert.equal(words[0].classList.contains('is-written'),true);
  assert.equal(title.textContent,'Архив');assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
test('Рукопись: спокойный режим открывает весь текст сразу; другие миры не меняются',()=>{
 for(const [route,options]of [['arhiv',{calm:true}],['arhiv',{reduced:true}],['ostrov',{}],['iznanka',{adult:true}]]){
  const x=setupDOM(route,options);try{
   assert.equal(x.d.querySelectorAll('.manuscript-word').length,0);
   assert.deepEqual(x.errors,[]);
  }finally{x.close()}
 }
});
