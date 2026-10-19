import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {buildSync} from 'esbuild';

const code=buildSync({entryPoints:['src/scripts/scroll-typing.ts'],bundle:true,format:'iife',globalName:'typing',write:false}).outputFiles[0].text;
function setup(world='iznanka'){
 const dom=new JSDOM(`<html class="adult"><body data-world="${world}"><header class="site-header">Квесты</header><main><h1><span data-graphic-text="УЖАС"><span class="graphic-transcript">УЖАС</span><svg>${[...'УЖАС'].map(char=>`<g data-letter="${char}"></g>`).join('')}</svg></span></h1><p id="copy">Текст, который должен останавливаться вместе с прокруткой, а затем продолжаться с прежнего места.</p><p id="offscreen">За пределами экрана буквы не печатаются.</p><a id="action" href="#">Выбрать квест</a><form><label>Имя<input/></label></form><p role="status">Подходят 2 квеста</p><div id="nested"></div></main></body></html>`,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://test.example/'});
 const w=dom.window,d=w.document;let now=1000,y=0,hidden=false,id=0,taps=0;const frames=new Map(),observers=[];
 Object.defineProperty(w,'scrollY',{get:()=>y});Object.defineProperty(d,'hidden',{get:()=>hidden});w.performance.now=()=>now;
 w.requestAnimationFrame=fn=>{frames.set(++id,fn);return id};w.cancelAnimationFrame=id=>frames.delete(id);
 w.matchMedia=()=>({matches:false,addEventListener(){}});
 w.Element.prototype.getBoundingClientRect=function(){return{top:this.matches('.site-header')?0:150,bottom:this.matches('.site-header')?80:175,left:10,right:310,width:300,height:25}};
 w.Range.prototype.getClientRects=()=>[{top:150,bottom:175,left:10,right:310,width:300,height:25}];
 w.IntersectionObserver=class{constructor(fn){this.fn=fn;this.targets=new Set();observers.push(this)}observe(el){this.targets.add(el)}unobserve(el){this.targets.delete(el)}disconnect(){}};
 const NativeObserver=w.MutationObserver;w.MutationObserver=class extends NativeObserver{constructor(fn){super((...args)=>{if(w.document)fn(...args)})}};
 w.eval(code+';typing.initScrollTyping(()=>window.taps());');w.taps=()=>taps++;
 const intersect=(el,on)=>{for(const observer of observers)if(observer.targets.has(el))observer.fn([{target:el,isIntersecting:on}])};
 for(const observer of observers)for(const el of observer.targets)intersect(el,!el.closest('#offscreen'));
 return{w,d,frames,intersect,get taps(){return taps},count(selector){return Number(d.querySelector(selector).dataset.typeCount)},scroll(delta=80){y+=delta;w.dispatchEvent(new w.Event('scroll'))},flush(ms=16){now+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(now))},hide(on){hidden=on;d.dispatchEvent(new w.Event('visibilitychange'))},close(){dom.window.close()}};
}
test('Печать продвигается только при прокрутке, сохраняет место паузы и не печатает вне экрана',()=>{
 const x=setup();try{
  const title='[data-graphic-text]',copy='#copy .scroll-type-run';
  assert.equal(x.frames.size,0);assert.equal(x.count(title),0);
  x.scroll();x.flush();assert.equal(x.count(title),4);assert.equal(x.count(copy),0);
  x.flush();assert.ok(x.count(copy)>0);const paused=x.count(copy);
  x.flush(200);assert.equal(x.count(copy),paused);assert.equal(x.frames.size,0);
  assert.equal(x.d.querySelector('.scroll-type-caret').dataset.typing,'false');
  x.flush(5000);assert.equal(x.count(copy),paused);
  x.scroll(8);x.flush();assert.ok(x.count(copy)>paused);
  assert.equal(x.count('#offscreen .scroll-type-run'),0);assert.ok(x.taps>0);
  assert.equal(x.d.querySelector('#copy .scroll-type-transcript').textContent,'Текст, который должен останавливаться вместе с прокруткой, а затем продолжаться с прежнего места.');
 }finally{x.close()}
});
test('Фоновая вкладка останавливает печать, уменьшенное движение открывает весь текст',async()=>{
 const x=setup();try{
  x.scroll();x.flush();x.hide(true);assert.equal(x.frames.size,0);assert.equal(x.d.querySelector('.scroll-type-caret').hidden,true);
  const count=x.count('[data-graphic-text]');x.scroll();x.flush();assert.equal(x.count('[data-graphic-text]'),count);
  x.hide(false);assert.equal(x.frames.size,0);
  x.d.documentElement.classList.add('calm');await Promise.resolve();
  assert.equal(x.d.querySelector('#copy .scroll-type-run').dataset.typeState,'complete');
  assert.equal(x.d.querySelectorAll('[data-type-hidden]').length,0);assert.equal(x.frames.size,0);
 }finally{x.close()}
});
test('Элементы управления и доступный текст остаются рабочими до завершения печати',()=>{
 const x=setup();try{
  const link=x.d.querySelector('#action');link.dispatchEvent(new x.w.Event('focusin',{bubbles:true}));
  assert.equal(link.textContent,'Выбрать квест');assert.equal(link.querySelector('.scroll-type-run'),null);
  assert.equal(x.d.querySelectorAll('form .scroll-type-run,[role=status] .scroll-type-run,.site-header .scroll-type-run').length,0);
  assert.equal(x.taps,0);
 }finally{x.close()}
 const other=setup('arhiv');try{assert.equal(other.d.querySelectorAll('.scroll-type-run,.scroll-type-caret').length,0)}finally{other.close()}
});
test('Прокрутка внутри телевизора также продвигает печать',()=>{
 const x=setup();try{
  const nested=x.d.querySelector('#nested');nested.scrollTop=40;nested.dispatchEvent(new x.w.Event('scroll'));
  x.flush();assert.ok(x.count('[data-graphic-text]')>0);
 }finally{x.close()}
});
test('Буквы повторно открытого телевизора сохраняют прогресс, подписи Canvas получают тот же счётчик',async()=>{
 const x=setup();try{
  const main=x.d.querySelector('main'),graphic=x.d.querySelector('[data-graphic-text]');
  x.scroll(2);x.flush();const count=x.count('[data-graphic-text]');assert.ok(count>0&&count<4);
  graphic.querySelector('svg').remove();
  graphic.insertAdjacentHTML('beforeend','<svg><g data-letter="У"></g><g data-letter="Ж"></g><g data-letter="А"></g><g data-letter="С"></g></svg>');
  await Promise.resolve();
  assert.equal(graphic.querySelectorAll('[data-type-hidden]').length,4-count);
  const label=x.d.createElementNS('http://www.w3.org/2000/svg','a');label.setAttribute('data-scroll-graphic','ПАЛАТА 06');main.append(label);await Promise.resolve();
  assert.equal(label.dataset.typeCount,'0');
  x.intersect(graphic,false);x.intersect(x.d.querySelector('#copy .scroll-type-run'),false);x.intersect(x.d.querySelector('#action .scroll-type-run'),false);x.intersect(label,true);
  x.scroll(5);x.flush();assert.ok(Number(label.dataset.typeCount)>0);
 }finally{x.close()}
});
