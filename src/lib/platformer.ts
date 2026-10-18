export type Platform={x:number;y:number;w:number;move?:number;phase?:number};
export const platforms:Platform[]=[{x:0,y:365,w:300},{x:350,y:330,w:190},{x:590,y:290,w:180},{x:810,y:255,w:145,move:28,phase:0},{x:1020,y:330,w:260},{x:1340,y:280,w:180},{x:1570,y:245,w:160,move:26,phase:1.5},{x:1770,y:310,w:260},{x:2110,y:270,w:170},{x:2340,y:235,w:150},{x:2550,y:305,w:250},{x:2890,y:340,w:440}];
export const platformX=(p:Platform,time:number)=>p.x+(p.move?Math.sin(time*1.2+(p.phase||0))*p.move:0);
export class Platformer{
 x=70;y=333;vx=0;vy=0;grounded=true;on=-1;time=0;deaths=0;won=false;checkpoint={x:70,y:333};stars=[{x:670,y:245,got:false},{x:1650,y:190,got:false},{x:2640,y:260,got:false}];jumpHeld=false;
 reset(){Object.assign(this,new Platformer())}
 step(dt:number,axis:number,jump:boolean){if(this.won)return;dt=Math.min(dt,.03);this.time+=dt;const previousY=this.y;this.vx+=(axis*240-this.vx)*Math.min(1,dt*12);if(jump&&!this.jumpHeld&&this.grounded){this.vy=-550;this.grounded=false;this.on=-1}this.jumpHeld=jump;this.vy+=1450*dt;this.x=Math.max(0,Math.min(3310,this.x+this.vx*dt));this.y+=this.vy*dt;this.grounded=false;this.on=-1;
  if(this.vy>=0)for(let i=0;i<platforms.length;i++){const p=platforms[i],px=platformX(p,this.time);if(this.x+28>px&&this.x<px+p.w&&previousY+30<=p.y+2&&this.y+30>=p.y){this.y=p.y-30;this.vy=0;this.grounded=true;this.on=i;if(p.move)this.x+=(platformX(p,this.time+dt)-px);break}}
  if(this.grounded&&this.on===4)this.checkpoint={x:1100,y:300};if(this.grounded&&this.on===7)this.checkpoint={x:1840,y:280};for(const s of this.stars)if(Math.hypot(this.x+14-s.x,this.y+15-s.y)<34)s.got=true;
  if(this.y>520){this.x=this.checkpoint.x;this.y=this.checkpoint.y;this.vx=0;this.vy=0;this.deaths++;this.grounded=false}if(this.x>3220&&this.stars.every(s=>s.got))this.won=true;
 }
}
