/** Rare failures are scheduled only for visible lettering, never a repeating CSS loop. */
export function initLetterFailures(){
 if(document.body.dataset.world!=='iznanka')return;
 const query=matchMedia('(prefers-reduced-motion: reduce)');let suspended=false;
 type State={visible:boolean;timer:ReturnType<typeof setTimeout>|undefined;animation:Animation|undefined;last:number};
 const states=new Map<HTMLElement,State>();
 const allowed=(element:HTMLElement,state:State)=>state.visible&&!suspended&&!document.hidden&&!query.matches&&!document.documentElement.classList.contains('calm')&&(!element.closest('.restricted')||document.documentElement.classList.contains('adult'));
 function stop(state:State){clearTimeout(state.timer);state.timer=undefined;state.animation?.cancel();state.animation=undefined}
 function schedule(element:HTMLElement,state:State,initial=false){
  if(!allowed(element,state)){stop(state);return}if(state.timer||state.animation)return;
  // One event per visible word group every 13–38 seconds; each occurrence has its own clock.
  state.timer=setTimeout(()=>{
   state.timer=undefined;if(!allowed(element,state))return;
   const letters=[...element.querySelectorAll<SVGGElement>('[data-letter-ink]')];if(!letters.length)return;
   let index=Math.floor(Math.random()*letters.length);if(index===state.last&&letters.length>1)index=(index+1)%letters.length;state.last=index;
   const letter=letters[index],normal=Number(letter.getAttribute('opacity')||1),dim=normal*(.17+Math.random()*.3),duration=680+Math.random()*260;
   state.animation=letter.animate([{opacity:normal,offset:0},{opacity:dim,offset:.29},{opacity:dim*.85,offset:.53},{opacity:normal*.83,offset:.72},{opacity:normal,offset:1}],{duration,easing:'linear'});
   element.dataset.letterFailure=String(index);
   element.dataset.letterEvents=String(Number(element.dataset.letterEvents||0)+1);
   state.animation.finished.then(()=>{state.animation=undefined;delete element.dataset.letterFailure;schedule(element,state)}).catch(()=>{delete element.dataset.letterFailure});
  },initial?6500+Math.random()*14000:13000+Math.random()*25000);
 }
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){const el=entry.target as HTMLElement,state=states.get(el)!;state.visible=entry.isIntersecting;if(state.visible)schedule(el,state,true);else stop(state)}},{threshold:.05});
 document.querySelectorAll<HTMLElement>('[data-letter-flicker=rare]').forEach(el=>{const state:State={visible:false,timer:undefined,animation:undefined,last:-1};states.set(el,state);observer.observe(el)});
 const sync=()=>{for(const [el,state]of states)if(allowed(el,state))schedule(el,state,true);else stop(state)};
 document.addEventListener('visibilitychange',sync);query.addEventListener('change',sync);
 new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
 addEventListener('pagehide',()=>{suspended=true;states.forEach(stop)});addEventListener('pageshow',()=>{suspended=false;sync()});
}
