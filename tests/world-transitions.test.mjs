import test from 'node:test';
import assert from 'node:assert/strict';
import {worldNavigation} from '../src/scripts/world-transitions.ts';
import {invitationSVG} from '../src/lib/gift-invitation.ts';

test('Переходы связывают только главную и миры, сохраняя базовый путь и обычные ссылки',()=>{
 for(const base of ['/','/quests/']){
  const home=new URL('https://site.example'+base);
  for(const world of ['iznanka','arhiv','ostrov']){
   assert.deepEqual(worldNavigation(new URL(world+'/',home),home,'hub',true),{direction:'world',world});
   assert.deepEqual(worldNavigation(home,home,world,false),{direction:'home',world});
   assert.equal(worldNavigation(new URL(world+'/quests/story/',home),home,'hub',true),undefined);
   assert.equal(worldNavigation(new URL('#invitations',home),home,world,false),undefined);
  }
  assert.equal(worldNavigation(new URL('https://another.example'+base+'arhiv/'),home,'hub',true),undefined);
  assert.equal(worldNavigation(new URL('rules/',home),home,'hub',true),undefined);
 }
});

test('Сохранённое приглашение содержит фирменный векторный оттиск и безопасный текст',()=>{
 const svg=invitationSVG({to:'<Анна>&',message:'До встречи!',world:'arhiv'});
 assert.match(svg,/data-inoe-seal="true"/);assert.match(svg,/&lt;Анна&gt;&amp;/);assert.doesNotMatch(svg,/<Анна>/);
 assert.ok(svg.includes('fill-rule="evenodd"'),'оттиск использует контуры фирменных букв');
});
