import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {buildSync} from 'esbuild';
import {setupDOM} from './dom-harness.mjs';
const code=buildSync({entryPoints:['src/lib/video-loading.ts'],bundle:true,format:'iife',globalName:'videoAPI',write:false}).outputFiles[0].text;
function environment({small=false,saveData=false,fetcher}={}){
 const dom=new JSDOM('<video data-src="/film.mp4" data-src-mobile="/small.mp4"></video>',{url:'https://test.example/',runScripts:'outside-only'}),w=dom.window,v=w.document.querySelector('video');
 w.matchMedia=()=>({matches:small});Object.defineProperty(w.navigator,'connection',{value:{saveData}});let ready=0,created=0;
 Object.defineProperty(v,'readyState',{get:()=>ready});v.load=()=>{};v.play=()=>{throw new Error('Пролёт не должен воспроизводиться сам')};
 w.URL.createObjectURL=()=>`blob:film-${++created}`;w.URL.revokeObjectURL=()=>{};if(fetcher)w.fetch=fetcher;
 w.eval(code+';window.api=videoAPI;');
 return {w,v,api:w.api,ready(){ready=2;v.dispatchEvent(new w.Event('loadeddata'))},close(){w.close()}};
}
const flush=async()=>{for(let i=0;i<14;i++)await Promise.resolve()};
function response(){let packet=0;return {ok:true,headers:new Map([['content-type','video/mp4'],['content-length','8']]),body:{getReader:()=>({read:async()=>packet++<2?{done:false,value:new Uint8Array(4)}:{done:true},cancel:async()=>{}})}}}

test('Пролёт: один полный запрос, честный прогресс, готовность только после декодирования',async()=>{
 let calls=0;const x=environment({fetcher:async()=>{calls++;return response()}});try{
  const load=x.api.prepareVideo(x.v,true);assert.equal(load,x.api.prepareVideo(x.v,true));load.start();load.start();await flush();
  assert.equal(calls,1);assert.match(x.v.src,/blob:film-1$/);assert.equal(load.state.bytes,8);assert.equal(load.state.progress,.98);assert.equal(load.state.phase,'loading');
  x.ready();assert.equal(load.state.phase,'ready');assert.equal(load.state.progress,1);load.start();assert.equal(calls,1);
  x.v.dispatchEvent(new x.w.Event('error'));assert.equal(load.state.phase,'error');load.retry();await flush();assert.equal(calls,2);x.ready();assert.equal(load.state.phase,'ready');
 }finally{x.close()}
});
test('Сетевая ошибка допускает повтор; завершение старого запроса не портит новый',async()=>{
 let calls=0,rejectOld;const x=environment({fetcher:async()=>{calls++;if(calls===1)return new Promise((_resolve,reject)=>{rejectOld=reject});return response()}});try{
  const load=x.api.prepareVideo(x.v,true);load.start();load.retry();rejectOld(new Error('Отменённый запрос'));await flush();
  assert.equal(calls,2);assert.equal(load.state.phase,'loading');x.ready();assert.equal(load.state.phase,'ready');
 }finally{x.close()}
 const y=environment({fetcher:async()=>({ok:false})});try{const load=y.api.prepareVideo(y.v,true);load.start();await flush();assert.equal(load.state.phase,'error')}finally{y.close()}
});

test('Пролёт: медленная загрузка с прогрессом продолжается дольше 30 секунд; повтор обходит повреждённый кэш',async()=>{
 let read,now=0,nextId=0;const timers=new Map(),cache=[];
 const x=environment({fetcher:async(_url,options)=>{cache.push(options.cache);return{ok:true,headers:new Map([['content-type','video/mp4'],['content-length','8']]),body:{getReader:()=>({read:()=>new Promise(resolve=>read=resolve),cancel:async()=>{}})}}}});
 try{
  x.w.setTimeout=(fn,delay)=>{const id=++nextId;timers.set(id,{at:now+delay,fn});return id};x.w.clearTimeout=id=>timers.delete(id);
  const advance=ms=>{now+=ms;for(const[id,t]of timers)if(t.at<=now){timers.delete(id);t.fn()}};
  const load=x.api.prepareVideo(x.v,true);load.start();await flush();
  for(let i=0;i<2;i++){advance(20000);assert.equal(load.state.phase,'loading');read({done:false,value:new Uint8Array(4)});await flush()}
  advance(20000);assert.equal(load.state.phase,'loading');assert.equal(load.state.bytes,8);read({done:true});await flush();x.ready();assert.equal(load.state.phase,'ready');
  x.v.dispatchEvent(new x.w.Event('error'));load.retry();await flush();assert.deepEqual(cache,['force-cache','reload']);advance(31000);assert.equal(load.state.phase,'error');
 }finally{x.close()}
});
test('Телефон и экономия трафика выбирают лёгкий файл; без fetch работает нативная загрузка',()=>{
 for(const options of [{small:true},{saveData:true},{}]){const x=environment(options);try{
  const load=x.api.prepareVideo(x.v,true);load.start();assert.equal(x.v.getAttribute('src'),options.small||options.saveData?'/small.mp4':'/film.mp4');assert.equal(x.v.preload,'auto');x.ready();assert.equal(load.state.phase,'ready');
 }finally{x.close()}}
});
test('Заставка: выход доступен до загрузки; готовность закрывает её, спокойный режим не запрашивает видео',()=>{
 for(const route of ['arhiv','ostrov','iznanka']){
  const x=setupDOM(route,{adult:route==='iznanka'});try{
   const dialog=x.d.querySelector('[data-page-loader]');assert.ok(dialog);assert.ok(dialog.querySelector('[data-load-skip]'));
   for(const v of x.d.querySelectorAll('[data-hero-video],[data-horror-film],[data-scroll-film],[data-passage-film]')){Object.defineProperty(v,'readyState',{value:2});v.dispatchEvent(new x.w.Event('loadeddata'))}
   assert.equal(dialog.open,false);assert.deepEqual(x.errors,[]);
  }finally{x.close()}
  const y=setupDOM(route,{adult:true,calm:true});try{
   assert.equal(y.d.querySelector('[data-page-loader]').open,false);
   assert.equal([...y.d.querySelectorAll('video')].some(v=>v.getAttribute('src')),false);
  }finally{y.close()}
 }
});
