export function initHubInteractions(){
 if(document.body.dataset.page!=='home')return;
 const media=matchMedia('(prefers-reduced-motion: reduce)'),coarse=matchMedia('(pointer:coarse)');
 const calm=()=>media.matches||document.documentElement.classList.contains('calm');
 const nav=document.querySelector<HTMLElement>('.hub-header .desktop-nav');
 const links=[...nav?.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')||[]];
 const sections=links.map(link=>document.getElementById(link.hash.slice(1)));
 const indicator=document.createElement('span');indicator.className='hub-nav-indicator';indicator.setAttribute('aria-hidden','true');nav?.append(indicator);
 let frame=0;
 function paintNav(){
  frame=0;if(!nav||!links.length)return;
  let active=0;sections.forEach((section,i)=>{if(section&&section.getBoundingClientRect().top<innerHeight*.38)active=i});
  const link=links[active],r=link.getBoundingClientRect(),n=nav.getBoundingClientRect();
  links.forEach((item,i)=>i===active?item.setAttribute('aria-current','location'):item.removeAttribute('aria-current'));
  indicator.style.setProperty('--nav-x',(r.left-n.left)+'px');indicator.style.setProperty('--nav-width',r.width+'px');
  indicator.style.setProperty('--nav-visible',String((sections[0]?.getBoundingClientRect().top||0)<innerHeight*.6?1:0));
 }
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(paintNav)};addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);document.fonts?.ready.then(schedule);paintNav();
 const facts=document.querySelector<HTMLElement>('.hub-facts');
 if(facts){facts.classList.add('hub-facts-ready');[...facts.children].forEach((item,i)=>(item as HTMLElement).style.setProperty('--fact-index',String(i)));}
 const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
  const node=entry.target as HTMLElement;
  if(node===facts&&entry.isIntersecting){node.classList.add('hub-facts-visible');observer.unobserve(node)}
  else if(node.matches('[data-world-zone]'))node.classList.toggle('photo-offscreen',!entry.isIntersecting);
 }),{threshold:.15});if(facts)observer.observe(facts);
 document.querySelectorAll<HTMLElement>('[data-world-zone]').forEach(card=>{
  const veil=document.createElement('span');veil.className='hub-photo-life';veil.setAttribute('aria-hidden','true');card.querySelector('.hub-world-preview')?.append(veil);observer.observe(card);
  card.addEventListener('pointermove',event=>{if(calm()||event.pointerType!=='mouse')return;const r=card.getBoundingClientRect();card.style.setProperty('--world-x',(event.clientX-r.left)/r.width*100+'%');card.style.setProperty('--world-y',(event.clientY-r.top)/r.height*100+'%')});
 });
 const preview=document.querySelector<HTMLElement>('.hub-invite-preview'),card=preview?.querySelector<HTMLElement>('.hub-invite-card');let tilt=0,last:{x:number;y:number}|undefined;
 function paintTilt(){tilt=0;if(!preview||!card||!last||calm()||coarse.matches)return;const r=preview.getBoundingClientRect(),x=(last.x-r.left)/r.width,y=(last.y-r.top)/r.height;
  card.style.setProperty('--invite-rx',(1-2*y)*3+'deg');card.style.setProperty('--invite-ry',(2*x-1)*4+'deg');card.style.setProperty('--invite-light-x',x*100+'%');card.style.setProperty('--invite-light-y',y*100+'%');card.style.setProperty('--invite-light','1');card.style.setProperty('--invite-shadow-x',(x-.5)*-16+'px');card.style.setProperty('--invite-shadow-y',12+y*12+'px');
 }
 preview?.addEventListener('pointermove',event=>{if(event.pointerType!=='mouse')return;last={x:event.clientX,y:event.clientY};if(!tilt)tilt=requestAnimationFrame(paintTilt)});
 preview?.addEventListener('pointerleave',()=>{last=undefined;card?.style.setProperty('--invite-rx','0deg');card?.style.setProperty('--invite-ry','0deg');card?.style.setProperty('--invite-light','0')});
 document.querySelectorAll<HTMLDetailsElement>('.hub-questions details').forEach(details=>{
  const summary=details.querySelector('summary')!;let timer=0,closing=false;
  summary.addEventListener('click',event=>{
   if(calm())return;event.preventDefault();clearTimeout(timer);
   const from=details.getBoundingClientRect().height,close=details.open&&!closing;closing=close;
   details.style.height=from+'px';if(!close)details.open=true;
   const to=close?summary.getBoundingClientRect().height:details.scrollHeight;
   requestAnimationFrame(()=>{details.style.height=to+'px'});
   timer=window.setTimeout(()=>{if(closing)details.open=false;details.style.height='';closing=false},340);
  });
 });
 addEventListener('pageshow',schedule);
 addEventListener('pagehide',event=>{cancelAnimationFrame(frame);cancelAnimationFrame(tilt);if(!event.persisted)observer.disconnect()});
}
