import {buildEnergyRoute,energyAtDistance,energyAtY,energyFrontier,energyBranchProgress,energyVisibility,type EnergyBox,type EnergyLayout} from '../lib/hub-energy-path';
import type {createEnergyRibbon} from './hub-energy-ribbon';

/** The hero's soft fabric follows a document-space route in one viewport-sized surface. */
export function initHubEnergy(){
 const root=document.querySelector<HTMLElement>('[data-hub-energy]');
 const hero=document.querySelector<HTMLElement>('[data-hub-hero]');
 const stage=hero?.querySelector<HTMLElement>('[data-hand-stage]');
 const cards=[...document.querySelectorAll<HTMLElement>('[data-world-zone]')];
 if(!root||!hero||!stage||cards.length!==3)return;
 const svg=root.querySelector<SVGSVGElement>('[data-energy-svg]')!,space=root.querySelector<SVGGElement>('[data-energy-space]')!;
 const canvas=root.querySelector<HTMLCanvasElement>('[data-energy-ribbon]')!;
 const branches=[...root.querySelectorAll<SVGGElement>('[data-energy-branch]')];
 const motes=[...root.querySelectorAll<SVGCircleElement>('[data-energy-motes] circle')];
 const source=root.querySelector<SVGCircleElement>('[data-energy-source]')!;
 const media=matchMedia('(prefers-reduced-motion: reduce)');
 let layout:Omit<EnergyLayout,'source'>|undefined,route:ReturnType<typeof buildEnergyRoute>|undefined;
 let ribbon:ReturnType<typeof createEnergyRibbon>|undefined,ribbonRoute:typeof route;
 let ribbonLoading=false,ribbonFailed=false;
 let frame=0,lastPaint=0,measureNeeded=true,routeDirty=true,disposed=false;
 let heroTop=0,heroHeight=0,stageHeight=0,headerHeight=0,anchor={x:.5,y:.62},heroProgress=0;
 let previousSource={x:-1,y:-1};
 let departingWorld='',departureAt=0;
 const calm=()=>media.matches||document.documentElement.classList.contains('calm');
 const setPoint=(node:SVGElement,x:number,y:number)=>node.setAttribute('transform',`translate(${x.toFixed(2)} ${y.toFixed(2)})`);
 const box=(node:Element):EnergyBox=>{const r=node.getBoundingClientRect();return {left:r.left,top:r.top+scrollY,width:r.width,height:r.height}};
 function schedule(){if(!frame&&!disposed&&!document.hidden&&!calm())frame=requestAnimationFrame(paint)}
 function measure(){measureNeeded=true;schedule()}
 function loadRibbon(){
  if(ribbon||ribbonLoading||ribbonFailed||calm())return;ribbonLoading=true;
  void import('./hub-energy-ribbon').then(({createEnergyRibbon})=>{
   if(disposed||calm())return;
   ribbon=createEnergyRibbon(canvas,()=>{ribbon?.dispose();ribbon=undefined;ribbonFailed=true;root!.dataset.energyRenderer='unavailable'});
   root!.dataset.energyRenderer='silk';measure();
  }).catch(()=>{ribbonFailed=true;root!.dataset.energyRenderer='unavailable'}).finally(()=>{ribbonLoading=false});
 }
 function paint(now:number){
  frame=0;if(disposed||document.hidden||calm())return;
  if(lastPaint&&now-lastPaint<1000/30){schedule();return}lastPaint=now;
  if(measureNeeded){
   const r=box(hero!),sr=box(stage!);heroTop=r.top;heroHeight=r.height;stageHeight=sr.height;
   headerHeight=document.querySelector('header')?.clientHeight||0;
   layout={width:document.documentElement.clientWidth,viewport:innerHeight,cards:cards.map(box)};
   svg.setAttribute('viewBox',`0 0 ${layout.width} ${innerHeight}`);
   measureNeeded=false;routeDirty=true;
  }
  if(!layout||layout.cards.some(c=>c.height<1))return;
  // Sticky stage follows scroll until the hero releases. The anchor is the actual projected palm.
  const stageTop=Math.min(Math.max(heroTop,scrollY+headerHeight),heroTop+heroHeight-stageHeight);
  const origin={x:anchor.x*layout.width,y:stageTop+anchor.y*stageHeight};
  const changed=routeDirty||Math.abs(origin.x-previousSource.x)+Math.abs(origin.y-previousSource.y)>.6;
  if(changed){route=buildEnergyRoute({...layout,source:origin});previousSource=origin;routeDirty=false}
  if(!route)return;
  const frontier=energyFrontier(route.main,scrollY,innerHeight,heroProgress),reveal=frontier/route.main.length;
  const branchAmounts=route.branches.map(branch=>energyBranchProgress(branch.path,scrollY,innerHeight,heroProgress));
  const strength=energyVisibility(heroProgress),clock=now/1000;
  space.setAttribute('transform',`translate(0 ${-scrollY})`);space.style.opacity=String(strength);
  root!.dataset.energyProgress=reveal.toFixed(5);
  if(strength>0)loadRibbon();
  if(ribbon){
   if(ribbonRoute!==route){ribbon.resize(layout.width,innerHeight);ribbon.setRoute(route,layout.width<=760);ribbonRoute=route}
   const active=departingWorld||document.querySelector<HTMLElement>('[data-world-selector]')?.dataset.activeWorld||'';
   ribbon.setInteraction(cards.findIndex(card=>card.dataset.worldZone===active),departingWorld?Math.min(1,(now-departureAt)/650):0);
   ribbon.render(route,frontier,branchAmounts,scrollY,clock,strength);
  }
  setPoint(source,origin.x,origin.y);source.style.opacity=String(.10+Math.sin(clock*.8)*.025);
  const count=layout.width<=760?10:20;
  const visibleStart=energyAtY(route.main,scrollY-40).distance;
  motes.forEach((mote,i)=>{
   const distance=(Math.floor(visibleStart/75)+i)*75+(clock*18)%75;
   const p=energyAtDistance(route!.main,distance),on=i<count&&distance<frontier&&frontier>10&&p.y>scrollY-30&&p.y<scrollY+innerHeight+30;
   mote.style.opacity=on?String(.2+.35*Math.sin((distance/route!.main.length)*Math.PI)):'0';
   if(on)setPoint(mote,p.x+Math.sin(clock*.7+i*2.1)*(layout!.width<=760?18:48),p.y+Math.cos(i*1.8)*8);
  });
  route.branches.forEach((branch,i)=>{
   const amount=branchAmounts[i];
   const destination=branches[i].querySelector<SVGCircleElement>('[data-energy-destination]')!;
   setPoint(destination,branch.end.x,branch.end.y);destination.style.opacity=String(amount*.3);
   cards[i].style.setProperty('--energy-charge',amount.toFixed(4));
   const mote=branches[i].querySelector<SVGCircleElement>('[data-energy-mote]')!;
   const p=energyAtDistance(branch.path,branch.path.length*((clock*.16+i*.31)%1));
   mote.style.opacity=String(amount>.01&&(p.distance/branch.path.length)<amount?.45:0);setPoint(mote,p.x,p.y);
  });
  root!.dataset.energyState='active';
  // Only the visible portion has living motes. Revealing the path itself never uses time.
  const lastDestination=Math.max(...route.branches.map(branch=>branch.end.y));
  if(strength>0&&lastDestination>=scrollY-40&&origin.y<scrollY+innerHeight+40)schedule();
 }
 const onAnchor=(event:Event)=>{
  const detail=(event as CustomEvent<{x:number;y:number;progress:number}>).detail;
  if(!detail||!Number.isFinite(detail.x+detail.y+detail.progress))return;
  anchor={x:detail.x,y:detail.y};heroProgress=detail.progress;schedule();
 };
 const onDeparture=(event:Event)=>{departingWorld=(event as CustomEvent<{world:string}>).detail.world;departureAt=performance.now();schedule()};
 function motion(){
  cancelAnimationFrame(frame);frame=0;root!.dataset.energyState=calm()?'reduced':'loading';
  if(calm())cards.forEach(card=>card.style.setProperty('--energy-charge','0'));else measure();
 }
 function visibility(){cancelAnimationFrame(frame);frame=0;lastPaint=0;if(!document.hidden)measure()}
 const resize=new ResizeObserver(measure);[hero,stage,...cards].forEach(node=>resize.observe(node!));
 const settings=new MutationObserver(motion);settings.observe(document.documentElement,{attributes:true,attributeFilter:['class']});
 hero.addEventListener('inoe:hero-energy',onAnchor);
 document.addEventListener('inoe:world-enter',onDeparture);
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',measure);addEventListener('pageshow',measure);
 document.addEventListener('visibilitychange',visibility);media.addEventListener('change',motion);
 const destroy=(event:PageTransitionEvent)=>{
  cancelAnimationFrame(frame);frame=0;if(event.persisted)return;disposed=true;
  resize.disconnect();settings.disconnect();hero!.removeEventListener('inoe:hero-energy',onAnchor);
  ribbon?.dispose();ribbon=undefined;
  removeEventListener('scroll',schedule);removeEventListener('resize',measure);removeEventListener('pageshow',measure);removeEventListener('pagehide',destroy);
  document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',motion);
  document.removeEventListener('inoe:world-enter',onDeparture);
 };
 addEventListener('pagehide',destroy);document.fonts?.ready.then(()=>{if(!disposed)measure()});motion();
}
