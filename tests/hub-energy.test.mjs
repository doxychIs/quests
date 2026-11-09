import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEnergyRoute,energyAtDistance,energyAtY,energyFrontier,energyBranchProgress,energyVisibility} from '../src/lib/hub-energy-path.ts';
import {setupDOM} from './dom-harness.mjs';

function layout(width){
 const mobile=width<=760,pad=mobile?24:70,cardWidth=mobile?width-48:(width-180)/3;
 const cards=Array.from({length:3},(_,i)=>({left:mobile?pad:pad+i*(cardWidth+20),top:5500+(mobile?i*358:0),width:cardWidth,height:340}));
 const after=mobile?6556:5840;
 return {width,viewport:844,source:{x:width/2,y:4900},cards,
  about:{left:pad,top:after,width:width-pad*2,height:mobile?620:560},
  gift:{left:pad,top:after+(mobile?620:560),width:width-pad*2,height:mobile?540:420},
  questions:{left:pad,top:after+(mobile?1160:980),width:width-pad*2,height:mobile?600:460},
  footer:{left:0,top:after+(mobile?1760:1440),width,height:mobile?400:300}};
}

test('Основной поток заканчивается у разветвления, а три цветные ветви доходят только до своих карточек',()=>{
 for(const width of [320,391,768,1280,1920]){
  const input=layout(width),route=buildEnergyRoute(input),samples=route.main.samples;
  assert.deepEqual({x:samples[0].x,y:samples[0].y},input.source);
  assert.equal(samples.at(-1).y,input.cards[0].top-(width<=760?48:76));
  assert.ok(samples.every((p,i)=>Number.isFinite(p.x+p.y+p.distance)&&p.x>=10&&p.x<=width-10&&(!i||p.y>samples[i-1].y&&p.distance>samples[i-1].distance)));
  route.branches.forEach((branch,i)=>{
   const start=energyAtDistance(route.main,branch.startDistance),card=input.cards[i];
   assert.ok(Math.hypot(start.x-branch.path.samples[0].x,start.y-branch.path.samples[0].y)<.01,'ветка начинается точно на главном потоке');
   assert.deepEqual(branch.end,{x:card.left+card.width/2,y:card.top-2});
   assert.equal(branch.startDistance,route.main.length,'все ветви начинаются в конце главного шлейфа');
   assert.ok(branch.path.samples.every(p=>p.y<=card.top-2),'ветвь не продолжается за карточку');
  });
 }
});

test('Шлейф и ветви раскрываются по прокрутке в обе стороны, сохраняя скрытое начало',()=>{
 const input=layout(1280),{main,branches}=buildEnergyRoute(input);
 assert.equal(energyFrontier(main,0,844,0),0);
 for(const p of [0,.1,.3,.5,.64]){
  assert.equal(energyVisibility(p),0,'шлейф не виден в начале вступления');
  assert.equal(energyFrontier(main,3000,844,p),0);
 }
 assert.ok(energyVisibility(.70)>0&&energyVisibility(.70)<1);assert.equal(energyVisibility(.77),1);
 const scrolls=[4200,4500,4900,5300,5800,6300];
 const forward=scrolls.map(y=>energyFrontier(main,y,844,1));
 assert.ok(forward.every((d,i)=>i===0||d>=forward[i-1]));
 assert.equal(forward.at(-1),main.length);
 assert.deepEqual([...scrolls].reverse().map(y=>energyFrontier(main,y,844,1)).reverse(),forward);
 assert.equal(forward[0],0);
 for(const branch of branches){
  assert.equal(energyBranchProgress(branch.path,4200,844,1),0);
  assert.equal(energyBranchProgress(branch.path,5800,844,1),1);
  const amounts=scrolls.map(y=>energyBranchProgress(branch.path,y,844,1));
  assert.deepEqual([...scrolls].reverse().map(y=>energyBranchProgress(branch.path,y,844,1)).reverse(),amounts);
 }
});

test('Изменение нижних секций больше не продлевает маршрут: после миров шлейфов нет',()=>{
 const input=layout(391),before=buildEnergyRoute(input);
 input.questions.height+=260;input.footer.top+=260;
 const after=buildEnergyRoute(input);
 assert.deepEqual(after,before);
 assert.deepEqual(after.branches.map(b=>b.end),before.branches.map(b=>b.end));
 assert.equal(energyAtY(after.main,9000).y,input.cards[0].top-48);
 assert.ok(after.branches.every(b=>b.end.y<input.questions.top),'все ветви заканчиваются до информационных блоков');
});

test('Декоративный слой не создаёт элементов управления и отключается при уменьшенном движении',()=>{
 const x=setupDOM('',{reduced:true});try{
  const root=x.d.querySelector('[data-hub-energy]');
  assert.equal(root.getAttribute('aria-hidden'),'true');assert.ok(root.hasAttribute('inert'));
  assert.equal(root.dataset.energyState,'reduced');assert.equal(root.querySelector('a,button,input'),null);
  assert.equal(x.w.canvasCalls,0,'уменьшенное движение не создаёт WebGL-контекст');
  assert.equal(root.querySelectorAll('[data-energy-branch]').length,3);
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
