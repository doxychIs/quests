/** Measured-looking, bounded variations; profiles follow the cabinet, not a global loop. */
export type AnalogProfile={seed:number;gain:number;contrast:number;black:number;bleed:number;ghost:number;scan:number;pitch:number;mask:number;curve:number;tracking:number;temperature:[number,number,number];reflection:number};
export const analogProfiles:Record<string,AnalogProfile>={
 'wood-floor':{seed:137,gain:.91,contrast:1.04,black:.009,bleed:.65,ghost:.025,scan:.085,pitch:2.05,mask:.025,curve:.014,tracking:.22,temperature:[1,.96,.89],reflection:.022},
 'left-stack':{seed:729,gain:.85,contrast:1.09,black:.012,bleed:1.2,ghost:.085,scan:.10,pitch:2.12,mask:.031,curve:.019,tracking:.46,temperature:[.92,1,.96],reflection:.018},
 'center-floor':{seed:354,gain:.89,contrast:1.06,black:.008,bleed:.8,ghost:.04,scan:.074,pitch:1.97,mask:.022,curve:.013,tracking:.33,temperature:[.96,.98,1],reflection:.025},
 'right-floor':{seed:911,gain:.94,contrast:1.03,black:.011,bleed:.5,ghost:.018,scan:.064,pitch:2.02,mask:.022,curve:.011,tracking:.13,temperature:[.97,1,.95],reflection:.031},
 'unidentified-face':{seed:438,gain:.82,contrast:1.1,black:.01,bleed:1.5,ghost:.11,scan:.11,pitch:2.18,mask:.034,curve:.021,tracking:.62,temperature:[.94,1,.91],reflection:.019},
 'portable-top':{seed:682,gain:.8,contrast:1.07,black:.013,bleed:1.1,ghost:.065,scan:.09,pitch:2.1,mask:.027,curve:.018,tracking:.42,temperature:[1,.95,.9],reflection:.018},
 'right-static':{seed:1633,gain:.86,contrast:1.05,black:.01,bleed:.9,ghost:.05,scan:.08,pitch:2.07,mask:.028,curve:.017,tracking:.38,temperature:[.92,.98,1],reflection:.02}
};
export type SignalEvent={next:number;until:number;row:number;amount:number};
export function newSignalEvent(random:()=>number=Math.random):SignalEvent{return{next:7+random()*24,until:0,row:.5,amount:0}}
/** Random intervals, bounded displacement, and no alternating full-screen flashes. */
export function advanceSignalEvent(event:SignalEvent,time:number,profile:AnalogProfile,random:()=>number=Math.random){
 if(time>=event.next){event.until=time+.18+random()*.3;event.row=.15+random()*.7;event.amount=(.5+random()*1.6)*profile.tracking;event.next=event.until+17+random()*49}
 return time<event.until?event.amount:0;
}
