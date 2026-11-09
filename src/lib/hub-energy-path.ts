export interface EnergyPoint{x:number;y:number}
export interface EnergyBox{left:number;top:number;width:number;height:number;bottomGap?:number}
export interface EnergyLayout{
 width:number;viewport:number;source:EnergyPoint;cards:EnergyBox[];
 about:EnergyBox;gift:EnergyBox;questions:EnergyBox;footer:EnergyBox;
}
export interface EnergySample extends EnergyPoint{distance:number}
export interface EnergyPath{d:string;samples:EnergySample[];length:number}
export const unit=(n:number)=>Math.max(0,Math.min(1,n));
const ease=(n:number)=>{const t=unit(n);return t*t*(3-2*t)};

/** Monotone vertical cubic segments: bends stay inside the page and never loop through copy. */
export function energyPath(points:EnergyPoint[]):EnergyPath{
 const samples:EnergySample[]=[{...points[0],distance:0}];
 let d=`M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`,length=0;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dy=b.y-a.y;
  const c={x:a.x,y:a.y+dy*.46},e={x:b.x,y:b.y-dy*.46};
  d+=`C${c.x.toFixed(2)},${c.y.toFixed(2)} ${e.x.toFixed(2)},${e.y.toFixed(2)} ${b.x.toFixed(2)},${b.y.toFixed(2)}`;
  for(let j=1;j<=24;j++){
   const t=j/24,s=1-t;
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
 const {width:w,viewport:vh,source,cards,about,gift,questions,footer}=layout;
 const compact=w<=760,gap=compact?48:76;
 const left=Math.max(12,Math.min(44,about.left*.48));
 const right=w-left,top=Math.min(...cards.map(c=>c.top));
 const bottom=Math.max(...cards.map(c=>c.top+c.height));
 const junction={x:w*.5,y:top-gap};
 const points:EnergyPoint[]=[source];
 const add=(x:number,y:number)=>points.push({x:Math.max(10,Math.min(w-10,x)),y:Math.max(points[points.length-1].y+8,y)});
 add(w*(compact?.84:.80),source.y+Math.min(vh*.38,Math.max(16,(junction.y-source.y)*.48)));
 add(junction.x,junction.y);
 add(right,top+cards[0].height*.30);
 add(right,bottom+20);
 add(left+10,about.top+Math.min(62,about.height*.14));
 add(left,about.top+about.height-Math.max(30,(about.bottomGap??128)-18));
 add(right,about.top+about.height-26);
 add(right-12,gift.top+Math.min(74,gift.height*.24));
 add(right,gift.top+gift.height-Math.max(30,(gift.bottomGap??118)-18));
 add(left,gift.top+gift.height-24);
 add(left+8,questions.top+Math.min(65,questions.height*.2));
 add(left,questions.top+questions.height-Math.max(30,(questions.bottomGap??110)-18));
 add(right,questions.top+questions.height-24);
 add(right,footer.top+Math.min(112,footer.height*.45));
 add(w*.5,footer.top+footer.height-12);
 const main=energyPath(points);
 const threads=[-1,1].map(side=>energyPath(points.map((p,i)=>({
  x:i===0||i===points.length-1?p.x:Math.max(10,Math.min(w-10,p.x+Math.sin(i*1.7+side)*side*(compact?4:9))),y:p.y,
 }))));
 const branches=cards.map(card=>{
  const start=energyAtY(main,card.top-gap),end={x:card.left+card.width*.5,y:card.top-2};
  const path=energyPath([start,end]);
  return {path,startDistance:start.distance,end};
 });
 return {main,threads,branches,end:points[points.length-1]};
}

/** Scroll sets the frontier. Elapsed time is used only for motes inside the revealed stream. */
export function energyFrontier(path:EnergyPath,scroll:number,viewport:number,pageHeight:number,heroProgress:number){
 const end=path.samples[path.samples.length-1],start=path.samples[0];
 const finish=ease((scroll-(pageHeight-viewport*1.8))/(viewport*.8));
 const ahead=scroll+viewport*(.82+.18*finish);
 const growth=ease((heroProgress-.015)/.19);
 const y=start.y+Math.max(0,Math.min(end.y,ahead)-start.y)*growth;
 return energyAtY(path,y).distance;
}
