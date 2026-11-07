import {investigationCamera,type InvestigationChapter,type InvestigationKey} from '../lib/horror-investigation';
import type {createWardRenderer} from '../lib/ward-renderer';

/** An actual Blender room surrounds the existing blocks. Wheel/touch input stays native. */
export function initHorrorInvestigation(){
 const candidate=document.querySelector<HTMLElement>('[data-investigation]');if(!candidate||candidate.dataset.investigationReady)return;const root=candidate;
 const selectors:[string,InvestigationKey][]=[['.horror-editorial','ward'],['.horror-photos','evidence'],['.trial-iznanka','connection'],['.horror-afterword','team'],['.horror-briefing','briefing']];
 const scenes=selectors.flatMap(([selector,key])=>{
  const section=root.querySelector<HTMLElement>(selector);if(!section)return[];
  const chapter=document.createElement('div'),frame=document.createElement('div');chapter.className='investigation-chapter';chapter.dataset.investigationChapter=key;frame.className='investigation-frame';
  section.before(chapter);chapter.append(frame);frame.append(section);return[{section,chapter,frame,key}];
 });
 if(!scenes.length)return;
 root.dataset.investigationReady='true';
 const query=matchMedia('(prefers-reduced-motion: reduce)'),html=document.documentElement;
 let layout:InvestigationChapter[]=[],rootTop=0,raf=0,lastTime=0,visible=false,suspended=false,current=scrollY,target=scrollY;
 const setting=root.querySelector<HTMLElement>('[data-ward-model]'),canvas=root.querySelector<HTMLCanvasElement>('[data-ward-canvas]');
 let view:Awaited<ReturnType<typeof createWardRenderer>>|undefined,loading=false,failed=false,near=false,contextLost=false;
 const calm=()=>query.matches||html.classList.contains('calm');
 const permitted=()=>!suspended&&visible&&!document.hidden&&!calm()&&!contextLost&&html.classList.contains('adult');
 function stop(){if(raf)cancelAnimationFrame(raf);raf=0;lastTime=0;root.classList.remove('is-camera-moving');}
 async function prepareRoom(){
  if(view||loading||failed||!near||document.hidden||calm()||!html.classList.contains('adult')||!canvas||!setting?.dataset.wardModel)return;
  if(typeof WebGL2RenderingContext==='undefined'){failed=true;root.dataset.wardState='unavailable';return;}
  loading=true;root.dataset.wardState='loading';
  try{
   const {createWardRenderer}=await import('../lib/ward-renderer');
   const loaded=await createWardRenderer(canvas,setting.dataset.wardModel);
   if(!root.isConnected){loaded.dispose();return;}view=loaded;
   if(permitted()){current=target=scrollY;paint();}
  }catch{failed=true;root.dataset.wardState='unavailable';}finally{loading=false;}
 }
 function paint(){
  const local=current-rootTop,state=investigationCamera(local,layout,innerHeight),p=state.pose;
  if(view&&permitted()){view.render(p);root.dataset.wardState='ready';}
  root.style.setProperty('--room-exposure',state.exposureDip.toFixed(3));
  root.dataset.investigationShot=state.key;
  for(const scene of scenes){
   const r=scene.chapter.getBoundingClientRect(),enter=Math.min(1,Math.max(0,(innerHeight*.95-r.top)/(innerHeight*.4))),leave=Math.min(1,Math.max(0,r.bottom/(innerHeight*.42)));
   scene.frame.style.setProperty('--chapter-opacity',String(.35+.65*Math.min(enter,leave)));
   scene.frame.style.setProperty('--chapter-drift',`${Math.max(-18,Math.min(18,r.top/innerHeight*18)).toFixed(2)}px`);
  }
  document.dispatchEvent(new CustomEvent('horror:investigation-frame'));
 }
 function tick(time:number){
  raf=0;if(!permitted()){stop();return;}
  // Exponential easing is stable for long frames too: a slow phone must catch up,
  // rather than spending seconds replaying an old scroll after the input stops.
  const dt=lastTime?Math.max(0,time-lastTime):16;lastTime=time;
  if(Math.abs(target-current)>innerHeight*2.4)current=target;
  else current+=(target-current)*(1-Math.exp(-dt/75));
  if(Math.abs(target-current)<.35)current=target;
  paint();
  if(current!==target)raf=requestAnimationFrame(tick);else stop();
 }
 function schedule(){target=scrollY;if(!permitted()){stop();return;}if(!raf){root.classList.add('is-camera-moving');raf=requestAnimationFrame(tick);}}
 function measure(){
  rootTop=root.getBoundingClientRect().top+scrollY;
  for(const scene of scenes){
   const height=scene.frame.offsetHeight,tall=height>innerHeight+3;
   scene.chapter.classList.toggle('is-tall',tall);
   const value=`${Math.ceil(height)}px`;if(scene.chapter.style.getPropertyValue('--chapter-height')!==value)scene.chapter.style.setProperty('--chapter-height',value);
  }
  layout=scenes.map(scene=>({key:scene.key,start:scene.chapter.offsetTop,height:scene.chapter.offsetHeight}));
  current=target=scrollY;if(!calm())paint();schedule();
 }
 const io=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting||false;if(visible){near=true;void prepareRoom();current=target=scrollY;measure();}else stop();},{threshold:0});io.observe(root);
 const warmup=new IntersectionObserver(entries=>{near=entries[0]?.isIntersecting||false;if(near)void prepareRoom();},{rootMargin:'700px 0px',threshold:0});warmup.observe(root);
 const resize=new ResizeObserver(measure);scenes.forEach(scene=>resize.observe(scene.section));
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',measure,{passive:true});
 const sync=()=>{root.dataset.investigationStatic=String(calm());if(calm())stop();void prepareRoom();measure();};
 query.addEventListener('change',sync);new MutationObserver(sync).observe(html,{attributes:true,attributeFilter:['class']});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else{void prepareRoom();current=target=scrollY;schedule();}});
 canvas?.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;root.dataset.wardState='unavailable';stop();});
 canvas?.addEventListener('webglcontextrestored',()=>{contextLost=false;measure();});
 addEventListener('pagehide',()=>{suspended=true;stop();});addEventListener('pageshow',()=>{suspended=false;measure();});
 document.fonts?.ready.then(()=>{if(root.isConnected)measure();});sync();
}
