import {
 ACESFilmicToneMapping,AnimationMixer,Group,HemisphereLight,LoopOnce,
 HalfFloatType,Mesh,OrthographicCamera,PerspectiveCamera,RectAreaLight,Scene,SRGBColorSpace,Vector3,WebGLRenderer,WebGLRenderTarget,
 type Material,type SkinnedMesh,
} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {createHandAtmosphere,type HandPresentation} from './hub-atmosphere';
import {createHandGlow} from './hub-hand-glow';
import {HAND_ASSET_ROLL,HAND_LEVER_LENGTH,handStagePose} from '../lib/hub-hand-motion';

export interface HandAnchor{x:number;y:number;top:number}

export interface HandController{
 duration:number;
 readonly anchor:HandAnchor;
 seek:(seconds:number,presentation?:HandPresentation)=>void;
 resize:()=>void;
 setVisible:(visible:boolean)=>void;
 dispose:()=>void;
}

/** The GLB owns geometry, materials and finger articulation; parent groups stage the rigid arm. */
export async function createHubHand(host:HTMLElement,url:string,signal:AbortSignal,onContextLost:()=>void,onAnchorChange:()=>void=()=>{}):Promise<HandController>{
 const renderer=new WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
 renderer.setClearColor(0x000000,0);
 renderer.outputColorSpace=SRGBColorSpace;
 renderer.toneMapping=ACESFilmicToneMapping;
 renderer.toneMappingExposure=.85;
 const canvas=renderer.domElement;canvas.setAttribute('aria-hidden','true');host.append(canvas);
 const scene=new Scene(),camera=new PerspectiveCamera(34,1,.02,8);
 const pivot=new Group(),swing=new Group(),wristOffset=new Group();
 scene.add(pivot);pivot.add(swing);swing.add(wristOffset);wristOffset.position.y=HAND_LEVER_LENGTH;
 const background=new Scene(),compositionCamera=new OrthographicCamera(-1,1,1,-1,.1,5);compositionCamera.position.z=1;
 const meshes:Mesh[]=[],materials=new Set<Material>();
 let mixer:AnimationMixer|undefined,root:Group|undefined,disposed=false;
 let visible=true,lastTime=-1,lastArrival=-1,desiredTime=0,span=.56;
 let atmosphere:ReturnType<typeof createHandAtmosphere>|undefined,frame=0,lastFrame=0,clock=0;
 let handTarget:WebGLRenderTarget|undefined,glow:ReturnType<typeof createHandGlow>|undefined,lastPaint=0;
 const focus=new Vector3(0,-.5,0),crown=new Vector3(0,.05,0),tip=new Vector3(),parentJoint=new Vector3(),distal=new Vector3(),wristLocal=new Vector3();
 const anchor:HandAnchor={x:.5,y:.72,top:.52};
 let pointerX=0,pointerY=0,targetX=0,targetY=0;
 let presentation:HandPresentation={presence:0,opening:0,progress:0};
 const pointerMove=(event:PointerEvent)=>{
  if(!visible||presentation.presence<.001||event.pointerType==='touch')return;
  const rect=host.getBoundingClientRect();
  targetX=Math.max(-1,Math.min(1,(event.clientX-rect.left)/Math.max(1,rect.width)*2-1));
  targetY=Math.max(-1,Math.min(1,1-(event.clientY-rect.top)/Math.max(1,rect.height)*2));
 };
 const pointerLeave=()=>{targetX=targetY=0};
 addEventListener('pointermove',pointerMove,{passive:true});document.addEventListener('pointerleave',pointerLeave);
 const contextLost=(event:Event)=>{event.preventDefault();onContextLost()};
 canvas.addEventListener('webglcontextlost',contextLost);
 function dispose(){
  if(disposed)return;disposed=true;
  cancelAnimationFrame(frame);atmosphere?.dispose();
  handTarget?.dispose();glow?.dispose();
  removeEventListener('pointermove',pointerMove);document.removeEventListener('pointerleave',pointerLeave);
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
  // One fixed orientation for the whole clip: forearm below, dorsal fist toward camera.
  // A forward X pitch then turns this same hand palm-up; no yaw, roll or mirroring.
  root.rotation.set(0,0,HAND_ASSET_ROLL);
  if(signal.aborted||disposed){root.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose())}});throw new DOMException('Aborted','AbortError')}
  const clip=gltf.animations.find(a=>a.name==='INOE_Hand_10s');
  const wrist=root.getObjectByName('wrist'),palm=root.getObjectByName('middle_palm');
  const fingertips=['index_3','middle_3','ring_3','pinky_3','thumb_3'].map(name=>root!.getObjectByName(name)).filter(Boolean);
  if(!clip||clip.duration<=0)throw new Error('The approved hand animation is missing');
  if(!wrist||!palm)throw new Error('The approved hand wrist and palm anchors are missing');
  wristOffset.add(root);
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
  function applyTime(seconds:number){
   action.time=Math.max(0,Math.min(clip!.duration,seconds));mixer!.update(0);
   // Cancel only the baked straight descent. All bones, skin weights and morphs stay intact.
   root!.position.set(0,0,0);root!.updateMatrixWorld(true);
   wrist!.getWorldPosition(wristLocal);root!.worldToLocal(wristLocal);wristLocal.applyQuaternion(root!.quaternion);
   root!.position.copy(wristLocal).negate();
   const pose=handStagePose(presentation.arrival??0);
   pivot.position.set(pose.pivotX,pose.pivotY,pose.pivotZ);
   swing.rotation.set(pose.rotationX,pose.rotationY,pose.rotationZ);
   pivot.updateMatrixWorld(true);
  }
  function updateAnchor(){
   palm!.getWorldPosition(focus);focus.project(camera);
   let top=focus.y;
   for(const finger of fingertips){
    if(!finger?.parent)continue;
    finger.getWorldPosition(tip);finger.parent.getWorldPosition(parentJoint);
    distal.subVectors(tip,parentJoint);tip.addScaledVector(distal,.95).project(camera);top=Math.max(top,tip.y);
   }
   // A palm-up forearm recedes behind the wrist. Keep the word above its cuff too.
   pivot.getWorldPosition(tip);tip.y+=.032;tip.project(camera);top=Math.max(top,tip.y);
   crown.set(focus.x,Math.min(.88,top+.12),0);
   const x=(focus.x+1)/2,y=(1-focus.y)/2,highest=(1-top)/2;
   if(Math.abs(anchor.x-x)+Math.abs(anchor.y-y)+Math.abs(anchor.top-highest)>.0001){
    anchor.x=x;anchor.y=y;anchor.top=highest;onAnchorChange();
   }
  }
  RectAreaLightUniformsLib.init();
  scene.add(new HemisphereLight(0xdde7ff,0x111219,.16));
  const softbox=(color:number,intensity:number,width:number,height:number,x:number,y:number,z:number)=>{
   const light=new RectAreaLight(color,intensity,width,height);light.position.set(x,y,z);light.lookAt(0,-.07,0);scene.add(light);
   return light;
  };
  const key=softbox(0xf4f5ff,3.8,.40,.52,-.22,.10,.32);
  softbox(0xcbd8f3,.75,.35,.46,.27,-.06,.23);
  const rim=softbox(0xffffff,1.8,.22,.48,.13,.01,-.15);
  softbox(0xe5e9ff,.6,.25,.18,-.05,-.30,.18);
  // Cache an idle pose. Moving dust needs only the lightweight background and this quad.
  handTarget=new WebGLRenderTarget(1,1,{type:HalfFloatType,samples:2});
  glow=createHandGlow(renderer,handTarget.texture,background);
  atmosphere=createHandAtmosphere(background,matchMedia('(max-width:760px)').matches);
  function schedule(){if(!frame&&!disposed&&visible&&!document.hidden)frame=requestAnimationFrame(render)}
  function render(now:number){
   frame=0;
   if(disposed||!visible||document.hidden)return;
   const poseChanged=lastTime!==desiredTime||lastArrival!==(presentation.arrival??0);
   if(!poseChanged&&lastPaint&&now-lastPaint<1000/30){if(presentation.presence>.001)schedule();return}
   const delta=lastFrame?Math.min(.05,(now-lastFrame)/1000):0;lastFrame=now;clock+=delta;
   const settle=1-Math.exp(-delta*3);
   pointerX+=(targetX-pointerX)*settle;pointerY+=(targetY-pointerY)*settle;
   key.intensity=3.05+presentation.opening*.75;
   rim.intensity=1.8+presentation.opening*1.1;
   renderer.toneMappingExposure=.72+presentation.opening*.13;
   if(poseChanged){
    applyTime(desiredTime);renderer.setRenderTarget(handTarget!);renderer.render(scene,camera);renderer.setRenderTarget(null);
    glow!.refresh();
    updateAnchor();
   }
   glow!.setStrength((.30+presentation.opening*.82)*presentation.presence);
   atmosphere!.update(presentation,clock,pointerX,pointerY,focus,crown);
   renderer.render(background,compositionCamera);lastTime=desiredTime;lastArrival=presentation.arrival??0;lastPaint=now;
   if(presentation.presence>.001)schedule();
  }
  function resize(){
   if(disposed)return;
   const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);
   renderer.setPixelRatio(Math.min(devicePixelRatio||1,matchMedia('(max-width:760px)').matches?1.25:1.5));
   renderer.setSize(width,height,false);
   handTarget!.setSize(Math.round(width*renderer.getPixelRatio()),Math.round(height*renderer.getPixelRatio()));
   glow!.resize(width,height,renderer.getPixelRatio());
   atmosphere!.resize(width,height,renderer.getPixelRatio());
   camera.aspect=width/height;span=Math.max(.56,.29/camera.aspect);
   camera.position.set(0,.22,span/(2*Math.tan(camera.fov*Math.PI/360)));camera.lookAt(0,-.04,0);
   camera.updateProjectionMatrix();lastTime=-1;schedule();
  }
  desiredTime=0;resize();applyTime(0);
  await renderer.compileAsync(scene,camera);
  if(disposed||signal.aborted)throw new DOMException('Aborted','AbortError');
  host.dataset.handDuration=String(clip.duration);host.dataset.handTracks=String(clip.tracks.length);host.dataset.handReady='true';
  return {
   duration:clip.duration,
   get anchor(){return anchor},
   seek(seconds,state){desiredTime=Math.max(0,Math.min(clip.duration,seconds));if(state)presentation=state;host.dataset.handTime=desiredTime.toFixed(4);schedule()},
   resize,
   setVisible(value){if(visible===value)return;visible=value;lastFrame=0;if(value)schedule();else{cancelAnimationFrame(frame);frame=0}},
   dispose,
  };
 }catch(error){dispose();throw error}
}
