/** The stage starts releasing while the last part of the disappearance finishes. */
export const HERO_PIN_END=.92;
export const clamp01=(value:number)=>Math.min(1,Math.max(0,value));
export const smoothstep=(value:number)=>{const p=clamp01(value);return p*p*(3-2*p)};
export function introLetterProgress(time:number,duration:number,index:number){
 return smoothstep((time/Math.max(.001,duration)-.325-index*.016)/.255);
}

/** One reversible scroll choreography. Nothing advances with elapsed time. */
export function handScrollState(progress:number,duration:number){
 const p=clamp01(progress);
 const appearance=smoothstep(p/.54);
 const docking=smoothstep((p-.62)/.38);
 const time=(p<=.62?appearance:1-docking)*Math.max(0,duration);
 const opacity=p<=.62?smoothstep(appearance/.06):1-smoothstep((docking-.5)/.5);
 const phase=p>=1?'complete':p>=.62?'docking':p>=.54?'hold':'appearance';
 return {progress:p,appearance,docking,time,opacity,phase};
}
