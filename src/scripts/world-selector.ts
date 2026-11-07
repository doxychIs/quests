export function initWorldSelector(){
 const root=document.querySelector<HTMLElement>('[data-world-selector]');if(!root)return;
 const links=[...root.querySelectorAll<HTMLAnchorElement>('[data-world-zone]')];
 function select(world=''){
  root!.dataset.activeWorld=world;
  links.forEach(link=>link.classList.toggle('is-current',link.dataset.worldZone===world));
 }
 links.forEach(link=>{
  link.addEventListener('pointerenter',()=>select(link.dataset.worldZone!));
  link.addEventListener('pointerleave',()=>{if(document.activeElement!==link)select()});
  link.addEventListener('focus',()=>select(link.dataset.worldZone!));
  link.addEventListener('blur',()=>select());
 });
 select();
}
