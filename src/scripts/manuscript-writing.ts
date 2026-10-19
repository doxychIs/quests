import {createVisibleLoop} from './visible-loop';

/** Перо проходит по связным словам. Исходный текст остаётся в DOM и доступен сразу. */
export function initManuscriptWriting(){
 if(document.body.dataset.world!=='arhiv')return;
 const query=matchMedia('(prefers-reduced-motion: reduce)');
 const calm=()=>query.matches||document.documentElement.classList.contains('calm');
 if(calm())return;
 const selector='[data-manuscript-write],.experience-copy>h2,.experience-copy>p,.trial-heading>h2,.world-gift h2,.world-ending h2,.detail-heading>h1,.story-lead,.quest-story h2';
 const finishers:(()=>void)[]=[];
 document.querySelectorAll<HTMLElement>(selector).forEach(root=>{
  if(root.dataset.writingState||root.closest('button,a,dialog,[aria-live]'))return;
  const words:{element:HTMLSpanElement;weight:number}[]=[];
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes:Text[]=[];let node:Node|null;
  while((node=walker.nextNode()))nodes.push(node as Text);
  nodes.forEach(text=>{
   const fragment=document.createDocumentFragment();
   text.data.split(/(\s+)/).filter(Boolean).forEach(part=>{
    if(/^\s+$/.test(part)){fragment.append(document.createTextNode(part));return}
    const element=document.createElement('span');element.className='manuscript-word';element.textContent=part;
    words.push({element,weight:[...part].length});fragment.append(element);
   });text.replaceWith(fragment);
  });
  if(!words.length)return;
  root.dataset.writingState='pending';
  const total=words.reduce((sum,w)=>sum+w.weight,0),duration=Math.min(5.5,Math.max(1.5,total*.045));
  let elapsed=0,done=false;
  const finish=()=>{
   if(done)return;done=true;root.dataset.writingState='complete';
   words.forEach(({element})=>{element.style.removeProperty('--ink');element.classList.remove('is-writing');element.classList.add('is-written')});
  };
  const loop=createVisibleLoop(root,(_time,dt)=>{
   if(calm()){finish();return}
   elapsed+=dt;root.dataset.writingState='writing';
   const credit=Math.min(total,elapsed/duration*total);let before=0;
   words.forEach(({element,weight})=>{
    const progress=Math.max(0,Math.min(1,(credit-before)/weight));before+=weight;
    element.style.setProperty('--ink',`${(progress*100).toFixed(2)}%`);
    element.classList.toggle('is-writing',progress>0&&progress<1);element.classList.toggle('is-written',progress===1);
   });if(elapsed>=duration)finish();
  },()=>!done);
  finishers.push(()=>{finish();loop.sync()});
 });
 const preferences=()=>{if(calm())finishers.forEach(finish=>finish())};
 query.addEventListener('change',preferences);
 new MutationObserver(preferences).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
}
