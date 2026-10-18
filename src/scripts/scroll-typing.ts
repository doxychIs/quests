type TextRun={
 element:HTMLElement;count:number;total:number;visible:boolean;
 chars?:string[];ink?:Text;tail?:Text;letters?:SVGGElement[];
};

/** Scroll supplies the keystrokes. There is no autoplay clock or offscreen typing loop. */
export function initScrollTyping(onKeystroke:()=>void=()=>{}){
 if(document.body.dataset.world!=='iznanka')return;
 const html=document.documentElement,query=matchMedia('(prefers-reduced-motion: reduce)');
 const records=new Map<HTMLElement,TextRun>();
 const excluded='script,style,svg,canvas,video,audio,dialog,form,input,textarea,select,a,button,summary,.team-size,.site-header,.graphic-transcript,.graphic-objects,[data-graphic-text],.scroll-type-run,.scroll-type-caret,[aria-live],[role=status],.film-tools,.film-scroll,.passage-skip,[data-passage-caption],.touch-controls,[data-start],[data-restart],[data-replay],[data-stage],[data-team-unavailable]';
 const caret=document.createElement('span');caret.className='scroll-type-caret';caret.setAttribute('aria-hidden','true');caret.hidden=true;document.body.append(caret);
 let frame=0,idle:ReturnType<typeof setTimeout>|undefined,credit=0,lastScroll=-Infinity,previousFrame=0,suspended=false;
 let active:TextRun|undefined,lastY=scrollY,lastX=scrollX;
 const nestedPositions=new WeakMap<Element,{x:number;y:number}>();
 const calm=()=>query.matches||html.classList.contains('calm');
 const allowed=()=>!suspended&&!document.hidden&&!calm()&&html.classList.contains('adult')&&!document.querySelector('dialog[open]');
 const available=(run:TextRun)=>run.visible&&run.element.isConnected&&!run.element.closest('[hidden]');

 function render(run:TextRun,count:number){
  const before=run.count;run.count=Math.min(run.total,count);
  if(run.letters){
   for(let i=before;i<run.count;i++)run.letters[i]?.removeAttribute('data-type-hidden');
  }else if(run.ink&&run.tail&&run.chars){
   // Character data updates leave the layout and the animation visibility observer untouched.
   run.ink.data=run.chars.slice(0,run.count).join('');run.tail.data=run.chars.slice(run.count).join('');
  }
  run.element.dataset.typeCount=String(run.count);
  run.element.dataset.typeState=run.count===run.total?'complete':'pending';
 }
 function next(){
  const header=document.querySelector('.site-header')?.getBoundingClientRect().bottom||0;
  return [...records.values()].filter(run=>{
   if(!available(run)||run.count>=run.total)return false;
   const r=run.element.getBoundingClientRect();return r.bottom>Math.max(0,header)+6&&r.top<innerHeight-12;
  }).sort((a,b)=>a.element.compareDocumentPosition(b.element)&Node.DOCUMENT_POSITION_FOLLOWING?-1:1)[0];
 }
 function positionCaret(typing=false){
  if(!allowed()){caret.hidden=true;return;}
  if(!active||!available(active)||active.count===active.total)active=next()||active;
  if(!active||!available(active)){caret.hidden=true;return;}
  let rect:DOMRect|undefined,x=0;
  if(active.letters){
   const letter=active.letters[Math.max(0,active.count-1)];rect=letter?.getBoundingClientRect();
   if(rect)x=active.count?rect.right+2:rect.left;
  }else if(active.ink&&active.tail){
   const range=document.createRange();
   if(active.count){range.setStart(active.ink,Math.max(0,active.ink.length-1));range.setEnd(active.ink,active.ink.length);}
   else{range.setStart(active.tail,0);range.setEnd(active.tail,Math.min(1,active.tail.length));}
   const rects=range.getClientRects();rect=rects[rects.length-1];
   if(rect)x=active.count?rect.right+1:rect.left;
  }
  const top=document.querySelector('.site-header')?.getBoundingClientRect().bottom||0;
  if(!rect||rect.height<=0||rect.bottom<=Math.max(0,top)||rect.top>=innerHeight||x<0||x>innerWidth-3){caret.hidden=true;return;}
  const glass=active.element.closest('.broadcast-glass')?.getBoundingClientRect();
  if(glass&&(rect.top<glass.top+14||rect.bottom>glass.bottom-14||x<glass.left+20||x>glass.right-20)){caret.hidden=true;return;}
  caret.style.left=`${x}px`;caret.style.top=`${rect.top+rect.height*.13}px`;caret.style.height=`${Math.min(52,Math.max(12,rect.height*.76))}px`;
  caret.dataset.crt=String(!!glass);caret.dataset.typing=String(typing);caret.hidden=false;
 }
 function stop(){
  if(frame)cancelAnimationFrame(frame);frame=0;previousFrame=0;credit=0;clearTimeout(idle);idle=undefined;
  positionCaret(false);
 }
 function tick(now:number){
  frame=0;
  if(!allowed()||now-lastScroll>110||credit<1){stop();return;}
  const run=next();if(!run){stop();return;}active=run;
  const delta=previousFrame?Math.min(34,now-previousFrame):16;previousFrame=now;
  const count=Math.min(Math.floor(credit),Math.max(1,Math.floor(delta*.25)),run.total-run.count);
  if(count){render(run,run.count+count);credit-=count;onKeystroke();}
  positionCaret(true);
  if(credit>=1)frame=requestAnimationFrame(tick);else stop();
 }
 function scroll(event:Event){
  const target=event.target;let distance=0;
  if(target instanceof HTMLElement&&target!==document.documentElement&&target!==document.body){
   const before=nestedPositions.get(target)||{x:0,y:0},after={x:target.scrollLeft,y:target.scrollTop};
   distance=Math.abs(after.x-before.x)+Math.abs(after.y-before.y);nestedPositions.set(target,after);
  }else{distance=Math.abs(scrollY-lastY)+Math.abs(scrollX-lastX);lastY=scrollY;lastX=scrollX;}
  if(!allowed()){stop();return;}if(distance<.5){positionCaret(!!frame);return;}
  const now=performance.now();if(now-lastScroll>110){credit=0;previousFrame=0;}
  lastScroll=now;credit=Math.min(90,credit+Math.min(distance,300)*1.1);
  clearTimeout(idle);idle=setTimeout(stop,115);
  if(!frame)frame=requestAnimationFrame(tick);
 }
 const observer=new IntersectionObserver(entries=>{
  for(const entry of entries){const run=records.get(entry.target as HTMLElement);if(run)run.visible=entry.isIntersecting;}
  positionCaret(!!frame);
 },{threshold:0});
 function track(run:TextRun){records.set(run.element,run);observer.observe(run.element);render(run,calm()?run.total:0);}
 function graphics(element:HTMLElement){
  if(element.closest('.site-header,dialog,a,button,summary,form'))return;
  const letters=[...element.querySelectorAll<SVGGElement>('[data-letter]')];if(!letters.length)return;
  const old=records.get(element);
  if(old){
   if(old.letters?.[0]===letters[0])return;
   old.letters=letters;letters.forEach((letter,i)=>letter.toggleAttribute('data-type-hidden',i>=old.count));return;
  }
  letters.forEach(letter=>letter.setAttribute('data-type-hidden',''));
  track({element,letters,count:0,total:letters.length,visible:false});
 }
 function scan(root:Element){
  if(root.closest('.scroll-type-run,.scroll-type-caret,dialog,.site-header'))return;
  const graphic=root.closest<HTMLElement>('[data-graphic-text]');if(graphic){graphics(graphic);return;}
  root.querySelectorAll<HTMLElement>('[data-graphic-text]').forEach(graphics);
  const signalLabels=[...(root.matches('[data-scroll-graphic]')?[root as HTMLElement]:[]),...root.querySelectorAll<HTMLElement>('[data-scroll-graphic]')];
  for(const element of signalLabels)if(!records.has(element))track({element,count:0,total:[...(element.dataset.scrollGraphic||'')].filter(c=>!c.match(/\s/)).length,visible:false});
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),texts:Text[]=[];
  while(walker.nextNode()){
   const text=walker.currentNode as Text;
   if(text.data.trim()&&!text.parentElement?.closest(excluded))texts.push(text);
  }
  for(const text of texts){
   const element=document.createElement('span');element.className='scroll-type-run';
   const transcript=document.createElement('span');transcript.className='scroll-type-transcript';transcript.textContent=text.data;
   const visual=document.createElement('span');visual.className='scroll-type-visual';visual.setAttribute('aria-hidden','true');
   const ink=document.createTextNode(''),tail=document.createTextNode(text.data),pending=document.createElement('span');pending.className='scroll-type-tail';pending.append(tail);visual.append(ink,pending);element.append(transcript,visual);
   text.replaceWith(element);track({element,ink,tail,chars:[...text.data],count:0,total:[...text.data].length,visible:false});
  }
 }
 document.querySelectorAll('main,.site-footer').forEach(scan);
 const mutations=new MutationObserver(changes=>{
  for(const change of changes){
   const target=change.target instanceof Element?change.target:change.target.parentElement;
   if(!target||target.closest('.scroll-type-run,.scroll-type-caret'))continue;
   const graphic=target.closest<HTMLElement>('[data-graphic-text]');
   if(graphic)graphics(graphic);
   else for(const node of change.addedNodes)if(node instanceof Element)scan(node);
  }
  for(const [element]of records)if(!element.isConnected){observer.unobserve(element);records.delete(element);}
  positionCaret(!!frame);
 });
 mutations.observe(document.querySelector('main')!,{subtree:true,childList:true});
 const sync=()=>{if(calm())records.forEach(run=>render(run,run.total));stop();};
 new MutationObserver(sync).observe(html,{attributes:true,attributeFilter:['class']});
 query.addEventListener('change',sync);document.addEventListener('visibilitychange',stop);
 window.addEventListener('scroll',scroll,{passive:true,capture:true});
 window.addEventListener('resize',()=>{lastY=scrollY;lastX=scrollX;stop();});
 // A focused or hovered control is readable immediately, including before the first scroll.
 function revealControl(event:Event){
  const target=event.target instanceof Element?event.target.closest('a,button,summary'):null;if(!target)return;
  for(const run of records.values())if(target.contains(run.element))render(run,run.total);
  positionCaret(!!frame);
 }
 document.addEventListener('focusin',revealControl);document.addEventListener('pointerover',revealControl);
 window.addEventListener('pagehide',()=>{suspended=true;stop();});
 window.addEventListener('pageshow',()=>{suspended=false;lastY=scrollY;lastX=scrollX;stop();});
}
