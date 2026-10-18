/** Общий ритм прохода: 82% — движение, затем неподвижная сцена и её раскрытие. */
export function cinemaTimeline(progress:number,end:number,fps=24){
 const p=Math.max(0,Math.min(1,progress));
 return {time:Math.round(Math.min(1,p/.82)*end*fps)/fps,room:p>=.86,fit:Math.max(0,Math.min(1,(p-.82)/.16))};
}

/** Один механизм поиска кадра для всех миров. Видео никогда не запускается. */
export function createFrameScrubber(video:HTMLVideoElement){
 let targetTime=0;
 function seek(){
  if(video.readyState<1||video.seeking||!Number.isFinite(video.duration))return;
  const target=Math.min(targetTime,Math.max(0,video.duration-.03));
  if(Math.abs(video.currentTime-target)>1/48)try{video.currentTime=target}catch{}
 }
 video.muted=true;video.pause();
 video.addEventListener('loadedmetadata',seek);
 video.addEventListener('loadeddata',seek);
 video.addEventListener('seeked',seek);
 return {setTime(time:number){targetTime=Math.max(0,time);seek()},seek};
}
