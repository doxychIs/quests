/** Keep the initial scroll at its starting pose until the real scene is prepared. */
export function createHubLoader(root:HTMLElement|undefined,onSkip:()=>void){
 const doc=root?.ownerDocument,win=doc?.defaultView;
 let finished=!root||root.hidden||!doc||!win,timer=0;
 const blocked:HTMLElement[]=[];
 const prevent=(event:Event)=>event.preventDefault();
 const key=(event:KeyboardEvent)=>{
  if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)&&!(event.target instanceof win!.HTMLButtonElement))event.preventDefault();
 };
 function release(){
  doc!.documentElement.classList.remove('hub-loading');
  doc!.querySelector('main')?.removeAttribute('aria-busy');
  blocked.forEach(node=>{node.removeAttribute('inert');node.removeAttribute('data-hub-loading-inert')});
  doc!.removeEventListener('wheel',prevent);doc!.removeEventListener('touchmove',prevent);doc!.removeEventListener('keydown',key);
 }
 function finish(){
  if(finished)return;finished=true;release();
  root!.dataset.loaderState='ready';root!.dispatchEvent(new win!.Event('inoe:loader-finished'));
  if(root!.contains(doc!.activeElement))(doc!.activeElement as HTMLElement)?.blur();
  timer=win!.setTimeout(()=>{root!.hidden=true},320);
 }
 const skip=()=>{if(!finished)onSkip()};
 if(!finished){
  doc!.querySelector('main')?.setAttribute('aria-busy','true');
  doc!.querySelectorAll<HTMLElement>('header.hub-header,main > :not([data-hub-loader]):not(script),.site-footer,.skip-link').forEach(node=>{
   if(!node.hasAttribute('inert')){node.setAttribute('inert','');node.setAttribute('data-hub-loading-inert','');blocked.push(node)}
  });
  doc!.addEventListener('wheel',prevent,{passive:false});doc!.addEventListener('touchmove',prevent,{passive:false});doc!.addEventListener('keydown',key);
  root!.querySelector('[data-hub-loader-skip]')?.addEventListener('click',skip);
 }
 return {finish,dispose(){if(!root||!doc||!win)return;finish();win.clearTimeout(timer);root.hidden=true;root.querySelector('[data-hub-loader-skip]')?.removeEventListener('click',skip)}};
}
