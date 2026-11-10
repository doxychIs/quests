import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createHubLoader} from '../src/scripts/hub-loader.ts';

function fixture(){
 const dom=new JSDOM('<html class="hub-loading"><body><header class="hub-header"></header><main><div data-hub-loader><button data-hub-loader-skip>Пропустить вступление</button></div><section id="intro"></section><div id="decoration" inert></div></main><footer class="site-footer"></footer></body></html>');
 return {dom,w:dom.window,d:dom.window.document,root:dom.window.document.querySelector('[data-hub-loader]')};
}

test('Загрузка удерживает прокрутку и фокус до готовности сцены, затем возвращает доступ к странице',async()=>{
 const x=fixture(),loader=createHubLoader(x.root,()=>{});try{
  assert.equal(x.d.querySelector('main').getAttribute('aria-busy'),'true');
  assert.ok(x.d.querySelector('#intro').hasAttribute('inert'));assert.equal(x.root.hasAttribute('inert'),false);
  const wheel=new x.w.WheelEvent('wheel',{cancelable:true});x.d.dispatchEvent(wheel);assert.equal(wheel.defaultPrevented,true);
  const key=new x.w.KeyboardEvent('keydown',{key:'PageDown',cancelable:true});x.d.dispatchEvent(key);assert.equal(key.defaultPrevented,true);
  let done=0;x.root.addEventListener('inoe:loader-finished',()=>done++);loader.finish();loader.finish();
  assert.equal(done,1);assert.equal(x.d.documentElement.classList.contains('hub-loading'),false);
  assert.equal(x.d.querySelector('#intro').hasAttribute('inert'),false);assert.equal(x.d.querySelector('main').hasAttribute('aria-busy'),false);
  assert.equal(x.d.querySelector('#decoration').hasAttribute('inert'),true,'собственный inert декорации сохраняется');
  const after=new x.w.WheelEvent('wheel',{cancelable:true});x.d.dispatchEvent(after);assert.equal(after.defaultPrevented,false);
  await new Promise(resolve=>setTimeout(resolve,350));assert.equal(x.root.hidden,true);
 }finally{loader.dispose();x.dom.window.close()}
});

test('Пропуск вступления вызывает запасной режим один раз; уменьшенное движение не блокирует страницу',()=>{
 const x=fixture();let skips=0;const loader=createHubLoader(x.root,()=>{skips++;loader.finish()});try{
  x.root.querySelector('button').click();x.root.querySelector('button').click();assert.equal(skips,1);
  assert.equal(x.d.querySelector('header').hasAttribute('inert'),false);assert.equal(x.d.documentElement.classList.contains('hub-loading'),false);
  loader.dispose();assert.equal(x.root.hidden,true);
  const reduced=createHubLoader(x.root,()=>assert.fail('скрытый экран не должен обрабатывать пропуск'));
  assert.equal(x.d.querySelector('#intro').hasAttribute('inert'),false);reduced.dispose();
 }finally{loader.dispose();x.dom.window.close()}
});
