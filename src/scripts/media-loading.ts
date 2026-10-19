import {prepareVideo} from '../lib/video-loading';
export function initMediaLoading(){
 const dialog=document.querySelector<HTMLDialogElement>('[data-page-loader]');if(!dialog)return;
 const hero=document.querySelector<HTMLVideoElement>('[data-hero-video],[data-horror-film]');
 const passage=document.querySelector<HTMLVideoElement>('[data-scroll-film],[data-passage-film]');
 const videos=[hero,passage].filter((v):v is HTMLVideoElement=>!!v);
 const loading=videos.map(v=>prepareVideo(v,v===passage));
 const query=matchMedia('(prefers-reduced-motion: reduce)');
 const permitted=()=>!query.matches&&!document.documentElement.classList.contains('calm')&&(document.body.dataset.world!=='iznanka'||document.documentElement.classList.contains('adult'));
 const message=dialog.querySelector<HTMLElement>('[data-load-message]')!,initial=message.textContent;
 const progress=dialog.querySelector<HTMLProgressElement>('[data-load-progress]')!,percent=dialog.querySelector<HTMLElement>('[data-load-percent]')!;
 const retry=dialog.querySelector<HTMLButtonElement>('[data-load-retry]')!;
 let dismissed=false,started=false,showTimer:ReturnType<typeof setTimeout>|undefined;
 function close(){clearTimeout(showTimer);showTimer=undefined;if(dialog!.open)dialog!.close()}
 function update(){
  if(!permitted()){close();return}if(dismissed||!started)return;
  const ready=loading.every(l=>l.state.phase==='ready'),failed=loading.some(l=>l.state.phase==='error');
  if(ready){dismissed=true;close();return}
  retry.hidden=!failed;message.textContent=failed?'Видео пока недоступно. Можно повторить загрузку или войти с иллюстрациями.':initial;
  const known=loading.some(l=>l.state.progress!==null),amount=Math.floor(loading.reduce((sum,l)=>sum+(l.state.progress||0),0)/Math.max(1,loading.length)*100);
  if(known){progress.value=amount;percent.textContent=`${amount}%`}else{progress.removeAttribute('value');percent.textContent=''}
 }
 function begin(){
  if(!permitted()||document.hidden)return;
  if(!started){started=true;showTimer=setTimeout(()=>{showTimer=undefined;if(!dismissed&&permitted()&&!loading.every(l=>l.state.phase==='ready'))dialog!.showModal()},140)}
  loading.forEach(l=>l.start());update();
 }
 videos.forEach(v=>v.addEventListener('video:state',update));
 retry.addEventListener('click',()=>{loading.forEach(l=>{if(l.state.phase==='error')l.retry()});update()});
 const dismiss=()=>{dismissed=true;close()};
 dialog.querySelector('[data-load-skip]')!.addEventListener('click',dismiss);dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss()});
 new MutationObserver(()=>{if(permitted())begin();else close()}).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
 query.addEventListener('change',()=>{if(permitted())begin();else close()});document.addEventListener('visibilitychange',begin);
 addEventListener('pagehide',close);begin();
}

/** Небольшое состояние прямо в сцене остаётся доступно после пропуска заставки. */
export function bindSceneLoading(video:HTMLVideoElement,scene:HTMLElement,complete=true){
 const loader=prepareVideo(video,complete),panel=scene.querySelector<HTMLElement>('[data-scene-loading]');
 if(!panel)return loader;
 const message=panel.querySelector<HTMLElement>('[data-scene-load-message]')!,progress=panel.querySelector<HTMLProgressElement>('progress')!,retry=panel.querySelector<HTMLButtonElement>('button')!;
 function paint(){
  const state=loader.state,quiet=matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.classList.contains('calm');
  panel!.hidden=quiet||state.phase==='idle'||state.phase==='ready';retry.hidden=state.phase!=='error';
  message.textContent=state.phase==='error'?'Видео не загрузилось. Попробуем ещё раз?':'Готовим сцену…';
  if(state.progress===null)progress.removeAttribute('value');else progress.value=state.progress*100;
 }
 video.addEventListener('video:state',paint);retry.addEventListener('click',()=>loader.retry());
 new MutationObserver(paint).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
 paint();return loader;
}
