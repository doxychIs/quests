/** Один запрос на ролик. Пролёт целиком в памяти: перемотка больше не ждёт сеть. */
export type VideoLoadState={phase:'idle'|'loading'|'ready'|'error';progress:number|null;bytes:number};
const loaders=new WeakMap<HTMLVideoElement,ReturnType<typeof makeLoader>>();
export function videoSource(video:HTMLVideoElement){
 const connection=(navigator as Navigator&{connection?:{saveData?:boolean;effectiveType?:string}}).connection;
 const small=matchMedia('(max-width:760px)').matches||connection?.saveData||/^(slow-)?2g$/.test(connection?.effectiveType||'');
 return small&&video.dataset.srcMobile?video.dataset.srcMobile:video.dataset.src||'';
}
export function prepareVideo(video:HTMLVideoElement,complete=false){
 let loader=loaders.get(video);if(!loader){loader=makeLoader(video,complete);loaders.set(video,loader)}return loader;
}
function makeLoader(video:HTMLVideoElement,complete:boolean){
 const state:VideoLoadState={phase:'idle',progress:null,bytes:0};
 let controller:AbortController|undefined,objectURL='',sourceAssigned=false,timer:ReturnType<typeof setTimeout>|undefined,generation=0;
 const notify=()=>{video.dataset.mediaState=state.phase;video.dispatchEvent(new CustomEvent('video:state'))};
 const clear=()=>{clearTimeout(timer);timer=undefined};
 function fail(){if(state.phase!=='loading'&&state.phase!=='ready')return;clear();state.phase='error';controller?.abort();notify()}
 function decoded(){if(state.phase!=='loading'||video.readyState<2||(complete&&!sourceAssigned))return;clear();state.phase='ready';state.progress=1;notify()}
 function nativeProgress(){if(complete||state.phase!=='loading')return;let buffered=0;for(let i=0;i<video.buffered.length;i++)buffered+=video.buffered.end(i)-video.buffered.start(i);state.progress=Number.isFinite(video.duration)&&video.duration>0?Math.min(.95,buffered/video.duration):null;notify()}
 video.muted=true;
 video.addEventListener('loadeddata',decoded);video.addEventListener('canplay',decoded);video.addEventListener('progress',nativeProgress);video.addEventListener('error',()=>{if(sourceAssigned)fail()});
 async function download(url:string,run:number){
  controller=new AbortController();
  const response=await fetch(url,{signal:controller.signal,cache:'force-cache'});
  if(!response.ok)throw new Error('Видео недоступно');
  const type=response.headers.get('content-type')||'video/mp4';if(!type.includes('video/')&&!type.includes('octet-stream'))throw new Error('Некорректный файл видео');
  const total=Number(response.headers.get('content-length'));
  const chunks:BlobPart[]=[];
  if(response.body){const reader=response.body.getReader();while(true){const {done,value}=await reader.read();if(run!==generation||state.phase!=='loading'){await reader.cancel();return}if(done)break;chunks.push(value.slice().buffer);state.bytes+=value.byteLength;state.progress=total>0?Math.min(.98,state.bytes/total*.98):null;notify()}}
  else{const bytes=await response.arrayBuffer();chunks.push(bytes);state.bytes=bytes.byteLength}
  if(run!==generation||state.phase!=='loading')return;
  objectURL=URL.createObjectURL(new Blob(chunks,{type}));sourceAssigned=true;video.src=objectURL;
 }
 function start(retry=false){
  if(!retry&&(state.phase==='loading'||state.phase==='ready'))return;
  generation++;controller?.abort();clear();sourceAssigned=false;if(objectURL){URL.revokeObjectURL(objectURL);objectURL=''}
  state.phase='loading';state.progress=null;state.bytes=0;notify();
  timer=setTimeout(fail,30000);
  const url=videoSource(video);if(!url){fail();return}
  video.preload='auto';
  if(complete&&typeof fetch==='function'&&typeof URL.createObjectURL==='function'){const run=generation;void download(url,run).catch(()=>{if(run===generation&&state.phase==='loading')fail()})}
  else{sourceAssigned=true;video.src=url;if(retry)video.load();decoded()}
 }
 addEventListener('pagehide',event=>{if((event as PageTransitionEvent).persisted)return;generation++;controller?.abort();clear();if(objectURL)URL.revokeObjectURL(objectURL)});
 return {state,start,retry:()=>start(true)};
}
