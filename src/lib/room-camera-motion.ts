import {roomEase} from './room-experience.ts';

export const roomCameraWait=1000;
export const roomCameraWearDuration=1800;
export const roomCameraRemoveDuration=1250;

/** The signal arrives at the eyepiece, after the physical device is raised. */
export function roomCameraSignal(wear:number){return roomEase((wear-.74)/.23);}

/** Camera-local metres/radians. Reversing wear lowers the same physical object. */
export function roomCameraWearPose(wear:number){
 const keys=[
  {at:0,position:[.28,-.66,-.65],rotation:[.24,-.53,-.30]},
  {at:.28,position:[.18,-.20,-.49],rotation:[.13,-.32,-.16]},
  {at:.64,position:[.065,-.038,-.29],rotation:[.035,-.12,-.035]},
  {at:1,position:[0,0,-.008],rotation:[0,0,0]},
 ];
 const t=Math.max(0,Math.min(1,wear));let i=1;while(i<keys.length-1&&t>keys[i].at)i++;
 const a=keys[i-1],b=keys[i],mix=roomEase((t-a.at)/(b.at-a.at));
 return{
  position:a.position.map((v,j)=>v+(b.position[j]-v)*mix) as [number,number,number],
  rotation:a.rotation.map((v,j)=>v+(b.rotation[j]-v)*mix) as [number,number,number],
  opacity:1-roomEase((t-.91)/.075),visible:t>0&&t<.985,
 };
}
