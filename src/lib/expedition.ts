export type Point={x:number;y:number};
export function shuffled<T>(items:readonly T[],random=Math.random):T[]{
 const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}return result;
}
export function sceneBag<T>(items:readonly T[],last:T|undefined,random=Math.random){
 const bag=shuffled(items,random);if(bag.length>1&&bag[0]===last)[bag[0],bag[1]]=[bag[1],bag[0]];return bag;
}
export const treasureNames=['Монета мореплавателя','Ключ от капитанского сундука','Медальон исследователя','Компас первой экспедиции'] as const;
const shores=[{x:25,y:48,rx:12,ry:18},{x:48,y:30,rx:11,ry:14},{x:64,y:55,rx:11,ry:17},{x:81,y:39,rx:8,ry:13}];
export function spawnTreasures(random=Math.random):Point[]{
 const points:Point[]=[];
 for(const shore of shuffled(shores,random)){
  let best:Point={x:shore.x,y:shore.y},bestDistance=0;
  for(let attempt=0;attempt<32;attempt++){
   const angle=random()*Math.PI*2,r=Math.sqrt(random())*.8;
   const p={x:shore.x+Math.cos(angle)*shore.rx*r,y:shore.y+Math.sin(angle)*shore.ry*r};
   const nearest=Math.min(...points.map(q=>treasureDistance(p,q)));
   if(nearest>bestDistance){best=p;bestDistance=nearest}if(nearest>=12)break;
  }
  points.push(best);
 }
 return points;
}
// Distances use the map's 1000×650 coordinate system, not viewport pixels.
export function treasureDistance(a:Point,b:Point){return Math.hypot(a.x-b.x,(a.y-b.y)*.65)}
export function detectorStrength(a:Point,b:Point){return Math.max(0,1-treasureDistance(a,b)/28)}
