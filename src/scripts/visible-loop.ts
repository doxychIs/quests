/** A canvas requests frames only while visible, active and on the foreground tab. */
export function createVisibleLoop(target:Element,draw:(time:number,delta:number)=>void,enabled:()=>boolean=()=>true){
 let visible=false,frame=0,previous=0,destroyed=false,suspended=false;
 const allowed=()=>!destroyed&&!suspended&&visible&&!document.hidden&&enabled();
 function stop(){if(frame)cancelAnimationFrame(frame);frame=0;previous=0}
 function tick(time:number){frame=0;if(!allowed()){previous=0;return}const delta=previous?Math.min((time-previous)/1000,.03):1/60;previous=time;draw(time,delta);if(allowed())frame=requestAnimationFrame(tick);else previous=0}
 function sync(){if(allowed()){if(!frame)frame=requestAnimationFrame(tick)}else stop()}
 const observer=new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting);sync()},{threshold:0});observer.observe(target);
 const preferences=new MutationObserver(sync);preferences.observe(document.documentElement,{attributes:true,attributeFilter:['class']});
 const suspend=()=>{suspended=true;stop()},resume=()=>{suspended=false;sync()};
 document.addEventListener('visibilitychange',sync);addEventListener('pagehide',suspend);addEventListener('pageshow',resume);
 return{sync,destroy(){destroyed=true;stop();observer.disconnect();preferences.disconnect();document.removeEventListener('visibilitychange',sync);removeEventListener('pagehide',suspend);removeEventListener('pageshow',resume)}};
}
