export type LogoRect={left:number;top:number;width:number;height:number};
export function logoProgress(scroll:number,travel:number){
 const p=Math.max(0,Math.min(1,scroll/Math.max(1,travel)));
 return p*p*(3-2*p);
}
/** Interpolate centres before scaling so both endpoints align exactly, in either direction. */
export function logoPose(from:LogoRect,to:LogoRect,progress:number){
 const p=Math.max(0,Math.min(1,progress));
 const scale=1+(to.width/Math.max(1,from.width)-1)*p;
 const centreX=from.left+from.width/2+(to.left+to.width/2-from.left-from.width/2)*p;
 const centreY=from.top+from.height/2+(to.top+to.height/2-from.top-from.height/2)*p;
 const arc=Math.sin(Math.PI*p);
 return{x:centreX-from.width*scale/2-arc*from.width*.025,y:centreY-from.height*scale/2-arc*Math.min(90,Math.abs(from.top-to.top)*.1),scale};
}
