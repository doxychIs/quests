import test from 'node:test';
import assert from 'node:assert/strict';
import {setupDOM} from './dom-harness.mjs';

test('Все телевизоры: названия, сюжет и сведения видны без прокрутки, в том числе после повторного открытия',async()=>{
 for(const slug of ['palata-06','ne-otvechay','poslednyaya-smena','lesnik']){
  const x=setupDOM('iznanka',{adult:true,nullCanvas:true});try{
   for(const label of x.d.querySelectorAll('[data-crt-room] [data-scroll-graphic]'))assert.equal(label.dataset.typeState,'complete');
   const link=x.d.querySelector(`[data-room-screen][data-quest-slug="${slug}"]`);
   const open=()=>link.dispatchEvent(new x.w.MouseEvent('click',{bubbles:true,cancelable:true}));
   const program=x.d.querySelector(`[data-broadcast-program="${slug}"]`),panel=x.d.querySelector('[data-broadcast-panel]');
   for(let attempt=0;attempt<2;attempt++){
    open();await Promise.resolve();await Promise.resolve();
    assert.equal(panel.hidden,false);assert.equal(program.hidden,false);
    assert.ok(program.querySelector('h2 [data-letter]'));
    assert.ok(program.querySelector('.broadcast-synopsis [data-letter]'));
    assert.equal(program.querySelectorAll('[data-type-hidden]').length,0,slug);
    for(const tab of ['info','place','story']){
     program.querySelector(`[data-broadcast-tab="${tab}"]`).click();
     const pane=program.querySelector(`[data-broadcast-pane="${tab}"]`);
     assert.equal(pane.hidden,false);assert.equal(pane.querySelectorAll('[data-type-hidden]').length,0);
     assert.ok(pane.querySelector('[data-graphic-text][data-type-state="complete"]'));
    }
    x.d.querySelector('[data-broadcast-close]').click();await Promise.resolve();
    assert.equal(panel.hidden,true);
   }
   assert.deepEqual(x.errors,[]);
  }finally{x.close()}
 }
});
