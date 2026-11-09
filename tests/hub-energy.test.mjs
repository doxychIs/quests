import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEnergyRoute,energyAtDistance,energyAtY,energyFrontier} from '../src/lib/hub-energy-path.ts';
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

test('Поток огибает реальные секции, остаётся в границах экрана и непрерывен на телефоне, планшете и десктопе',()=>{
 for(const width of [320,391,768,1280,1920]){
  const input=layout(width),route=buildEnergyRoute(input),samples=route.main.samples;
  assert.deepEqual({x:samples[0].x,y:samples[0].y},input.source);
  assert.equal(samples.at(-1).y,input.footer.top+input.footer.height-12);
  assert.ok(samples.every((p,i)=>Number.isFinite(p.x+p.y+p.distance)&&p.x>=10&&p.x<=width-10&&(!i||p.y>samples[i-1].y&&p.distance>samples[i-1].distance)));
  assert.ok(Math.min(...samples.map(p=>p.x))<width*.15&&Math.max(...samples.map(p=>p.x))>width*.85,'траектория переходит с одной стороны страницы на другую');
  route.branches.forEach((branch,i)=>{
   const start=energyAtDistance(route.main,branch.startDistance),card=input.cards[i];
   assert.ok(Math.hypot(start.x-branch.path.samples[0].x,start.y-branch.path.samples[0].y)<.01,'ветка начинается точно на главном потоке');
   assert.deepEqual(branch.end,{x:card.left+card.width/2,y:card.top-2});
  });
 }
});

test('Граница потока управляется прокруткой в обе стороны и достигает финальной точки только у низа страницы',()=>{
 const input=layout(1280),{main}=buildEnergyRoute(input),height=input.footer.top+input.footer.height;
 assert.equal(energyFrontier(main,0,844,height,0),0);
 const scrolls=[4600,4900,5300,5800,6300,height-844];
 const forward=scrolls.map(y=>energyFrontier(main,y,844,height,1));
 assert.ok(forward.every((d,i)=>i===0||d>=forward[i-1]));
 assert.equal(forward.at(-1),main.length);
 assert.deepEqual([...scrolls].reverse().map(y=>energyFrontier(main,y,844,height,1)).reverse(),forward);
 const repeated=energyFrontier(main,5300,844,height,1);
 assert.equal(energyFrontier(main,5300,844,height,1),repeated,'время не продвигает границу');
 assert.ok(forward[0]<main.length*.3,'поток не появляется сразу по всей странице');
});

test('Перерасчёт после раскрытия вопроса сохраняет привязку к карточкам и сдвигает окончание вместе с подвалом',()=>{
 const input=layout(391),before=buildEnergyRoute(input);
 input.questions.height+=260;input.footer.top+=260;
 const after=buildEnergyRoute(input);
 assert.equal(after.end.y-before.end.y,260);
 assert.deepEqual(after.branches.map(b=>b.end),before.branches.map(b=>b.end));
 assert.ok(Math.abs(energyAtY(after.main,6000).y-6000)<.001);
});

test('Декоративный слой не создаёт элементов управления и отключается при уменьшенном движении',()=>{
 const x=setupDOM('',{reduced:true});try{
  const root=x.d.querySelector('[data-hub-energy]');
  assert.equal(root.getAttribute('aria-hidden'),'true');assert.ok(root.hasAttribute('inert'));
  assert.equal(root.dataset.energyState,'reduced');assert.equal(root.querySelector('a,button,input,canvas'),null);
  assert.equal(root.querySelectorAll('[data-energy-branch]').length,3);
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
