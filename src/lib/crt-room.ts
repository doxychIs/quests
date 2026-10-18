export type ScreenPoint={x:number;y:number};
export type ScreenQuad=[ScreenPoint,ScreenPoint,ScreenPoint,ScreenPoint];
export type RoomScreen={id:string;kind:'quest'|'ambient';slug?:string;description:string;quad:ScreenQuad;depth:number;radius:number};
export const roomSize={width:1280,height:720};
// Координаты внутреннего стекла: верхний левый, верхний правый,
// нижний правый, нижний левый. Корпуса остаются частью единой декорации.
export const roomScreens:RoomScreen[]=[
 {id:'wood-floor',kind:'quest',slug:'palata-06',description:'Большой телевизор на столе слева',depth:1,radius:.095,quad:[{x:80,y:322},{x:244,y:326},{x:244,y:442},{x:78,y:451}]},
 {id:'left-stack',kind:'quest',slug:'ne-otvechay',description:'Нижний телевизор в левой стопке',depth:1.45,radius:.09,quad:[{x:358,y:400},{x:464,y:400},{x:464,y:487},{x:359,y:499}]},
 {id:'center-floor',kind:'quest',slug:'poslednyaya-smena',description:'Нижний телевизор справа от центра',depth:1.1,radius:.095,quad:[{x:718,y:414},{x:825,y:418},{x:825,y:500},{x:716,y:499}]},
 {id:'right-floor',kind:'quest',slug:'lesnik',description:'Большой телевизор на столе справа',depth:1.3,radius:.1,quad:[{x:941,y:363},{x:1118,y:359},{x:1119,y:506},{x:944,y:505}]},
 {id:'unidentified-face',kind:'ambient',description:'Центральный экран с потерянным сигналом',depth:1.55,radius:.085,quad:[{x:545,y:320},{x:649,y:321},{x:651,y:399},{x:544,y:404}]},
 {id:'portable-top',kind:'ambient',description:'Верхний телевизор слева',depth:1.8,radius:.08,quad:[{x:363,y:258},{x:459,y:265},{x:459,y:333},{x:362,y:335}]},
 {id:'right-static',kind:'ambient',description:'Верхний телевизор справа',depth:1.8,radius:.09,quad:[{x:726,y:222},{x:818,y:215},{x:820,y:294},{x:727,y:305}]}
];
// Гомография позволяет менять кадр или видео, не теряя перспективу стекла.
export function screenHomography(q:ScreenQuad){
 const [p0,p1,p2,p3]=q,dx1=p1.x-p2.x,dx2=p3.x-p2.x,dx3=p0.x-p1.x+p2.x-p3.x,dy1=p1.y-p2.y,dy2=p3.y-p2.y,dy3=p0.y-p1.y+p2.y-p3.y;
 const det=dx1*dy2-dx2*dy1;
 if(Math.abs(det)<1e-9)throw new Error('Вырожденная поверхность экрана');
 const g=(dx3*dy2-dx2*dy3)/det,h=(dx1*dy3-dx3*dy1)/det;
 return [p1.x-p0.x+g*p1.x,p3.x-p0.x+h*p3.x,p0.x,p1.y-p0.y+g*p1.y,p3.y-p0.y+h*p3.y,p0.y,g,h] as const;
}
export function projectScreen(h:readonly number[],u:number,v:number):ScreenPoint{const d=h[6]*u+h[7]*v+1;return{x:(h[0]*u+h[1]*v+h[2])/d,y:(h[3]*u+h[4]*v+h[5])/d}}
export function screenCenter(q:ScreenQuad){return projectScreen(screenHomography(q),.5,.5)}
export function roundedScreenPath(q:ScreenQuad,r=.09){const mix=(a:ScreenPoint,b:ScreenPoint,t:number)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});const first=mix(q[0],q[1],r);let p=`M ${first.x} ${first.y}`;for(let i=1;i<=4;i++){const a=q[(i-1)%4],b=q[i%4],next=q[(i+1)%4],enter=mix(b,a,r),leave=mix(b,next,r);p+=` L ${enter.x} ${enter.y} Q ${b.x} ${b.y} ${leave.x} ${leave.y}`}return p+' Z'}
