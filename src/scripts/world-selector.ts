export function initWorldSelector(){
 const root=document.querySelector<HTMLElement>('[data-world-selector]');if(!root)return;
 const links=[...root.querySelectorAll<HTMLAnchorElement>('[data-world-zone]')];
 function select(world:string){
  root!.dataset.activeWorld=world;
  root!.querySelectorAll<HTMLElement>('[data-scene]').forEach(s=>s.classList.toggle('is-current',s.dataset.scene===world));
  links.forEach(link=>link.classList.toggle('is-current',link.dataset.worldZone===world));
  const caption=root!.querySelector<HTMLElement>('[data-selector-caption]'),selected=links.find(link=>link.dataset.worldZone===world);if(caption&&selected?.dataset.worldCaption)caption.textContent=selected.dataset.worldCaption;
 }
 links.forEach(link=>{link.addEventListener('pointerenter',()=>select(link.dataset.worldZone!));link.addEventListener('focus',()=>select(link.dataset.worldZone!));link.addEventListener('pointerdown',()=>select(link.dataset.worldZone!));});
 select('arhiv');
}
