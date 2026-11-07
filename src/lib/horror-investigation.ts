export type InvestigationKey='ward'|'evidence'|'connection'|'team'|'briefing';
export type InvestigationChapter={key:InvestigationKey;start:number;height:number};
export type InvestigationPose={position:[number,number,number];target:[number,number,number];fov:number};
const clamp=(v:number,min=0,max=1)=>Math.max(min,Math.min(max,v));
/** Fifth-order ease: the camera accelerates out of a held shot, then brakes into the next. */
export const investigationEase=(value:number)=>{const t=clamp(value);return t*t*t*(t*(t*6-15)+10)};
export const investigationPoses:Record<InvestigationKey,InvestigationPose>={
 ward:{position:[-.45,1.7,3.8],target:[2.4,1.15,1.6],fov:62},
 evidence:{position:[.3,1.55,1.1],target:[4.3,1.8,2.1],fov:58},
 connection:{position:[-.35,1.64,-1.7],target:[-2.7,1.3,-4.1],fov:58},
 team:{position:[.2,1.7,-3.7],target:[0,1.45,-7],fov:62},
 briefing:{position:[.1,1.65,-4.7],target:[.1,1,4.7],fov:65}
};
const opening:InvestigationPose={position:[-.3,1.72,6.35],target:[1.2,1.15,-1.9],fov:65};
function mix(a:InvestigationPose,b:InvestigationPose,t:number):InvestigationPose{
 if(t===0)return a;if(t===1)return b;
 const vector=(key:'position'|'target')=>a[key].map((value,i)=>value+(b[key][i]-value)*t) as [number,number,number];
 return {position:vector('position'),target:vector('target'),fov:a.fov+(b.fov-a.fov)*t};
}
/** Absolute scroll positions make reversing, deep links and resizing deterministic. */
export function investigationCamera(scroll:number,chapters:InvestigationChapter[],viewport:number){
 const vh=Math.max(1,viewport);let pose=opening,key:InvestigationKey='ward',transition=0;
 for(let i=0;i<chapters.length;i++){
  const chapter=chapters[i],from=i===0?0:Math.max(0,chapter.start-vh*.45),to=i===0?Math.min(vh*.68,chapter.height*.45):chapter.start+vh*.12;
  if(scroll<from)break;
  const progress=clamp((scroll-from)/Math.max(1,to-from));
  pose=mix(i===0?opening:investigationPoses[chapters[i-1].key],investigationPoses[chapter.key],investigationEase(progress));
  key=chapter.key;transition=progress>0&&progress<1?Math.sin(progress*Math.PI):0;
  if(progress<1)break;
 }
 return{pose,key,exposureDip:transition*.13};
}
