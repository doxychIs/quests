export type Point={x:number;y:number};
export const mazePath:Point[]=[{x:65,y:365},{x:260,y:365},{x:260,y:245},{x:465,y:245},{x:465,y:105},{x:705,y:105},{x:705,y:330},{x:920,y:330}];
export const mazeCheckpoints=[mazePath[2],mazePath[4],mazePath[6]];
export const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
export function segmentDistance(p:Point,a:Point,b:Point){const dx=b.x-a.x,dy=b.y-a.y;const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return distance(p,{x:a.x+t*dx,y:a.y+t*dy})}
export function insideMaze(p:Point){return mazePath.slice(1).some((b,i)=>segmentDistance(p,mazePath[i],b)<=17)}
export class Maze {
 pos:Point={...mazePath[0]};checkpoint:Point={...mazePath[0]};stage=0;mistakes=0;won=false;
 reset(){this.pos={...mazePath[0]};this.checkpoint={...mazePath[0]};this.stage=0;this.mistakes=0;this.won=false}
 move(target:Point){if(this.won)return 'won';const d=distance(this.pos,target);const samples=Math.max(1,Math.ceil(d/3));const start={...this.pos};
  for(let i=1;i<=samples;i++){const p={x:start.x+(target.x-start.x)*i/samples,y:start.y+(target.y-start.y)*i/samples};if(!insideMaze(p)){this.pos={...this.checkpoint};this.mistakes++;return 'wall'}this.pos=p;if(this.stage<3&&distance(p,mazeCheckpoints[this.stage])<17){this.checkpoint={...mazeCheckpoints[this.stage]};this.stage++}if(this.stage===3&&distance(p,mazePath.at(-1)!)<15){this.won=true;return 'won'}}return 'move';
 }
}
