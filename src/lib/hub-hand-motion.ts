/** The stage starts releasing while the last part of the disappearance finishes. */
export const HERO_PIN_END=.97;
export const HAND_ENTRY_END=.64;
export const HAND_HOLD_END=.665;
export const clamp01=(value:number)=>Math.min(1,Math.max(0,value));
export const smoothstep=(value:number)=>{const p=clamp01(value);return p*p*(3-2*p)};
/** Zero velocity and acceleration at either end of a pose transition. */
export const smootherstep=(value:number)=>{const p=clamp01(value);return p*p*p*(p*(p*6-15)+10)};
/** Frame-rate independent settling between wheel events; never runs an idle loop. */
export function smoothScrollProgress(current:number,target:number,seconds:number){
 if(Math.abs(target-current)<.00002)return target;
 return current+(target-current)*(1-Math.exp(-Math.max(0,Math.min(.05,seconds))/.19));
}
export function introLetterProgress(time:number,duration:number,index:number){
 return smootherstep((time/Math.max(.001,duration)-.26-index*.024)/.37);
}

/** One reversible scroll choreography. Nothing advances with elapsed time. */
export function handScrollState(progress:number,duration:number){
 const p=clamp01(progress);
 const appearance=smootherstep(p/HAND_ENTRY_END);
 const docking=smootherstep((p-HAND_HOLD_END)/(1-HAND_HOLD_END));
 const time=(p<=HAND_HOLD_END?appearance:1-docking)*Math.max(0,duration);
 const opacity=p<=HAND_HOLD_END?smootherstep(appearance/.09):1-smootherstep((docking-.4)/.6);
 const phase=p>=1?'complete':p>=HAND_HOLD_END?'docking':p>=HAND_ENTRY_END?'hold':'appearance';
 return {progress:p,appearance,docking,time,opacity,phase};
}
