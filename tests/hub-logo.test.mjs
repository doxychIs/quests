import test from 'node:test';
import assert from 'node:assert/strict';
import {logoProgress,logoPose} from '../src/lib/hub-logo.ts';
import {setupDOM} from './dom-harness.mjs';

test('Логотип попадает точно из hero в шапку на широком и узком экране; возврат восстанавливает исходное положение',()=>{
 for(const [from,to] of [
  [{left:310,top:280,width:660,height:246},{left:70,top:33,width:81,height:30}],
  [{left:40,top:340,width:230,height:86},{left:24,top:26,width:75,height:28}],
 ]){
  assert.deepEqual(logoPose(from,to,0),{x:from.left,y:from.top,scale:1});
  const end=logoPose(from,to,1);assert.ok(Math.abs(end.x-to.left)<.001);assert.ok(Math.abs(from.width*end.scale-to.width)<.001);
  assert.ok(Math.abs(end.y+from.height*end.scale/2-(to.top+to.height/2))<.001);
  const forward=[0,.15,.4,.7,1].map(p=>logoPose(from,to,p));
  assert.deepEqual([1,.7,.4,.15,0].map(p=>logoPose(from,to,p)).reverse(),forward);
  assert.ok(forward.every(p=>p.scale>0&&Number.isFinite(p.x)&&Number.isFinite(p.y)));
 }
 assert.equal(logoProgress(-100,500),0);assert.equal(logoProgress(1000,500),1);assert.equal(logoProgress(0,0),0);
});

test('Главная: единый словесный логотип и три действующих входа в миры',()=>{
 const x=setupDOM('');try{
  const hero=x.d.querySelector('[data-hub-hero]'),root=x.d.querySelector('[data-world-selector]');
  assert.equal(hero.querySelector('h1').getAttribute('aria-label'),'ИНОЕ');assert.equal(hero.querySelectorAll('[data-hub-logo]').length,1);
  assert.equal(hero.querySelector('p,button,.hub-action'),null);assert.ok(x.d.querySelector('.hub-header[data-hub-home=true] [data-logo-target]'));
  assert.equal(root.querySelector('p,h2,.hub-world-meta,.hub-world-bottom'),null);
  assert.equal(root.querySelectorAll('a').length,3);assert.equal(root.querySelectorAll('.hub-world-preview-title').length,3);
  assert.doesNotMatch(hero.textContent+root.textContent,/Выйти из|Одна команда|Три настроения|Для тех/);
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
