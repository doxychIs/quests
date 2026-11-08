import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {AnimationMixer} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {HERO_PIN_END,introLetterProgress,handScrollState} from '../src/lib/hub-hand-motion.ts';
import {setupDOM} from './dom-harness.mjs';

test('Скролл сначала вводит руку, затем держит открытую позу и только после этого отправляет название в шапку',()=>{
 for(let i=0;i<4;i++){
  assert.equal(introLetterProgress(3.2,10,i),0);
  assert.equal(introLetterProgress(6.4,10,i),1);
 }
 const initial=handScrollState(0,10);
 assert.equal(initial.time,0);assert.equal(initial.opacity,0);assert.equal(initial.docking,0);
 const entering=[.1,.2,.3,.4,.54].map(p=>handScrollState(p,10));
 assert.ok(entering.every((s,i)=>s.docking===0&&(!i||s.time>entering[i-1].time)));
 for(const p of [.54,.58,.62]){const s=handScrollState(p,10);assert.equal(s.time,10);assert.equal(s.docking,0);assert.equal(s.opacity,1)}
 const leaving=[.65,.75,.85,HERO_PIN_END,1].map(p=>handScrollState(p,10));
 assert.ok(leaving.every((s,i)=>!i||s.time<leaving[i-1].time&&s.docking>leaving[i-1].docking));
 assert.ok(handScrollState(HERO_PIN_END,10).opacity<.2);
 assert.equal(handScrollState(1,10).time,0);assert.equal(handScrollState(1,10).docking,1);assert.equal(handScrollState(1,10).opacity,0);
 const stops=[0,.16,.37,.58,.77,.92,1];
 assert.deepEqual([...stops].reverse().map(p=>handScrollState(p,10)).reverse(),stops.map(p=>handScrollState(p,10)));
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
