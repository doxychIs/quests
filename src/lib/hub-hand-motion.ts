/** The stage starts releasing while the last part of the disappearance finishes. */
export const HERO_PIN_END=.97;
export const HAND_ENTRY_END=.64;
export const HAND_HOLD_END=.665;
export const clamp01=(value:number)=>Math.min(1,Math.max(0,value));
export const smoothstep=(value:number)=>{const p=clamp01(value);return p*p*(3-2*p)};
/** Zero velocity and acceleration at either end of a pose transition. */
export const smootherstep=(value:number)=>{const p=clamp01(value);return p*p*p*(p*(p*6-15)+10)};
// Perceptual cues: descent, unfolding, then the short, almost still relaxation.
const ENTRY_CUES=[[0,0],[.12,.105],[.4,.28],[.88,.64],[1,1]];
const ENTRY_SLOPES=ENTRY_CUES.map(([x,y],i)=>{
 if(i===0||i===ENTRY_CUES.length-1)return 0;
 const [px,py]=ENTRY_CUES[i-1],[nx,ny]=ENTRY_CUES[i+1];
 const before=(y-py)/(x-px),after=(ny-y)/(nx-x);
 return 2*before*after/(before+after);
});
/** Monotone Hermite interpolation keeps velocity continuous between movement cues. */
export function entryClipProgress(value:number){
 const p=clamp01(value);
 const index=Math.min(ENTRY_CUES.length-2,Math.max(0,ENTRY_CUES.findIndex(([x])=>x>p)-1));
 if(p===1)return 1;
 const [x0,y0]=ENTRY_CUES[index],[x1,y1]=ENTRY_CUES[index+1];
 const width=x1-x0,t=(p-x0)/width,t2=t*t,t3=t2*t;
 return clamp01((2*t3-3*t2+1)*y0+(t3-2*t2+t)*width*ENTRY_SLOPES[index]+(-2*t3+3*t2)*y1+(t3-t2)*width*ENTRY_SLOPES[index+1]);
}
/** Frame-rate independent settling between wheel events; never runs an idle loop. */
export function smoothScrollProgress(current:number,target:number,seconds:number){
 if(Math.abs(target-current)<.00002)return target;
 return current+(target-current)*(1-Math.exp(-Math.max(0,Math.min(.05,seconds))/.19));
}
export function introLetterProgress(time:number,duration:number,index:number){
 return smootherstep((time/Math.max(.001,duration)-.65-index*.014)/.21);
}

export const HAND_LEVER_LENGTH=.197;
export const HAND_ASSET_ROLL=Math.PI;
/** Forward pitch only: dorsal-facing fist becomes a horizontal, upward-facing palm. */
export function handStagePose(arrival:number){
 // Finish the pitch before the fingers unfold, so the half-open palm already faces up.
 const p=clamp01(arrival),approach=smootherstep(p/.94),turn=smootherstep((p-.04)/.54);
 return {
  // Follow the elevated camera's sightline in depth; the distant fist stays in frame.
  pivotX:0,pivotY:-.02-(1-approach)*.33,pivotZ:-1.45*(1-approach),
  rotationX:turn*Math.PI/2,rotationY:0,rotationZ:0,
 };
}

/** One reversible scroll choreography. Nothing advances with elapsed time. */
export function handScrollState(progress:number,duration:number){
 const p=clamp01(progress);
 const appearance=entryClipProgress(p/HAND_ENTRY_END);
 const exit=clamp01((p-HAND_HOLD_END)/(1-HAND_HOLD_END));
 const docking=smootherstep(exit);
 const clipProgress=p<=HAND_HOLD_END?appearance:entryClipProgress(1-exit);
 const time=clipProgress*Math.max(0,duration);
 const opacity=smootherstep(clipProgress/.09)*(1-smootherstep((exit-.7)/.3));
 // Keep the distant fist and its returning silhouette hidden; dust keeps its own fade.
 const handOpacity=smootherstep((p-.26)/.12)*(1-smootherstep((p-.71)/.10));
 const phase=p>=1?'complete':p>=HAND_HOLD_END?'docking':p>=HAND_ENTRY_END?'hold':'appearance';
 const arrival=p<=HAND_HOLD_END?clamp01(p/HAND_ENTRY_END):1-exit;
 return {progress:p,appearance,arrival,docking,time,opacity,handOpacity,phase};
}
