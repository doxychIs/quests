import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomDisturbance,roomAtmosphereFrame} from '../src/lib/room-atmosphere.ts';

const durations={light:1850,cloth:4600,pipe:2600,signal:1150};

test('Атмосфера состоит из ограниченных событий, а сила и момент старта воспроизводятся без собственного цикла',()=>{
 for(const [kind,duration] of Object.entries(durations)){
  let calls=0;
  const make=()=>createRoomDisturbance(kind,8250,2,()=>{calls++;return .4;});
  const first=make(),second=make();assert.deepEqual(first,second);assert.equal(calls,2,'Одно событие использует один независимый выбор силы');
  assert.equal(first.kind,kind);assert.equal(first.start,8250);assert.equal(first.duration,duration);assert.equal(first.fixture,2);
  assert.ok(Math.abs(first.strength-.82)<1e-12);
  for(const seed of [-10,0,.5,1,10]){
   const event=createRoomDisturbance(kind,100,3,()=>seed);
   assert.ok(event.strength>=.7&&event.strength<=1,'Случайная сила ограничена');
   assert.ok(event.duration>=1000&&event.duration<=4600,'Не существует бесконечного события');
  }
 }
});

test('За пределами окна события нет фоновых изменений, на старте лампа и предметы находятся в исходном состоянии',()=>{
 assert.equal(roomAtmosphereFrame(undefined,5000),undefined);
 for(const kind of Object.keys(durations)){
  const event=createRoomDisturbance(kind,5000,1,()=>1);
  for(const time of [0,4999,5000+event.duration,5001+event.duration,1e9])assert.equal(roomAtmosphereFrame(event,time),undefined);
  const start=roomAtmosphereFrame(event,5000);
  assert.deepEqual(start,{fixture:1,lamp:1,cloth:0,cable:0,signal:false,drift:0});
  const last=roomAtmosphereFrame(event,5000+event.duration-.001);
  assert.ok(last.lamp>.999&&Math.abs(last.cloth)<.001&&Math.abs(last.cable)<.001,'К окончанию события предметы возвращаются к покою');
 }
});

test('Неисправная лампа даёт два локальных провала с восстановлением между ними',()=>{
 const event=createRoomDisturbance('light',1000,3,()=>1);
 const dips=[];let inDip=false;
 for(let elapsed=0;elapsed<event.duration;elapsed+=5){
  const frame=roomAtmosphereFrame(event,event.start+elapsed);
  assert.equal(frame.fixture,3,'Событие влияет на один физический светильник');
  assert.ok(frame.lamp>=.1-1e-12&&frame.lamp<=1,'Провал одного светильника ограничен, без отрицательной интенсивности');
  assert.equal(frame.cloth,0);assert.equal(frame.cable,0);assert.equal(frame.signal,false);
  if(frame.lamp<.97&&!inDip){dips.push(elapsed);inDip=true;}else if(frame.lamp>=.97)inDip=false;
  if(elapsed>=400&&elapsed<=850)assert.equal(frame.lamp,1,'Между провалами есть спокойный участок');
 }
 assert.equal(dips.length,2,'Лампа не превращается в быстрый повторяющийся стробоскоп');
 assert.ok(dips[1]-dips[0]>=600);
 assert.equal(roomAtmosphereFrame(event,event.start+event.duration-1).lamp,1);
});

test('Ткань и провод имеют разные затухающие движения и не заставляют мигать неподвижные лампы',()=>{
 for(const kind of ['cloth','pipe']){
  const event=createRoomDisturbance(kind,0,0,()=>1),values=[];
  for(let elapsed=0;elapsed<event.duration;elapsed+=13){
   const frame=roomAtmosphereFrame(event,elapsed);values.push(kind==='cloth'?frame.cloth:frame.cable);
   assert.equal(frame.lamp,1);assert.equal(frame.signal,false);
   assert.ok(Math.abs(frame.cloth)<=1&&Math.abs(frame.cable)<=1);
   assert.equal(kind==='cloth'?frame.cable:frame.cloth,0,'Шорох ткани и удар по трубе не двигают все предметы одинаково');
  }
  assert.ok(values.some(value=>value>.05)&&values.some(value=>value<-.05),'Малое колебание проходит по обе стороны исходной точки');
  if(kind==='pipe'){
   const first=Math.max(...values.slice(0,Math.floor(values.length/3)).map(Math.abs));
   const last=Math.max(...values.slice(Math.floor(values.length*2/3)).map(Math.abs));
   assert.ok(first>last*4,'Отклик провода затухает после металлического стука');
  }
 }
});

test('Помеха видеосигнала кратковременна и не связана с освещением комнаты или движением мебели',()=>{
 const event=createRoomDisturbance('signal',200,0,()=>1);let disrupted=0;
 for(let elapsed=0;elapsed<event.duration;elapsed++){
  const frame=roomAtmosphereFrame(event,event.start+elapsed);
  assert.equal(frame.signal,elapsed>160&&elapsed<320);disrupted+=Number(frame.signal);
  assert.equal(frame.lamp,1);assert.equal(frame.cloth,0);assert.equal(frame.cable,0);
  assert.ok(Number.isFinite(frame.drift));
 }
 assert.equal(disrupted,159,'Нарушение синхронизации длится менее 160 мс и завершается');
});
