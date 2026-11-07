import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomHandheldCamera} from '../src/lib/room-handheld-camera.ts';
import {roomCameraSignal,roomCameraWearPose} from '../src/lib/room-camera-motion.ts';

test('Физическая камера имеет корпус, объектив, окуляр с отверстием и руку; подъём непрерывен и обратим',()=>{
 const camera=createRoomHandheldCamera();try{
  for(const name of ['body','lens','rubberEyecup','hand','strap','flipScreenGlass'])assert.ok(camera.rig.getObjectByName('HandheldCamera_'+name),name);
  const cup=camera.rig.getObjectByName('HandheldCamera_rubberEyecup');assert.equal(cup.geometry.parameters.shapes.holes.length,1,'Окуляр объёмный и имеет просвет');
  let previous=roomCameraWearPose(0).position;
  for(let i=0;i<=1000;i++){
   const wear=i/1000,pose=roomCameraWearPose(wear);assert.ok(pose.position.every(Number.isFinite));
   assert.ok(Math.hypot(...pose.position.map((n,j)=>n-previous[j]))<.008,'Без скачков при поднесении к глазу');previous=pose.position;
   camera.update(wear,1.6,61);const forward=camera.rig.position.toArray();camera.update(1-wear,1.6,61);camera.update(wear,1.6,61);assert.deepEqual(camera.rig.position.toArray(),forward);
  }
  assert.equal(roomCameraSignal(.7),0);assert.equal(roomCameraSignal(1),1);assert.equal(camera.update(0,1,61),false);assert.equal(camera.update(1,1,61),false);
  assert.ok(roomCameraWearPose(.28).position[1]<roomCameraWearPose(.64).position[1],'Камера действительно поднимается снизу');
 }finally{camera.dispose()}
});
