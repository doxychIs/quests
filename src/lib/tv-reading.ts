import {roomSize,screenHomography,type ScreenQuad} from './crt-room.ts';

type Matrix=[number,number,number,number,number,number,number,number,number];
function multiply(a:Matrix,b:Matrix):Matrix{
 return Array.from({length:9},(_,i)=>{const row=Math.floor(i/3),col=i%3;return a[row*3]*b[col]+a[row*3+1]*b[col+3]+a[row*3+2]*b[col+6]}) as Matrix;
}
function inverse(m:Matrix):Matrix{
 const [a,b,c,d,e,f,g,h,i]=m;
 const cof:Matrix=[e*i-f*h,c*h-b*i,b*f-c*e,f*g-d*i,a*i-c*g,c*d-a*f,d*h-e*g,b*g-a*h,a*e-b*d];
 const det=a*cof[0]+b*cof[3]+c*cof[6];
 if(Math.abs(det)<1e-12)throw new Error('Вырожденная камера телевизора');
 return cof.map(n=>n/det) as Matrix;
}

// Turn the photographed room toward the selected glass. The front-facing
// screen then fits the scene's HTML reading surface at a crisp 1:1 scale.
export function tvReadingCamera(quad:ScreenQuad,stageWidth:number,vw:number,vh:number){
 const compact=vw<=760,margin=compact?20:64,top=compact?70:80,bottom=compact?30:44;
 const width=Math.floor(Math.max(1,Math.min(vw-margin*2,(vh-top-bottom)*4/3)));
 const height=width*.75,left=(vw-width)/2,y=top+(vh-top-bottom-height)/2;
 const stageHeight=stageWidth*roomSize.height/roomSize.width,scale=stageWidth/roomSize.width;
 const stageLeft=(vw-stageWidth)/2,stageTop=(vh-stageHeight)/2;
 const h=screenHomography(quad);
 const target:Matrix=[width,0,left-stageLeft,0,height,y-stageTop,0,0,1];
 const pixels:Matrix=[1/scale,0,0,0,1/scale,0,0,0,1];
 const m=multiply(multiply(target,inverse([...h,1] as Matrix)),pixels);
 const n=m.map(v=>v/m[8]);
 const css=[n[0],n[3],0,n[6],n[1],n[4],0,n[7],0,0,1,0,n[2],n[5],0,1];
 return {css,width,height,left,top:y,stageLeft,stageTop};
}
