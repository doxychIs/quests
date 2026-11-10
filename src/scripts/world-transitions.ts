import {wordmarkGlyphs} from '../lib/brand-wordmark.ts';
type World='iznanka'|'arhiv'|'ostrov';
const names:World[]=['iznanka','arhiv','ostrov'];
const colors:Record<World,[number,number,number]>={iznanka:[239,105,119],arhiv:[230,193,110],ostrov:[108,184,243]};
export function worldNavigation(url:URL,home:URL,current:string,homePage:boolean){
 if(url.origin!==home.origin||url.hash)return;
 const path=url.pathname.replace(/\/+$/,'')+'/',base=home.pathname.replace(/\/+$/,'')+'/';
 if(homePage){const world=names.find(name=>path===base+name+'/');if(world)return {direction:'world' as const,world}}
 if(names.includes(current as World)&&path===base)return {direction:'home' as const,world:current as World};
}

export function initWorldTransitions(){
 const root=document.querySelector<HTMLElement>('[data-world-transfer]');if(!root)return;
 const home=new URL(root.dataset.home!,location.origin),current=document.body.dataset.world||'',homePage=current==='hub'&&document.body.dataset.page==='home';
 const media=matchMedia('(prefers-reduced-motion: reduce)'),calm=()=>media.matches||document.documentElement.classList.contains('calm');
 const shade=root.querySelector<HTMLElement>('.world-transfer-shade')!,logo=root.querySelector<HTMLElement>('[data-transfer-logo]')!,canvas=root.querySelector<HTMLCanvasElement>('[data-transfer-particles]')!;
 let busy=false,frame=0,watchdog=0,epoch=0,clone:HTMLElement|undefined;
 const animations:Animation[]=[];
 const ease=(t:number)=>1-Math.pow(1-Math.max(0,Math.min(1,t)),3);
 const animate=(node:Element,frames:Keyframe[],duration:number)=>{const animation=node.animate(frames,{duration,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});animations.push(animation);return animation.finished.catch(()=>{})};
 function clear(){
  epoch++;
  cancelAnimationFrame(frame);clearTimeout(watchdog);animations.splice(0).forEach(a=>a.cancel());clone?.remove();clone=undefined;
  root!.hidden=true;delete root!.dataset.arrival;delete root!.dataset.mode;logo.style.opacity='';shade.style.opacity='';
  document.documentElement.classList.remove('route-departing');document.querySelectorAll('.is-entering').forEach(card=>card.classList.remove('is-entering'));busy=false;
  document.dispatchEvent(new CustomEvent('inoe:world-enter',{detail:{world:''}}));
 }
 function particles(world:World,assemble:boolean,duration:number){
  const ctx=canvas.getContext('2d');if(!ctx)return Promise.resolve();
  const width=innerWidth,height=innerHeight,dpr=Math.min(devicePixelRatio||1,width<760?1:1.5);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  const r=logo.getBoundingClientRect(),targets:{x:number;y:number}[]=[];
  if(assemble&&typeof Path2D!=='undefined'){
   const sample=document.createElement('canvas');sample.width=560;sample.height=100;const paint=sample.getContext('2d');
   if(paint){wordmarkGlyphs.forEach((glyph,i)=>{paint.save();paint.translate(i*148.4+7.4,0);paint.scale(.5,.5);paint.fill(new Path2D(glyph.outline),'evenodd');paint.restore()});
    const pixels=paint.getImageData(0,0,560,100).data;
    for(let y=3;y<100;y+=4)for(let x=3;x<560;x+=4)if(pixels[(y*560+x)*4+3]>100)targets.push({x:r.left+x/560*r.width,y:r.top+y/100*r.height});
   }
  }
  const count=width<760?120:210,rgb=colors[world];
  const motes=Array.from({length:count},(_,i)=>{const angle=i*2.39996,rad=.35+(i%17)/17*.5;return {
   x:width*.5+Math.cos(angle)*width*rad,y:height*.5+Math.sin(angle)*height*rad,
   end:targets.length?targets[Math.floor(i/count*targets.length)]:{x:width*.5+Math.cos(angle)*width*.9,y:height*.5+Math.sin(angle)*height*.9},size:.7+(i%4)*.45,phase:i*1.7};});
  let start=0,last=0;
  return new Promise<void>(resolve=>{
   const paint=(now:number)=>{if(!start)start=now;const p=Math.min(1,(now-start)/duration);
    if(now-last<1000/30&&p<1){frame=requestAnimationFrame(paint);return}last=now;
    ctx.clearRect(0,0,width,height);const t=ease(p),silver=assemble?Math.max(0,(p-.3)/.7):0;
    ctx.fillStyle=`rgb(${rgb.map((v,i)=>Math.round(v+([219,228,241][i]-v)*silver)).join(' ')})`;
    motes.forEach(m=>{const curl=Math.sin(p*Math.PI),x=m.x+(m.end.x-m.x)*t+Math.sin(m.phase+p*4)*curl*28,y=m.y+(m.end.y-m.y)*t+Math.cos(m.phase+p*3)*curl*18;
     ctx.globalAlpha=assemble?.45+.5*t:(1-p)*.65;ctx.beginPath();ctx.arc(x,y,m.size,0,Math.PI*2);ctx.fill();});
    if(assemble)logo.style.opacity=String(Math.max(0,(p-.55)/.45));
    if(p<1)frame=requestAnimationFrame(paint);else{ctx.clearRect(0,0,width,height);resolve()}
   };frame=requestAnimationFrame(paint);
  });
 }
 async function arrive(){
  const direction=root!.dataset.arrival,world=root!.dataset.world as World;
  if(!direction||!names.includes(world)||calm()){if(direction)clear();return}
  try{
   if(direction==='home'){
    const hero=document.querySelector<HTMLElement>('[data-hub-hero]');if(hero)hero.dataset.returned='true';
    await document.fonts?.ready;document.getElementById('worlds')?.scrollIntoView({block:'start',behavior:'instant'});
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
    await particles(world,true,650);
    const target=document.querySelector<HTMLElement>('[data-logo-target]')?.getBoundingClientRect(),r=logo.getBoundingClientRect();
    if(target&&target.width>0)await animate(logo,[{left:r.left+'px',top:r.top+'px',width:r.width+'px',transform:'none',opacity:1},{left:target.left+'px',top:target.top+'px',width:target.width+'px',transform:'none',opacity:1}],340);
    await animate(root!,[{opacity:1},{opacity:0}],180);
   }else{
    const image=root!.querySelector<HTMLImageElement>('[data-transfer-image]')!;
    await Promise.race([image.decode?.().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,700))]);
    await animate(root!,[{opacity:1},{opacity:0}],480);
   }
  }finally{clear()}
 }
 void arrive();
 document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(link=>link.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||link.target==='_blank'||link.hasAttribute('download')||calm())return;
  const route=worldNavigation(new URL(link.href),home,current,homePage);if(!route)return;
  event.preventDefault();if(busy)return;busy=true;root.hidden=false;document.documentElement.classList.add('route-departing');
  const run=++epoch;let navigating=false;
  const destination=link.href;
  const navigate=()=>{if(run!==epoch||!busy||navigating)return;navigating=true;try{sessionStorage.setItem('inoe-world-transfer',JSON.stringify({...route,at:Date.now()}))}catch{}location.assign(destination)};
  watchdog=window.setTimeout(navigate,1900);
  void(async()=>{try{
   if(route.direction==='world'){
    root.dataset.mode='exit-world';link.classList.add('is-entering');
    document.dispatchEvent(new CustomEvent('inoe:world-enter',{detail:{world:route.world}}));
    await new Promise(resolve=>setTimeout(resolve,230));
    if(run!==epoch)return;
    const source=link.matches('[data-world-zone]')?link:document.querySelector<HTMLElement>(`[data-world-zone="${route.world}"]`);
    const r=source?.getBoundingClientRect();
    if(source&&r&&r.top<innerHeight&&r.bottom>0){
     clone=source.cloneNode(true) as HTMLElement;clone.classList.add('world-transfer-card');clone.classList.remove('is-current','is-entering');clone.removeAttribute('href');clone.setAttribute('aria-hidden','true');
     Object.assign(clone.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});root.append(clone);
     void animate(shade,[{opacity:0},{opacity:1}],450);requestAnimationFrame(()=>clone?.classList.add('is-expanding'));
     await animate(clone,[{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'},{left:'0px',top:'0px',width:innerWidth+'px',height:innerHeight+'px'}],650);
    }else await animate(shade,[{opacity:0},{opacity:1}],350);
   }else{
    root.dataset.mode='exit-home';void animate(shade,[{opacity:0},{opacity:1}],400);await particles(route.world,false,420);
   }
   clearTimeout(watchdog);navigate();
  }catch{clearTimeout(watchdog);navigate()}})();
 }));
 addEventListener('pageshow',event=>{if(event.persisted)clear()});
 addEventListener('keydown',event=>{if(event.key==='Escape'&&busy)clear()});
 addEventListener('pagehide',event=>{cancelAnimationFrame(frame);if(!event.persisted)clearTimeout(watchdog)});
}
