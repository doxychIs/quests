import {
 ACESFilmicToneMapping,AnimationMixer,Box3,HemisphereLight,LoopOnce,
 Mesh,OrthographicCamera,RectAreaLight,Scene,SRGBColorSpace,WebGLRenderer,
 type Material,type SkinnedMesh,type Group,
} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';

export interface HandController{
 duration:number;
 seek:(seconds:number)=>void;
 resize:(handBottom:number)=>void;
 setVisible:(visible:boolean)=>void;
 dispose:()=>void;
}

/** The GLB owns all geometry, materials, skinning and movement. This owns only its stage. */
export async function createHubHand(host:HTMLElement,url:string,signal:AbortSignal,onContextLost:()=>void):Promise<HandController>{
 const renderer=new WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
 renderer.setClearColor(0x000000,0);
 renderer.outputColorSpace=SRGBColorSpace;
 renderer.toneMapping=ACESFilmicToneMapping;
 renderer.toneMappingExposure=.85;
 const canvas=renderer.domElement;canvas.setAttribute('aria-hidden','true');host.append(canvas);
 const scene=new Scene(),camera=new OrthographicCamera(-1,1,1,-1,.001,5);
 const meshes:Mesh[]=[],materials=new Set<Material>();
 let mixer:AnimationMixer|undefined,root:Group|undefined,disposed=false;
 let visible=true,lastTime=-1,desiredTime=0,handBottom=host.clientHeight*.62,minY=-.195;
 const contextLost=(event:Event)=>{event.preventDefault();onContextLost()};
 canvas.addEventListener('webglcontextlost',contextLost);
 function dispose(){
  if(disposed)return;disposed=true;
  canvas.removeEventListener('webglcontextlost',contextLost);
  mixer?.stopAllAction();if(root)mixer?.uncacheRoot(root);
  const skeletons=new Set(meshes.map(m=>(m as SkinnedMesh).skeleton).filter(Boolean));
  meshes.forEach(m=>m.geometry.dispose());materials.forEach(m=>m.dispose());skeletons.forEach(s=>s.dispose());
  renderer.dispose();canvas.remove();signal.removeEventListener('abort',dispose);
 }
 signal.addEventListener('abort',dispose,{once:true});
 try{
  const response=await fetch(url,{signal,cache:'force-cache'});
  if(!response.ok)throw new Error(`Hand GLB: HTTP ${response.status}`);
  const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(await response.arrayBuffer(),'');
  root=gltf.scene;
  // Presentation change requested after the first preview: show the palm.
  // Rotate the complete imported asset; never mirror or edit its skin/geometry.
  root.rotation.y=Math.PI;
  if(signal.aborted||disposed){root.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose())}});throw new DOMException('Aborted','AbortError')}
  const clip=gltf.animations.find(a=>a.name==='INOE_Hand_10s');
  if(!clip||clip.duration<=0)throw new Error('The approved hand animation is missing');
  scene.add(root);
  root.traverse(object=>{
   if(!(object instanceof Mesh))return;
   // Animated skin/morph bounds can extend beyond their bind-pose bounds.
   object.frustumCulled=false;meshes.push(object);
   (Array.isArray(object.material)?object.material:[object.material]).forEach(m=>materials.add(m));
  });
  mixer=new AnimationMixer(root);
  const action=mixer.clipAction(clip);action.setLoop(LoopOnce,1);action.clampWhenFinished=true;
  action.play();action.paused=true;
  // Seeking a paused action leaves it enabled even at the end of the clip.
  function applyTime(seconds:number){action.time=Math.max(0,Math.min(clip!.duration,seconds));mixer!.update(0);root!.updateMatrixWorld(true)}
  applyTime(clip.duration);minY=new Box3().setFromObject(root,true).min.y;
  RectAreaLightUniformsLib.init();
  scene.add(new HemisphereLight(0xdde7ff,0x111219,.16));
  const softbox=(color:number,intensity:number,width:number,height:number,x:number,y:number,z:number)=>{
   const light=new RectAreaLight(color,intensity,width,height);light.position.set(x,y,z);light.lookAt(0,-.07,0);scene.add(light);
  };
  softbox(0xf4f5ff,3.8,.40,.52,-.22,.10,.32);
  softbox(0xcbd8f3,.75,.35,.46,.27,-.06,.23);
  softbox(0xffffff,1.8,.22,.48,.13,.01,-.15);
  softbox(0xe5e9ff,.6,.25,.18,-.05,-.30,.18);
  function render(){
   if(disposed||!visible||document.hidden)return;
   applyTime(desiredTime);renderer.render(scene,camera);lastTime=desiredTime;
  }
  function resize(bottom:number){
   if(disposed)return;handBottom=bottom;
   const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);
   renderer.setPixelRatio(Math.min(devicePixelRatio||1,matchMedia('(max-width:760px)').matches?1.25:1.5));
   renderer.setSize(width,height,false);
   const span=.40,top=minY+handBottom/height*span,centre=top-span/2;
   camera.left=-span*width/height/2;camera.right=-camera.left;camera.top=span/2;camera.bottom=-span/2;
   camera.position.set(-.0072,centre,.8);camera.lookAt(-.0072,centre,0);camera.updateProjectionMatrix();lastTime=-1;render();
  }
  desiredTime=0;resize(handBottom);applyTime(0);
  await renderer.compileAsync(scene,camera);
  if(disposed||signal.aborted)throw new DOMException('Aborted','AbortError');
  host.dataset.handDuration=String(clip.duration);host.dataset.handTracks=String(clip.tracks.length);host.dataset.handReady='true';
  return {
   duration:clip.duration,
   seek(seconds){desiredTime=Math.max(0,Math.min(clip.duration,seconds));host.dataset.handTime=desiredTime.toFixed(4);if(lastTime!==desiredTime)render()},
   resize,
   setVisible(value){if(visible===value)return;visible=value;if(value)render()},
   dispose,
  };
 }catch(error){dispose();throw error}
}
