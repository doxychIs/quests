export type RoomDisturbanceKind='light'|'cloth'|'pipe'|'signal'|'hand'|'drip';
export type RoomDisturbance={kind:RoomDisturbanceKind;start:number;duration:number;fixture:number;strength:number};
export type RoomAtmosphereFrame={fixture:number;lamp:number;cloth:number;cable:number;signal:boolean;drift:number;hand?:number;drip?:number};

const clamp=(value:number)=>Math.max(0,Math.min(1,value));
const smooth=(value:number)=>{const x=clamp(value);return x*x*(3-2*x)};
const dip=(time:number,start:number,end:number)=>smooth((time-start)/60)*smooth((end-time)/90);

/** Local failures, with a recovery between them; never a whole-scene strobe. */
export function roomAtmosphereFrame(event:RoomDisturbance|undefined,time:number):RoomAtmosphereFrame|undefined{
 if(!event)return;
 const elapsed=time-event.start;if(elapsed<0||elapsed>=event.duration)return;
 const progress=elapsed/event.duration,envelope=Math.sin(Math.PI*progress)**2;
 const strength=clamp(event.strength);
 const lamp=event.kind==='light'?1-strength*(.72*dip(elapsed,110,370)+.90*dip(elapsed,880,1190)):1;
 return{
  fixture:event.fixture,lamp,
  cloth:event.kind==='cloth'?Math.sin(progress*Math.PI*3.5)*envelope*strength:0,
  cable:event.kind==='pipe'?Math.sin(progress*Math.PI*7)*Math.exp(-progress*4)*strength:0,
  signal:event.kind==='signal'&&elapsed>160&&elapsed<320,
  drift:elapsed/1000,
  ...(event.kind==='hand'?{hand:Math.sin(progress*Math.PI*2.3)*envelope*strength}:{}),
  ...(event.kind==='drip'?{drip:progress}:{}),
 };
}

export function createRoomDisturbance(kind:RoomDisturbanceKind,time:number,fixture:number,random=Math.random):RoomDisturbance{
 const duration={light:1850,cloth:4600,pipe:2600,signal:1150,hand:3800,drip:2800}[kind];
 return{kind,start:time,duration,fixture,strength:.7+clamp(random())*.3};
}
