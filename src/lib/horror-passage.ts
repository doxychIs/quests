import {cinemaTimeline} from './scroll-cinema.ts';
// Frame 156 is the last selected wide shot before the source pushes in and fades out.
export const passageEnd=6.5;
export function passageTimeline(progress:number){
 return cinemaTimeline(progress,passageEnd);
}
