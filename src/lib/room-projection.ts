import {screenHomography,type ScreenQuad} from './crt-room.ts';
/** Map authored CSS pixel coordinates onto the four projected corners of actual glass. */
export function projectionCSS(quad:ScreenQuad,width:number,height:number){
 const h=screenHomography(quad),w=Math.max(1,width),v=Math.max(1,height);
 return[h[0]/w,h[3]/w,0,h[6]/w,h[1]/v,h[4]/v,0,h[7]/v,0,0,1,0,h[2],h[5],0,1];
}
