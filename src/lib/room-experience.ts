export type RoomStationId='team'|'gallery'|'projector'|'game'|'quest_0'|'quest_1'|'quest_2'|'quest_3'|'info'|'door';
export type RoomStage='entry'|'team'|'ward'|'gallery'|'game'|'quests'|'info';
export type RoomPose={position:[number,number,number];target:[number,number,number];fov:number};
export type RoomStation={id:RoomStationId;center:[number,number,number];width:number;height:number;label:string;group:RoomStage;kind?:'wall'|'door'|'laptop'|'projection'|'projector';rotationY?:number};
export const roomStations:RoomStation[]=[
 {id:'team',center:[4.345,2.15,4.05],width:2.60,height:1.86,label:'Состав команды',group:'team',kind:'wall',rotationY:-Math.PI/2},
 {id:'game',center:[-3.22,1.29,3.45],width:.96,height:.69,label:'Мини-игра',group:'game',kind:'laptop'},
 {id:'gallery',center:[-6.90,1.91,-9.5],width:2.55,height:1.83,label:'Галерея',group:'gallery',kind:'projection',rotationY:Math.PI/2},
 {id:'projector',center:[-3.8,1.55,-10.65],width:1.25,height:1.5,label:'Включить или выключить кинопроектор',group:'gallery',kind:'projector',rotationY:Math.PI/2},
 {id:'quest_0',center:[-2.7,1.82,-5.75],width:1.10,height:.80,label:'ПАЛАТА 06',group:'quests'},
 {id:'quest_1',center:[-1.4,1.82,-5.75],width:1.10,height:.80,label:'НЕ ОТВЕЧАЙ',group:'quests'},
 {id:'quest_2',center:[1.4,1.82,-5.75],width:1.10,height:.80,label:'ПОСЛЕДНЯЯ СМЕНА',group:'quests'},
 {id:'quest_3',center:[2.7,1.82,-5.75],width:1.10,height:.80,label:'ЛЕСНИК',group:'quests'},
 {id:'info',center:[-.55,1.70,-10.95],width:1.78,height:1.28,label:'Контакты и правила',group:'info',kind:'wall'},
 {id:'door',center:[0,1.3,-6.94],width:1.5,height:2.5,label:'Пройти за дверь — информация сайта',group:'info',kind:'door'}
];
export const roomStages:{id:RoomStage;anchor:number;label:string;surface?:RoomStationId;hash:string}[]=[
 {id:'entry',anchor:0,label:'Вход',hash:'atmosphere'},
 {id:'team',anchor:5,label:'Команда',surface:'team',hash:'team'},
 {id:'ward',anchor:8,label:'Палата',hash:'details'},
 {id:'game',anchor:11,label:'Мини-игра',surface:'game',hash:'trial'},
 {id:'quests',anchor:14,label:'Квесты',hash:'quests'},
 {id:'gallery',anchor:19,label:'Галерея',surface:'gallery',hash:'frames'},
 {id:'info',anchor:23,label:'Контакты и правила',surface:'info',hash:'footer'}
];
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
export const roomEase=(x:number)=>{const t=clamp(x);return t*t*t*(10+t*(-15+6*t))};
const corridorStart=.2,corridorArrival=2.8;
/** Distance through the opening shot, driven only by native page scroll. */
export function roomCorridorProgress(scroll:number,viewport:number){
 return roomEase((Math.max(0,scroll)/Math.max(1,viewport)-corridorStart)/(corridorArrival-corridorStart));
}
export function mixRoomPose(a:RoomPose,b:RoomPose,t:number):RoomPose{
 t=clamp(t);if(t===0)return a;if(t===1)return b;
 const angles=(p:RoomPose)=>{const [x,y,z]=p.target.map((v,i)=>v-p.position[i]);return{yaw:Math.atan2(x,-z),pitch:Math.atan2(y,Math.hypot(x,z)),length:Math.hypot(x,y,z)};};
 const from=angles(a),to=angles(b),raw=to.yaw-from.yaw;
 let turn=Math.atan2(Math.sin(raw),Math.cos(raw));
 if(Math.abs(Math.abs(turn)-Math.PI)<1e-8)turn=Math.sign(raw)*Math.PI;
 const yaw=from.yaw+turn*t,pitch=from.pitch+(to.pitch-from.pitch)*t,length=from.length+(to.length-from.length)*t;
 const position=a.position.map((v,i)=>v+(b.position[i]-v)*t) as RoomPose['position'];
 // Interpolate the viewing direction, not world-space look-at points: opposite
 // walls otherwise collapse the view vector to zero and cause a 180° snap.
 const offset=[Math.sin(yaw)*Math.cos(pitch)*length,Math.sin(pitch)*length,-Math.cos(yaw)*Math.cos(pitch)*length];
 return{position,target:position.map((v,i)=>v+offset[i]) as RoomPose['target'],fov:a.fov+(b.fov-a.fov)*t};
}
/** Route around cabinets via the open aisle when a direct camera move would enter one. */
export function travelRoomPose(a:RoomPose,b:RoomPose,t:number):RoomPose{
 const progress=clamp(t),direct=mixRoomPose(a,b,progress);
 if(progress===0)return a;if(progress===1)return b;
 type Point=[number,number,number];
 // A slab intersection catches short corner crossings that sampled lines miss.
 const blocked=(from:Point,to:Point)=>{
  for(const wallX of [-1.85,-1.7,-1.55]){
   const dx=to[0]-from[0],u=Math.abs(dx)>1e-9?(wallX-from[0])/dx:-1;
   if(u>=0&&u<=1){const z=from[2]+(to[2]-from[2])*u;if(z<-7.3&&(z>-8.7||z<-10))return true;}
  }
  // A TV selected from the corridor must pass through the actual doorway,
  // rather than take a diagonal shortcut through the front wall of the ward.
  for(const z of [-7.3,-7,-6.7,6.7,7,7.3]){
   const dz=to[2]-from[2];
   if(Math.abs(dz)<1e-9){if(Math.abs(from[2]-z)<.01&&Math.max(Math.abs(from[0]),Math.abs(to[0]))>.55)return true;continue;}
   const u=(z-from[2])/dz;
   if(u>=0&&u<=1&&Math.abs(from[0]+(to[0]-from[0])*u)>.55)return true;
  }
  return roomStations.filter(station=>!station.kind||station.kind==='laptop').some(station=>{
  const [x,y,z]=station.center;
  const laptop=station.kind==='laptop';
  const low=laptop?[x-.68,.82,z-.18]:[x-station.width*.65-.12,y-station.height*.7-.12,z-.8];
  const high=laptop?[x+.68,1.81,z+.72]:[x+station.width*.83+.12,y+station.height*.7+.12,z+.09];
  let enter=0,leave=1;
  for(let axis=0;axis<3;axis++){
   const delta=to[axis]-from[axis];
   if(Math.abs(delta)<1e-9){if(from[axis]<=low[axis]||from[axis]>=high[axis])return false;}
   else{const one=(low[axis]-from[axis])/delta,two=(high[axis]-from[axis])/delta;enter=Math.max(enter,Math.min(one,two));leave=Math.min(leave,Math.max(one,two));if(enter>=leave)return false;}
  }
  return enter<leave&&leave>0&&enter<1;
  });
 };
 if(!blocked(a.position,b.position))return direct;
 const cinema=(point:Point)=>point[0]<-1.85&&point[2]<-7.3;
 const points:Point[]=[a.position,
  ...(cinema(a.position)?[[a.position[0],a.position[1],-9.35],[0,a.position[1],-9.35]] as Point[]:[[0,a.position[1],a.position[2]]] as Point[]),
  ...(cinema(b.position)?[[0,b.position[1],-9.35],[b.position[0],b.position[1],-9.35]] as Point[]:[[0,b.position[1],b.position[2]]] as Point[]),b.position];
 const distances=points.slice(1).map((p,i)=>Math.hypot(...p.map((v,j)=>v-points[i][j])));
 const total=distances.reduce((sum,n)=>sum+n,0);let distance=progress*total,index=0;
 while(index<distances.length-1&&distance>distances[index]){distance-=distances[index];index++;}
 const u=roomEase(distances[index]>1e-9?distance/distances[index]:1);
 // Stay inside each clear segment. An unconstrained Catmull-Rom spline can
 // overshoot behind a cabinet even when all its control points are safe.
 const direction=direct.target.map((v,i)=>v-direct.position[i]);
 direct.position=points[index].map((value,axis)=>value+(points[index+1][axis]-value)*u) as Point;
 direct.target=direct.position.map((v,i)=>v+direction[i]) as Point;
 return direct;
}
/** Frontal glass view: canvas pointer coordinates and reading stay exact. */
export function roomFocusPose(id:RoomStationId,aspect:number):RoomPose{
 if(id==='projector')return roomStagePose('gallery',aspect);
 const station=roomStations.find(s=>s.id===id)!,fit=aspect<.8?.94:.86,ratio=Math.max(.3,aspect);
 let fov=aspect<.8?73:48,half=Math.tan(fov*Math.PI/360);
 let distance=Math.max(station.width/(2*half*ratio*fit),station.height/(2*half*.73));
 // The information monitor stands behind the gallery TV. A portrait camera
 // must widen its lens and stay in front of its target, behind that cabinet.
 for(const other of roomStations.filter(other=>!other.kind&&!station.kind)){
  if(other===station||other.center[2]<=station.center[2])continue;
  const [x,y,z]=other.center;
  if(station.center[0]<=x-other.width*.65-.12||station.center[0]>=x+other.width*.83+.12||station.center[1]<=y-other.height*.7-.12||station.center[1]>=y+other.height*.7+.12)continue;
  const limit=z-.8-.18-station.center[2];
  if(limit>0&&distance>limit){distance=limit;half=Math.max(station.width/(2*distance*ratio*fit),station.height/(2*distance*.73));fov=Math.atan(half)*360/Math.PI;}
 }
 const rotation=station.rotationY||0;
 // The bedside notice faces into the ward, with the bed below the reading plane.
 if(id==='team'){
  distance=Math.max(distance,3.2);
  // An off-centre frame leaves the bloodied mattress below the notice in shot.
  return{position:[station.center[0]-distance,1.85,station.center[2]],target:[station.center[0],1.85,station.center[2]],fov};
 }
 return{position:[station.center[0]+Math.sin(rotation)*distance,station.center[1],station.center[2]+Math.cos(rotation)*distance],target:[...station.center],fov};
}
export function roomStagePose(stage:RoomStage,aspect:number):RoomPose{
 if(stage==='info')return{position:[-.12,1.70,aspect<.8?-7.52:-8.95],target:[-.12,1.70,-10.95],fov:aspect<.8?92:48};
 if(stage==='entry')return{position:[.06,1.66,19.3],target:[-.02,1.58,11.1],fov:aspect<.8?73:61};
 if(stage==='ward')return{position:[.1,1.75,3.5],target:[.15,.48,-.45],fov:aspect<.8?78:64};
 if(stage==='quests')return{position:[0,1.95,aspect<.8?3.9:-.75],target:[0,1.82,-5.75],fov:aspect<.8?73:62};
 if(stage==='gallery')return aspect<.8?{position:[.55,1.90,-9.25],target:[-6.5,1.8,-9.65],fov:76}:{position:[-2.05,1.90,-7.95],target:[-5.2,1.75,-9.65],fov:70};
 return roomFocusPose(stage,aspect);
}
/** The original ward composition is held after the corridor, before any TV. */
export function roomOverviewPose(aspect:number):RoomPose{
 return{position:[-.12,1.73,6.3],target:[0,1.55,-2.2],fov:aspect<.8?73:61};
}
function roomEntryPose(scroll:number,viewport:number,aspect:number):RoomPose{
 const progress=roomCorridorProgress(scroll,viewport);
 if(progress===0)return roomStagePose('entry',aspect);if(progress===1)return roomOverviewPose(aspect);
 const pose=mixRoomPose(roomStagePose('entry',aspect),roomOverviewPose(aspect),progress);
 // A small camera operator drift is spatial, not a time loop: stopping the
 // scroll stops the camera, and reversing retraces exactly the same shot.
 const envelope=Math.sin(Math.PI*progress);
 pose.position[0]+=Math.sin(progress*Math.PI*3)*envelope*.055;
 pose.position[1]+=Math.sin(progress*Math.PI*5)*envelope*.018;
 pose.target[0]+=Math.sin(progress*Math.PI*2)*envelope*.09;
 pose.target[1]+=Math.sin(progress*Math.PI*3)*envelope*.026;
 return pose;
}
/** Held viewpoints connected by smooth reversible travel, all in one coordinate system. */
export function roomCamera(scroll:number,viewport:number,aspect:number){
 const unit=Math.max(0,scroll)/Math.max(1,viewport);let index=0,pose=roomEntryPose(scroll,viewport,aspect),settled=unit<=corridorStart||unit>=corridorArrival;
 for(let i=1;i<roomStages.length;i++){
  const from=i===1?corridorArrival+.7:roomStages[i-1].anchor+.7,to=roomStages[i].anchor-.18;
  if(unit<from)break;
  const progress=clamp((unit-from)/(to-from));
  const previous=i===1?roomOverviewPose(aspect):roomStagePose(roomStages[i-1].id,aspect);
  pose=travelRoomPose(previous,roomStagePose(roomStages[i].id,aspect),roomEase(progress));
  index=progress>.58?i:i-1;settled=progress===1;
  if(progress<1)break;
 }
 return{pose,stage:roomStages[index].id,index,settled};
}
