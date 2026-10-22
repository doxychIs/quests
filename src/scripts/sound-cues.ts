export type SoundCue='tuner'|'channel'|'open'|'close'|'select'|'found'|'complete';

/** События от подтверждённых действий; наведение и прокрутка страницы беззвучны. */
export function soundCue(cue:SoundCue){
 document.dispatchEvent(new CustomEvent<SoundCue>('gran-sound',{detail:cue}));
}

export function initSoundInteractions(play:(cue:SoundCue)=>void){
 document.addEventListener('gran-sound',event=>play((event as CustomEvent<SoundCue>).detail));
 document.addEventListener('click',event=>{
  if(event.button!==0||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
  const target=event.target instanceof Element?event.target:null;
  if(target?.closest('a[data-world-zone],[data-portal] a,a[data-quest-link]'))play('select');
  else if(target?.closest('.settings-toggle,[data-lightbox-src]'))play('open');
 });
 document.addEventListener('close',event=>{
  if(event.target instanceof HTMLDialogElement&&event.target.id!=='age-gate')play('close');
 },true);
 document.addEventListener('toggle',event=>{
  if(event.target instanceof HTMLDetailsElement)play('select');
 },true);
}
