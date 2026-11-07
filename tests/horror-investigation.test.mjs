import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {investigationCamera,investigationEase,investigationPoses} from '../src/lib/horror-investigation.ts';

// The former editorial background is no longer mounted. Its camera utility stays
// independently covered; current route/lifecycle tests live in room-experience.test.mjs.
const layout=['ward','evidence','connection','team','briefing'].map((key,i)=>({key,start:i*1400,height:1400}));
test('Камера плавно разгоняется и тормозит, останавливается в ракурсах и точно возвращается при обратной прокрутке',()=>{
 assert.equal(investigationEase(0),0);assert.equal(investigationEase(1),1);assert.ok(investigationEase(.1)<.02);assert.ok(investigationEase(.9)>.98);
 for(const chapter of layout){
  const at=chapter.start+750,p=investigationCamera(at,layout,800);
  assert.deepEqual(p.pose,investigationPoses[chapter.key]);
  assert.deepEqual(investigationCamera(at+20,layout,800).pose,p.pose);
 }
 for(let y=0;y<=7000;y+=17){
  const frame=investigationCamera(y,layout,800),before=investigationCamera(y-1,layout,800);
  assert.ok(frame.pose.fov>=58&&frame.pose.fov<=65);
  assert.ok(Math.abs(frame.pose.position[0])<=.5,'Камера остаётся в проходе, а не проезжает через койки');
  assert.ok(frame.pose.position[1]>=1.5&&frame.pose.position[1]<=1.75,'Высота соответствует взгляду человека');
  assert.ok(frame.pose.position[2]>=-4.7&&frame.pose.position[2]<=6.35,'Камера не проходит сквозь двери и стены');
  for(let axis=0;axis<3;axis++)assert.ok(Math.abs(frame.pose.position[axis]-before.pose.position[axis])<.05);
  assert.ok(frame.exposureDip>=0&&frame.exposureDip<=.13);
  assert.deepEqual(investigationCamera(y,layout,800),frame);
 }
});

test('Модель комнаты — настоящая геометрия с PBR и независимыми экранными поверхностями, исходник редактируется в Blender',()=>{
 const binary=fs.readFileSync('public/models/last-round-ward-v1.glb');
 assert.equal(binary.toString('utf8',0,4),'glTF');assert.equal(binary.readUInt32LE(4),2);
 const gltf=JSON.parse(binary.toString('utf8',20,20+binary.readUInt32LE(12)));
 assert.ok(binary.length<5*1024*1024,'Модель должна оставаться пригодной для веб-загрузки');
 assert.ok(gltf.meshes.length>=10&&gltf.meshes.length<=48,'Draw calls ограничены объединением неподвижных материалов');
 let triangles=0;
 for(const mesh of gltf.meshes)for(const primitive of mesh.primitives){
  triangles+=gltf.accessors[primitive.indices].count/3;
  assert.ok(primitive.attributes.NORMAL!==undefined);
 }
 assert.ok(triangles>20000&&triangles<100000,'В сцене объёмные предметы вместо плоскости с фотографией');
 assert.ok(gltf.materials.filter(m=>m.normalTexture&&m.pbrMetallicRoughness?.baseColorTexture&&m.pbrMetallicRoughness?.metallicRoughnessTexture).length>=7);
 const names=new Set(gltf.nodes.map(node=>node.name));
 for(const id of ['quest_0','quest_1','quest_2','quest_3'])assert.ok(names.has('RoomScreen_'+id),id);
 assert.equal([...names].filter(n=>n.startsWith('RoomScreen_quest_')).length,4,'В модели остаются только четыре действующих телевизора');
 assert.ok(names.has('RoomScreen_game'),'Ноутбук имеет собственное стекло');
 assert.ok(names.has('RoomFilmProjector')&&names.has('RoomFilmReel_0')&&names.has('RoomFilmReel_1'),'Проектор и катушки остаются редактируемыми объектами');
 assert.ok(fs.statSync('assets-source/horror-ward/last-round-ward.blend').size>1024*1024);
});
