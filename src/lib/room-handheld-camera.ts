import {BoxGeometry,CylinderGeometry,ExtrudeGeometry,Group,HemisphereLight,Mesh,MeshStandardMaterial,Path,PerspectiveCamera,PointLight,Scene,Shape,SphereGeometry,type BufferGeometry} from 'three';
import {roomCameraWearPose} from './room-camera-motion.ts';

/** A small, camera-local prop, rendered only during the bounded wearing motion.
 * It shares the room's pixel/camera transfer and uses the existing WebGL context. */
export function createRoomHandheldCamera(){
 const scene=new Scene(),eye=new PerspectiveCamera(61,1,.005,3),rig=new Group();scene.add(rig);
 scene.add(new HemisphereLight('#bcc7c1','#1e2529',2.1));
 const light=new PointLight('#c1cdc1',9,3,2);light.position.set(-.6,.7,.8);scene.add(light);
 const geometries=new Set<BufferGeometry>(),materials=new Set<MeshStandardMaterial>();
 const material=(color:string,roughness=.75,metalness=0)=>{const m=new MeshStandardMaterial({color,roughness,metalness});materials.add(m);return m;};
 const shell=material('#333d3d',.69,.24),edge=material('#59635e',.54,.32),rubber=material('#131a1b',.96),grip=material('#232a29',.95),skin=material('#8d8b77',.89),sleeve=material('#303b39',.98),glass=material('#142a2c',.24,.25),led=material('#68302b');
 glass.emissive.set('#2b5148');glass.emissiveIntensity=.24;led.emissive.set('#8e3029');led.emissiveIntensity=.4;
 function mesh(name:string,geometry:BufferGeometry,mat:MeshStandardMaterial,position:[number,number,number],parent=rig){
  geometries.add(geometry);const object=new Mesh(geometry,mat);object.name=name;object.position.set(...position);parent.add(object);return object;
 }
 const box=(name:string,size:[number,number,number],mat:MeshStandardMaterial,at:[number,number,number],parent=rig)=>mesh(name,new BoxGeometry(...size),mat,at,parent);
 function housing(name:string,w:number,h:number,depth:number,at:[number,number,number]){
  const shape=new Shape();shape.moveTo(-w/2,-h/2);shape.lineTo(w/2,-h/2);shape.lineTo(w/2,h/2);shape.lineTo(-w/2,h/2);shape.closePath();
  return mesh(name,new ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:true,bevelSegments:1,bevelSize:.006,bevelThickness:.005,curveSegments:1}),shell,at);
 }
 housing('HandheldCamera_body',.23,.145,.27,[.164,-.025,-.36]);
 housing('HandheldCamera_tapeDoor',.012,.116,.175,[.287,-.026,-.315]);
 box('HandheldCamera_battery',[.18,.12,.051],grip,[.173,-.028,-.069]);
 // Objective points down the corridor (-Z); the operator sees the rear controls.
 const barrel=mesh('HandheldCamera_lens',new CylinderGeometry(.066,.072,.106,16),rubber,[.157,-.026,-.414]);barrel.rotation.x=Math.PI/2;
 const rim=mesh('HandheldCamera_lensRing',new CylinderGeometry(.071,.071,.015,20),edge,[.157,-.026,-.47]);rim.rotation.x=Math.PI/2;
 const lens=mesh('HandheldCamera_lensGlass',new CylinderGeometry(.058,.058,.008,20),glass,[.157,-.026,-.481]);lens.rotation.x=Math.PI/2;
 for(let i=0;i<6;i++)box('HandheldCamera_focusRib_'+i,[.006,.13,.004],grip,[.115+i*.016,-.024,-.092]);
 box('HandheldCamera_topHandle',[.17,.021,.028],rubber,[.165,.119,-.228]);
 for(const z of [-.29,-.16])box('HandheldCamera_handlePost',[.025,.054,.025],edge,[.165,.082,z]);
 box('HandheldCamera_strap',[.014,.094,.18],rubber,[.305,-.035,-.20]);
 // The eyecup is real geometry with an opening and a short, dark inner hood.
 const cup=new Shape();cup.moveTo(-.050,-.043);cup.lineTo(.050,-.043);cup.lineTo(.064,-.028);cup.lineTo(.064,.028);cup.lineTo(.050,.043);cup.lineTo(-.050,.043);cup.lineTo(-.064,.028);cup.lineTo(-.064,-.028);cup.closePath();
 const aperture=new Path();aperture.moveTo(-.043,-.028);aperture.lineTo(-.043,.028);aperture.lineTo(.043,.028);aperture.lineTo(.043,-.028);aperture.closePath();cup.holes.push(aperture);
 mesh('HandheldCamera_rubberEyecup',new ExtrudeGeometry(cup,{depth:.037,steps:1,bevelEnabled:true,bevelSegments:1,bevelSize:.004,bevelThickness:.003}),rubber,[0,0,-.037]);
 box('HandheldCamera_viewfinderSupport',[.12,.03,.027],edge,[.106,-.012,-.040]);
 const monitor=new Group();monitor.position.set(.33,-.005,-.23);monitor.rotation.y=.58;rig.add(monitor);
 box('HandheldCamera_flipScreenFrame',[.108,.083,.012],rubber,[-.035,0,0],monitor);
 box('HandheldCamera_flipScreenGlass',[.089,.064,.003],glass,[-.035,0,.008],monitor);
 // Faded battery/tape marks on the physical LCD, not a second DOM overlay.
 for(let i=0;i<4;i++)box('HandheldCamera_lcdMark_'+i,[.007,.003,.001],edge,[-.066+i*.012,.022,.011],monitor);
 mesh('HandheldCamera_recordLamp',new SphereGeometry(.004,6,4),led,[.245,.031,-.039]);
 for(let i=0;i<3;i++){
  const button=mesh('HandheldCamera_rearButton_'+i,new CylinderGeometry(.008,.008,.004,8),grip,[.243,-.005-i*.025,-.039]);button.rotation.x=Math.PI/2;
 }
 for(let i=0;i<11;i++)box('HandheldCamera_wornEdge_'+i,[.009+(i%3)*.003,.001,.001],edge,[.073+(i*.017)% .18,.05-(i%4)*.025,-.083]);
 // A supporting hand and jacket cuff make this a deliberate lift to the face.
 const hand=new Group();hand.position.set(.285,-.13,-.16);hand.rotation.z=-.19;rig.add(hand);
 const palm=mesh('HandheldCamera_hand',new SphereGeometry(1,8,6),skin,[0,.026,0],hand);palm.scale.set(.038,.067,.038);
 for(let i=0;i<4;i++){
  const finger=mesh('HandheldCamera_finger_'+i,new CylinderGeometry(.011,.013,.065,6),skin,[-.018+i*.013,.062,-.033],hand);finger.rotation.x=-.7;
  const knuckle=mesh('HandheldCamera_knuckle_'+i,new SphereGeometry(.012,6,4),skin,[-.018+i*.013,.083,-.052],hand);knuckle.scale.y=.85;
 }
 const thumb=mesh('HandheldCamera_thumb',new CylinderGeometry(.014,.017,.068,6),skin,[-.033,.018,.013],hand);thumb.rotation.z=-.55;
 const cuff=mesh('HandheldCamera_jacketCuff',new CylinderGeometry(.047,.054,.12,8),sleeve,[.007,-.071,.017],hand);cuff.rotation.x=-.2;
 const arm=mesh('HandheldCamera_forearm',new CylinderGeometry(.049,.067,.29,8),sleeve,[.022,-.245,.065],hand);arm.rotation.x=-.25;
 return{
  scene,eye,rig,
  update(wear:number,aspect:number,fov:number){
   const pose=roomCameraWearPose(wear);rig.visible=pose.visible;rig.position.set(...pose.position);rig.rotation.set(...pose.rotation);
   const portrait=aspect<.8;rig.scale.setScalar(portrait?.82:1);if(portrait)rig.position.x-=.33*(1-wear);
   for(const m of materials){m.opacity=pose.opacity;m.transparent=pose.opacity<1;}
   eye.aspect=aspect;eye.fov=fov;eye.updateProjectionMatrix();return rig.visible;
  },
  dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());},
 };
}
