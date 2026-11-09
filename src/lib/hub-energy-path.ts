export interface EnergyPoint{x:number;y:number}
export interface EnergyBox{left:number;top:number;width:number;height:number}
export interface EnergyLayout{
 width:number;viewport:number;source:EnergyPoint;cards:EnergyBox[];
}
export interface EnergySample extends EnergyPoint{distance:number}
export interface EnergyPath{d:string;samples:EnergySample[];length:number}
export const unit=(n:number)=>Math.max(0,Math.min(1,n));
const ease=(n:number)=>{const t=unit(n);return t*t*(3-2*t)};
/** The travelling ribbon starts only after the palm and wordmark have opened. */
export const energyVisibility=(heroProgress:number)=>ease((heroProgress-.64)/.13);

/** Monotone vertical cubic segments: bends stay inside the page and never loop through copy. */
export function energyPath(points:EnergyPoint[]):EnergyPath{
 const samples:EnergySample[]=[{...points[0],distance:0}];
 let d=`M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`,length=0;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dy=b.y-a.y;
  const c={x:a.x,y:a.y+dy*.46},e={x:b.x,y:b.y-dy*.46};
  d+=`C${c.x.toFixed(2)},${c.y.toFixed(2)} ${e.x.toFixed(2)},${e.y.toFixed(2)} ${b.x.toFixed(2)},${b.y.toFixed(2)}`;
  // Dense enough for a broad fabric surface: coarse centre lines kink its fine fibers.
  const steps=Math.max(24,Math.min(240,Math.ceil(Math.hypot(b.x-a.x,dy)/5)));
  for(let j=1;j<=steps;j++){
   const t=j/steps,s=1-t;
   const x=s*s*s*a.x+3*s*s*t*c.x+3*s*t*t*e.x+t*t*t*b.x;
   const y=s*s*s*a.y+3*s*s*t*c.y+3*s*t*t*e.y+t*t*t*b.y;
   const previous=samples[samples.length-1];length+=Math.hypot(x-previous.x,y-previous.y);
   samples.push({x,y,distance:length});
  }
 }
 return {d,samples,length};
}

function interpolate(path:EnergyPath,value:number,key:'y'|'distance'):EnergySample{
 const list=path.samples;
 if(value<=list[0][key])return {...list[0]};
 if(value>=list[list.length-1][key])return {...list[list.length-1]};
 let lo=0,hi=list.length-1;
 while(hi-lo>1){const mid=(lo+hi)>>1;if(list[mid][key]<value)lo=mid;else hi=mid}
 const a=list[lo],b=list[hi],t=(value-a[key])/Math.max(.00001,b[key]-a[key]);
 return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,distance:a.distance+(b.distance-a.distance)*t};
}
export const energyAtY=(path:EnergyPath,y:number)=>interpolate(path,y,'y');
export const energyAtDistance=(path:EnergyPath,distance:number)=>interpolate(path,distance,'distance');

export function buildEnergyRoute(layout:EnergyLayout){
 const {width:w,viewport:vh,source,cards}=layout;
 const compact=w<=760,gap=compact?48:76;
 const top=Math.min(...cards.map(c=>c.top));
 const junction={x:w*.5,y:top-gap};
 const points:EnergyPoint[]=[source];
 const add=(x:number,y:number)=>points.push({x:Math.max(10,Math.min(w-10,x)),y:Math.max(points[points.length-1].y+8,y)});
 add(w*(compact?.84:.80),source.y+Math.min(vh*.38,Math.max(16,(junction.y-source.y)*.48)));
 add(junction.x,junction.y);
 const main=energyPath(points);
 const branches=cards.map((card,i)=>{
  const start=points[points.length-1],end={x:card.left+card.width*.5,y:card.top-2};
  // Stacked cards receive separate coloured branches around their right edge.
  const branchPoints=compact&&i>0?[start,
   {x:w-(i===1?22:12),y:cards[0].top+cards[0].height*.25},
   {x:w-(i===1?22:12),y:card.top-gap},end]:[start,end];
  const path=energyPath(branchPoints);
  return {path,startDistance:main.length,end};
 });
 return {main,branches,end:points[points.length-1]};
}

/** Scroll sets the frontier. Elapsed time is used only for motes inside the revealed stream. */
export function energyFrontier(path:EnergyPath,scroll:number,viewport:number,heroProgress:number){
 const end=path.samples[path.samples.length-1],start=path.samples[0];
 const ahead=scroll+viewport*.82;
 const growth=energyVisibility(heroProgress);
 const y=start.y+Math.max(0,Math.min(end.y,ahead)-start.y)*growth;
 return energyAtY(path,y).distance;
}

/** Each coloured branch advances to its card after the main stream reaches the junction. */
export function energyBranchProgress(path:EnergyPath,scroll:number,viewport:number,heroProgress:number){
 const start=path.samples[0],end=path.samples[path.samples.length-1];
 return ease((scroll+viewport*.82-start.y)/Math.max(1,end.y-start.y+viewport*.12))*energyVisibility(heroProgress);
}
