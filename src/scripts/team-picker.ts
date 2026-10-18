/** Team limits come from the quest data rendered by Astro, never from a second catalogue. */
export function initTeamPickers(scope:ParentNode=document){
 scope.querySelectorAll<HTMLElement>('[data-team-picker]').forEach(root=>{
  const inputs=root.querySelectorAll<HTMLInputElement>('input[name="team-size"]');
  const rows=Array.from(root.querySelectorAll<HTMLElement>('[data-team-quest]'));
  const names=new Map(rows.map(row=>[row,row.querySelector('h3')?.textContent||'']));
  const status=root.querySelector<HTMLElement>('[data-team-status]');
  function update(){
   const selected=root.querySelector<HTMLInputElement>('input[name="team-size"]:checked');
   const players=Number(selected?.value);
   if(!Number.isInteger(players)||players<2||players>6)return;
   let matches=0;
   rows.forEach(row=>{
    const min=Number(row.dataset.min),max=Number(row.dataset.max),fits=players>=min&&players<=max;
    const link=row.querySelector<HTMLAnchorElement>('[data-team-book]');
    const note=row.querySelector<HTMLElement>('[data-team-unavailable]');
    row.dataset.suitable=String(fits);
    if(fits)matches++;
    if(link){
     const url=new URL(link.href,location.href);url.searchParams.set('players',String(players));link.href=url.href;
     link.hidden=!fits;
     link.setAttribute('aria-label',`Выбрать квест «${names.get(row)}» для ${players} игроков`);
    }
    if(note){note.hidden=fits;note.textContent=players<min?`От ${min} игроков`:`До ${max} игроков`;}
   });
   if(status)status.textContent=matches===rows.length?`Подходят все ${matches} квеста`:matches===1?'Подходит 1 квест':`Подходят ${matches} квеста`;
  }
  inputs.forEach(input=>input.addEventListener('change',update));
  update();
 });
}
