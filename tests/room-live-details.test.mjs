import test from 'node:test';
import assert from 'node:assert/strict';
import {BufferGeometry,Float32BufferAttribute,Group,Mesh,MeshStandardMaterial} from 'three';
import {createRoomHands} from '../src/lib/room-hands.ts';
import {createRoomDisturbance,roomAtmosphereFrame} from '../src/lib/room-atmosphere.ts';
import {roomFocusPose,roomStages,roomStagePose,travelRoomPose} from '../src/lib/room-experience.ts';

test('Переходы к ноутбуку подходят к лицевой стороне и обходят его корпус и тумбочку',()=>{
 for(const aspect of [1.6,390/844,844/390]){
  const target=roomFocusPose('game',aspect);
  for(const stage of roomStages){
   const start=roomStagePose(stage.id,aspect);
   for(let i=0;i<=1000;i++){
    const p=travelRoomPose(start,target,i/1000).position;
    assert.equal(p[0]>-3.90&&p[0]<-2.54&&p[1]>.82&&p[1]<1.81&&p[2]>3.27&&p[2]<4.17,false,`${stage.id}: маршрут проходит сквозь ноутбук`);
   }
  }
 }
});

test('Существующая рука двигается только у выбранного корня и возвращается без накопления смещения',()=>{
 const root=new Group(),geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute([-1.5,2.19,8,-.6,2.19,8,1.5,1.46,8.7,.6,1.46,8.7],3));
 const mesh=new Mesh(geometry,new MeshStandardMaterial());mesh.name='Ward_Corridor_shadowed_skin';root.add(mesh);
 const rest=Array.from(geometry.attributes.position.array),hands=createRoomHands(root);
 hands.update(1,0);const moved=Array.from(geometry.attributes.position.array);
 assert.deepEqual(moved.slice(0,3),rest.slice(0,3),'Корень остаётся в штукатурке');
 assert.notDeepEqual(moved.slice(3,6),rest.slice(3,6),'Ладонь меняет положение');
 assert.deepEqual(moved.slice(6),rest.slice(6),'Другая рука не двигается синхронно');
 hands.update(1,0);assert.deepEqual(Array.from(geometry.attributes.position.array),moved,'Повтор кадра не накапливает деформацию');
 hands.update(0,0);assert.deepEqual(Array.from(geometry.attributes.position.array),rest);
 hands.update(.5,1);hands.dispose();assert.deepEqual(Array.from(geometry.attributes.position.array),rest);
 geometry.dispose();mesh.material.dispose();
});

test('Шевеление руки и падение капель — конечные события, после паузы движения отсутствуют',()=>{
 for(const kind of ['hand','drip']){
  const event=createRoomDisturbance(kind,1000,2,()=>.5);assert.ok(event.duration>=2000&&event.duration<=4000);
  assert.equal(roomAtmosphereFrame(event,999),undefined);assert.equal(roomAtmosphereFrame(event,1000+event.duration),undefined);
  const frames=Array.from({length:100},(_,i)=>roomAtmosphereFrame(event,1000+i*event.duration/100));
  assert.ok(frames.every(frame=>frame.lamp===1&&!frame.signal));
  if(kind==='hand'){assert.ok(frames.some(frame=>frame.hand>.1));assert.ok(frames.some(frame=>frame.hand<-.1));}
  else{assert.equal(frames[0].drip,0);assert.ok(frames.every((frame,i)=>i===0||frame.drip>frames[i-1].drip));}
 }
});

test('Видимые руки шевелятся независимо при неподвижной камере; уменьшенное движение возвращает исходную сетку',()=>{
 const root=new Group(),geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute([-1.5,2.19,8,-.7,2.19,8,1.5,1.46,8.7,.7,1.46,8.7],3));
 const mesh=new Mesh(geometry,new MeshStandardMaterial());mesh.name='Ward_Corridor_shadowed_skin';root.add(mesh);
 const rest=Array.from(geometry.attributes.position.array),hands=createRoomHands(root);
 hands.update(0,0,1000,10);const first=Array.from(geometry.attributes.position.array);
 hands.update(0,0,1800,10);const second=Array.from(geometry.attributes.position.array);
 assert.notDeepEqual(first,rest);assert.notDeepEqual(first,second,'Движение продолжается без прокрутки');
 assert.equal(second[0],rest[0]);assert.equal(second[6],rest[6],'Оба корня закреплены в стенах');
 assert.ok(Math.abs(second[3])>=.45&&Math.abs(second[9])>=.45,'Руки сохраняют центральный проход');
 hands.update(0,0,0,10);assert.deepEqual(Array.from(geometry.attributes.position.array),rest);
 hands.dispose();geometry.dispose();mesh.material.dispose();
});
