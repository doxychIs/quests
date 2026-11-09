import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {AnimationMixer,Group,PerspectiveCamera,Scene,Texture,Vector3,WebGLRenderTarget} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {HERO_PIN_END,HAND_ENTRY_END,HAND_HOLD_END,HAND_LEVER_LENGTH,entryClipProgress,introLetterProgress,handScrollState,handStagePose,smoothScrollProgress} from '../src/lib/hub-hand-motion.ts';
import {setupDOM} from './dom-harness.mjs';
import {createHandAtmosphere} from '../src/scripts/hub-atmosphere.ts';
import {createHandGlow} from '../src/scripts/hub-hand-glow.ts';

test('Скролл сначала вводит руку, затем держит открытую позу и только после этого отправляет название в шапку',()=>{
 assert.equal(HERO_PIN_END,.97);
 assert.equal(HAND_ENTRY_END,.64);
 assert.equal(HAND_HOLD_END,.665);
 assert.ok(HAND_HOLD_END-HAND_ENTRY_END<=.03,'полностью раскрытая поза задерживается лишь на короткий момент');
 assert.ok(1-HAND_HOLD_END>HAND_ENTRY_END*.5,'исчезновение занимает заметную часть сцены');
 assert.equal(entryClipProgress(0),0);assert.equal(entryClipProgress(1),1);
 const curve=Array.from({length:101},(_,i)=>entryClipProgress(i/100));
 assert.ok(curve.every((p,i)=>i===0||p>curve[i-1]),'входная кривая проходит кадры только вперёд');
 assert.ok(entryClipProgress(.5)>.28&&entryClipProgress(.5)<.4,'к середине входа кулак уже опустился, пальцы начинают раскрываться');
 assert.equal(entryClipProgress(.88),.64,'почти неподвижный хвост клипа занимает только последние 12% входа');
 for(const cue of [.12,.4,.88]){
  const delta=.000001,left=(entryClipProgress(cue)-entryClipProgress(cue-delta))/delta,right=(entryClipProgress(cue+delta)-entryClipProgress(cue))/delta;
  assert.ok(Math.abs(left-right)<.001,'скорость не скачет в местах смены движения');
 }
 for(let i=0;i<4;i++){
  assert.equal(introLetterProgress(6.5,10,i),0,'название не появляется до раскрытия ладони');
  assert.equal(introLetterProgress(9.1,10,i),1);
 }
 const initial=handScrollState(0,10);
 assert.equal(initial.time,0);assert.equal(initial.opacity,0);assert.equal(initial.docking,0);
 const entering=[.1,.2,.3,.4,HAND_ENTRY_END].map(p=>handScrollState(p,10));
 assert.ok(entering.every((s,i)=>s.docking===0&&(!i||s.time>entering[i-1].time)));
 for(const p of [HAND_ENTRY_END,.65,HAND_HOLD_END]){const s=handScrollState(p,10);assert.equal(s.time,10);assert.equal(s.docking,0);assert.equal(s.opacity,1)}
 const leaving=[.76,.8,.88,HERO_PIN_END,1].map(p=>handScrollState(p,10));
 assert.ok(leaving.every((s,i)=>!i||s.time<leaving[i-1].time&&s.docking>leaving[i-1].docking));
 assert.ok(handScrollState(HERO_PIN_END,10).opacity<.2);
 assert.equal(handScrollState(1,10).time,0);assert.equal(handScrollState(1,10).docking,1);assert.equal(handScrollState(1,10).opacity,0);
 const stops=[0,.16,.37,.58,.77,.92,1];
 assert.deepEqual([...stops].reverse().map(p=>handScrollState(p,10)).reverse(),stops.map(p=>handScrollState(p,10)));
});

test('Перспектива приближает руку из глубины; жёсткий рычаг сохраняет длину и движется по дуге без зеркального масштаба',()=>{
 for(const span of [.56,.90]){
  const pivot=new Group(),swing=new Group(),wrist=new Vector3(0,-HAND_LEVER_LENGTH,0);
  pivot.add(swing);
  const camera=new PerspectiveCamera(34,1,.02,8);camera.position.z=span/(2*Math.tan(34*Math.PI/360));camera.updateMatrixWorld();
  const points=[];
  for(let i=0;i<=100;i++){
   const pose=handStagePose(i/100,span);
   assert.ok(Object.values(pose).every(Number.isFinite));
   pivot.position.set(pose.pivotX,pose.pivotY,pose.pivotZ);swing.rotation.set(pose.rotationX,pose.rotationY,pose.rotationZ);pivot.updateMatrixWorld(true);
   const point=swing.localToWorld(wrist.clone());points.push(point);
   assert.ok(Math.abs(point.distanceTo(pivot.position)-HAND_LEVER_LENGTH)<1e-12,'поворот не растягивает предплечье');
   assert.deepEqual(pivot.scale.toArray(),[1,1,1]);assert.deepEqual(swing.scale.toArray(),[1,1,1]);
  }
  assert.ok(points.at(-1).z-points[0].z>1.4,'реальная глубина меняется, а не только размер картинки');
  assert.ok(Math.abs(points.at(-1).x-points[0].x)>.15,'траектория не сводится к вертикальному спуску');
  assert.ok(points.at(-1).y<points[0].y,'приближаясь, рука опускается');
  const projectedSize=point=>{
   const a=point.clone().project(camera),b=point.clone().add(new Vector3(.02,0,0)).project(camera);return b.x-a.x;
  };
  assert.ok(projectedSize(points.at(-1))>projectedSize(points[0])*1.8);
  assert.deepEqual(handStagePose(0,span),handStagePose(-1,span));assert.deepEqual(handStagePose(1,span),handStagePose(2,span));
 }
});

test('Плавное догоняние скролла не зависит от частоты кадров, медленно гасит рывки и работает в обе стороны',()=>{
 const values=[30,60,120].map(fps=>{let p=.1;for(let i=0;i<fps*.4;i++)p=smoothScrollProgress(p,.8,1/fps);return p});
 assert.ok(Math.max(...values)-Math.min(...values)<1e-10);
 assert.ok(values.every(p=>p>.1&&p<.8&&p<.72));
 const reverse=smoothScrollProgress(.8,.1,1/60);assert.ok(reverse>.1&&reverse<.8);
 assert.equal(smoothScrollProgress(.4,.8,0),.4);
 assert.equal(smoothScrollProgress(.79999,.8,1/60),.8);
});

test('Фоновая пыль ограничена на телефоне, скрывается в чёрном старте и полностью освобождает GPU-ресурсы',()=>{
 for(const compact of [false,true]){
  const scene=new Scene(),atmosphere=createHandAtmosphere(scene,compact);
  const objects=[...scene.children],dust=objects.find(o=>o.isPoints);
  assert.ok(dust.geometry.attributes.position.count<=(compact?100:200));
  atmosphere.update({presence:0,opening:0,progress:0},0,0,0);
  assert.ok(objects.every(o=>!o.visible));
  atmosphere.resize(390,844,1.25);
  atmosphere.update({presence:1,opening:1,progress:.6},12,.5,-.5);
  assert.ok(objects.every(o=>o.visible));
  let released=0;
  objects.forEach(o=>{o.geometry.addEventListener('dispose',()=>released++);o.material.addEventListener('dispose',()=>released++)});
  atmosphere.dispose();assert.equal(scene.children.length,0);assert.equal(released,objects.length*2);
 }
});

test('Сияние использует уменьшенные буферы, сохраняет активный render target и освобождает свою поверхность',()=>{
 const scene=new Scene(),source=new Texture(),original=new WebGLRenderTarget(8,8),passes=[];
 let active=original;
 const renderer={getRenderTarget:()=>active,setRenderTarget:value=>{active=value},render:()=>passes.push({width:active.width,height:active.height})};
 const glow=createHandGlow(renderer,source,scene);glow.resize(1280,800,1.5);glow.setStrength(1);
 glow.refresh();assert.equal(active,original);assert.equal(passes.length,2);
 assert.ok(passes.every(p=>p.width<=480&&p.height<=300),'сияние не создаёт полноразмерные дополнительные буферы');
 let released=0;const mesh=scene.children[0];
 mesh.geometry.addEventListener('dispose',()=>released++);mesh.material.addEventListener('dispose',()=>released++);
 glow.dispose();assert.equal(scene.children.length,0);assert.equal(released,2);source.dispose();original.dispose();
});

test('Настоящий утверждённый GLB декодируется: 10 секунд, 21 кость; скелет и ногти возвращаются из конца в исходные позы',async()=>{
 const bytes=fs.readFileSync('public/models/inoe-hand-animated.glb');
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'9516e7940f0b40570039a74b85e52726e6e2bf7dfa11dcd923a1ee7026b0769d');
 assert.ok(bytes.length<6.1e6);
 const data=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(data,'');
 assert.equal(gltf.animations.length,1);const clip=gltf.animations[0];
 assert.equal(clip.name,'INOE_Hand_10s');assert.equal(clip.duration,10);assert.equal(clip.tracks.length,69);
 const bones=[],skins=[];gltf.scene.traverse(o=>{if(o.isBone)bones.push(o);if(o.isSkinnedMesh)skins.push(o)});
 assert.equal(bones.length,21);assert.equal(skins.length,6);
 const mixer=new AnimationMixer(gltf.scene),action=mixer.clipAction(clip);action.play();action.paused=true;
 const snapshot=time=>{action.time=time;mixer.update(0);return {bones:bones.map(b=>[...b.position,...b.quaternion]),nails:skins.map(m=>[...m.morphTargetInfluences])}};
 const times=[0,2.8,5,7,10],forward=times.map(snapshot);
 assert.notDeepEqual(forward[0],forward[4]);
 assert.deepEqual([...times].reverse().map(snapshot).reverse(),forward);
 mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);
});

test('Спокойный режим сразу показывает заголовок и навигацию, не создаёт WebGL и сохраняет выбор темы других страниц',()=>{
 const x=setupDOM('',{reduced:true,theme:'light'});try{
  assert.equal(x.d.documentElement.dataset.siteTheme,'dark');assert.equal(x.w.localStorage.getItem('inoe-theme'),'light');
  const hero=x.d.querySelector('[data-hub-hero]');assert.equal(hero.dataset.introPhase,'reduced');
  assert.equal(hero.querySelector('canvas'),null);assert.equal(hero.querySelector('[data-hub-logo]').style.opacity,'1');
  assert.equal(x.d.querySelectorAll('[data-world-zone]').length,3);
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});
