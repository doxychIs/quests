import {ACESFilmicToneMapping,BufferGeometry,CanvasTexture,Color,DirectionalLight,Float32BufferAttribute,FogExp2,HemisphereLight,Mesh,MeshStandardMaterial,LinearFilter,PCFShadowMap,PerspectiveCamera,PlaneGeometry,PointLight,Points,PointsMaterial,Quaternion,Raycaster,Scene,SpotLight,SRGBColorSpace,Vector2,Vector3,WebGLRenderer,type Material,type Texture} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {drawGraphicText} from './broadcast-glyphs';
import {roomStations,type RoomPose,type RoomStationId} from './room-experience';
import type {ScreenQuad} from './crt-room';
import type {RoomAtmosphereFrame} from './room-atmosphere';
import {createRoomPixelPass,roomPixelSize} from './room-pixel';
import {addRoomBlood} from './room-blood';
import {addRoomTeamBoard} from './room-team-board';
import {addRoomFilmBeam} from './room-film-beam';
import {createRoomHands} from './room-hands';
import {addRoomEvidence} from './room-evidence';
export type RoomScreenLabel={id:string;title:string;image?:string;subtitle?:string};
export type ProjectedGlass={quad:ScreenQuad;visible:boolean;depth?:number};
export type RoomRenderState={active?:RoomStationId;hover?:RoomStationId;pulse?:string;atmosphere?:RoomAtmosphereFrame;projectorOn?:boolean;projectorTime?:number;lifeTime?:number;cameraTime?:number;cameraAmount?:number;questDetails?:boolean;calm?:boolean};

/** One WebGL context; DOM controls are projected with this exact same camera. */
export async function createRoomRenderer(canvas:HTMLCanvasElement,url:string,options:{screens:RoomScreenLabel[];invalidate?:()=>void}){
 const renderer=new WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});
 renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=ACESFilmicToneMapping;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=PCFShadowMap;renderer.shadowMap.autoUpdate=false;
 const scene=new Scene();scene.background=new Color('#04070d');scene.fog=new FogExp2('#080d15',.026);
 const camera=new PerspectiveCamera(60,1,.045,45);
 const fill=new HemisphereLight('#a4b8c5','#303941',.82);scene.add(fill);
 const key=new DirectionalLight('#a5bccb',3);key.position.set(-3.9,3.3,3);key.target.position.set(1,.3,-1.2);
 key.castShadow=true;key.shadow.mapSize.set(innerWidth<=760?512:1024,innerWidth<=760?512:1024);
 Object.assign(key.shadow.camera,{left:-8,right:8,top:10,bottom:-10,near:.2,far:26});key.shadow.bias=-.0002;key.shadow.normalBias=.025;
 scene.add(key,key.target);
 const ceiling=new PointLight('#b0bca8',11,8,2);ceiling.position.set(0,2.72,-.9);scene.add(ceiling);
 const fixtures=[{id:'ward',light:ceiling,power:11},...[10,14,18].map((z,index)=>{
  const light=new PointLight(index===1?'#92aab3':'#afb9a6',8,5.4,2);light.position.set(0,3.02,z);scene.add(light);
  return{id:'corridor_'+index,light,power:8};
 })];
 // Weak daylight from a high, dirty corridor window gives each surface a
 // direction to its light, rather than a uniform plastic ambient fill.
 const corridorKey=new DirectionalLight('#8da9bc',.6);corridorKey.position.set(-2.2,3.2,17);corridorKey.target.position.set(.8,.5,11);scene.add(corridorKey,corridorKey.target);
 const red=new PointLight('#8c1729',10,4.8,2);red.position.set(0,2.95,-6.1);scene.add(red);
 const broadcastSpill=new PointLight('#718d99',2.4,2.6,2);broadcastSpill.position.set(0,1.6,-5.08);scene.add(broadcastSpill);
 const annexLight=new PointLight('#9faeaa',13,5.5,2);annexLight.position.set(0,2.9,-9.6);scene.add(annexLight);
 const bedsideLight=new PointLight('#a9b7b2',5.2,4.6,2);bedsideLight.position.set(2.3,2.85,4.7);scene.add(bedsideLight);
 const cinemaLight=new PointLight('#9aa99e',9,6.5,2);cinemaLight.position.set(-4.2,3,-9.2);scene.add(cinemaLight);
 const laptopLight=new PointLight('#78998c',.6,1.6,2);laptopLight.position.set(-3.22,1.2,3.7);scene.add(laptopLight);
 const deskLight=new PointLight('#c3b88e',2.6,2.5,2);deskLight.position.set(.86,1.29,-10.30);scene.add(deskLight);
 const filmLight=new SpotLight('#e2e5df',0,5,.52,.65,1.7);filmLight.position.set(-4.363477,1.46,-10.440968);filmLight.target.position.set(-6.9,1.91,-9.5);scene.add(filmLight,filmLight.target);
 const textures=new Set<Texture>(),materials=new Set<Material>(),signals=new Map<string,{mesh:Mesh;material:MeshStandardMaterial;canvas:HTMLCanvasElement;texture:CanvasTexture;image?:HTMLImageElement;label:RoomScreenLabel;index:number}>();
 let alive=true;
 const cleanSignals=new Map<string,HTMLCanvasElement>();
 let model;
 try{model=await new GLTFLoader().loadAsync(url);}catch(error){renderer.dispose();throw error;}
 model.scene.traverse(object=>{
  if(!(object instanceof Mesh))return;
  const list=Array.isArray(object.material)?object.material:[object.material];list.forEach(m=>{
   materials.add(m);
   if(m instanceof MeshStandardMaterial){
    if(/Dried.*blood|Old.*blood/i.test(m.name)){m.color.set('#310b0e');m.roughness=.88;}
    for(const map of [m.map,m.normalMap,m.roughnessMap])if(map)map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
   }
  });
  object.castShadow=!list.some(m=>/plaster|paint|tile|floor|blood|glass|window/i.test(m.name));object.receiveShadow=true;
 });scene.add(model.scene);
 const blood=addRoomBlood(scene),evidence=addRoomEvidence(scene);
 const cameraOnly:Mesh[]=[];
 model.scene.traverse(o=>{if(o instanceof Mesh&&(Array.isArray(o.material)?o.material:[o.material]).some(m=>/blood|crimson|Corridor_shadowed_skin/i.test(m.name)))cameraOnly.push(o);});
 const ghosts=[0,1].map(index=>{
  const mesh=model.scene.getObjectByName('RoomGhost_'+index);if(!(mesh instanceof Mesh)||!(mesh.material instanceof MeshStandardMaterial))return;
  const material=mesh.material.clone();materials.add(material);material.transparent=true;material.opacity=.15;material.depthWrite=false;material.roughness=1;material.emissive.set('#526e61');material.emissiveIntensity=.13;
  material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nfloat veil=pow(1.-abs(dot(normal,normalize(vViewPosition))),1.7);diffuseColor.a*=.24+.76*veil;');};
  mesh.material=material;mesh.castShadow=false;mesh.receiveShadow=false;return{mesh,material,rest:mesh.position.clone(),phase:index*2.71};
 }).filter((g):g is NonNullable<typeof g>=>!!g);
 let ghostsInView=false,recording=false;
 const hands=createRoomHands(model.scene);
 const teamBoard=addRoomTeamBoard(model.scene,options.screens.filter(s=>s.id.startsWith('quest_')));
 const physical=new Map<string,MeshStandardMaterial>([['team',teamBoard.material]]),liveTextures=new Map<string,CanvasTexture>();
 const addSurface=(id:'gallery'|'info')=>{
  const station=roomStations.find(s=>s.id===id)!,source=document.createElement('canvas');source.width=960;source.height=690;
  const c=source.getContext('2d')!;c.fillStyle=id==='info'?'#96947e':'#132326';c.fillRect(0,0,960,690);
  drawGraphicText(c,id==='gallery'?'ПЛЁНКА С ПОСТА':'ИНОЕ / ИЗНАНКА',50,100,49,'#a4b2aa',117,860);
  drawGraphicText(c,id==='gallery'?'ГАЛЕРЕЯ ЛОКАЦИЙ':'ПРАВИЛА / КОНТАКТЫ / ДРУГИЕ МИРЫ',50,260,27,'#8e9f98',119,860);
  const texture=new CanvasTexture(source);texture.colorSpace=SRGBColorSpace;textures.add(texture);
  const material=new MeshStandardMaterial({map:id==='gallery'?null:texture,color:id==='gallery'?'#6b7161':'#ffffff',transparent:false,depthWrite:true,roughness:.95,metalness:0,emissive:'#92a6aa',emissiveMap:id==='gallery'?null:texture,emissiveIntensity:0});materials.add(material);physical.set(id,material);
  const mesh=new Mesh(new PlaneGeometry(station.width,station.height),material);mesh.name='RoomScreen_'+id;mesh.position.set(...station.center);mesh.rotation.y=station.rotationY||0;mesh.receiveShadow=true;model.scene.add(mesh);
 };addSurface('gallery');addSurface('info');
 const beam=addRoomFilmBeam(scene,filmLight.position,filmLight.target.position,2.5,1.80);
 let projectionTexture:CanvasTexture|undefined,projectionURL='',projectionRequest=0;
 function setProjection(url:string){
  if(!url||url===projectionURL)return;projectionURL=url;const request=++projectionRequest,image=new Image();image.decoding='async';
  image.onload=()=>{
   if(!alive||request!==projectionRequest)return;
   const source=document.createElement('canvas');source.width=1536;source.height=1102;
   const context=source.getContext('2d')!;context.fillStyle='#a9aca2';context.fillRect(0,0,source.width,source.height);
   const scale=Math.min(source.width/image.naturalWidth,source.height/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;
   context.filter='brightness(.82)';context.drawImage(image,(source.width-w)/2,(source.height-h)/2,w,h);context.filter='none';
   if(projectionTexture){projectionTexture.dispose();textures.delete(projectionTexture);}
   projectionTexture=new CanvasTexture(source);projectionTexture.colorSpace=SRGBColorSpace;projectionTexture.minFilter=projectionTexture.magFilter=LinearFilter;textures.add(projectionTexture);canvas.dataset.roomProjection='ready';options.invalidate?.();
  };image.onerror=()=>{if(request===projectionRequest){projectionURL='';canvas.dataset.roomProjection='error';}};canvas.dataset.roomProjection='loading';image.src=url;
 }
 const reels=[0,1].map(i=>model.scene.getObjectByName('RoomFilmReel_'+i));const reelRest=reels.map(reel=>reel?.quaternion.clone());
 const reelTurn=new Quaternion(),reelAxis=new Vector3(0,0,1);
 const fixtureMeshes=fixtures.map(fixture=>{
  const object=model.scene.getObjectByName('RoomFluorescent_'+fixture.id);
  if(!(object instanceof Mesh)||!(object.material instanceof MeshStandardMaterial))return;
  const material=object.material.clone();object.material=material;materials.add(material);
  material.emissive.set('#bbc9b7');material.emissiveIntensity=1.35;
  return material;
 });
 const curtain=model.scene.getObjectByName('RoomCurtain_privacy'),cable=model.scene.getObjectByName('RoomHangingCable_0');
 const curtainRest=curtain?.rotation.clone(),cableRest=cable?.rotation.clone();
 const dustCanvas=document.createElement('canvas');dustCanvas.width=dustCanvas.height=32;
 const dustContext=dustCanvas.getContext('2d')!,dustGradient=dustContext.createRadialGradient(16,16,0,16,16,15);
 dustGradient.addColorStop(0,'#fff9');dustGradient.addColorStop(.35,'#fff5');dustGradient.addColorStop(1,'#fff0');dustContext.fillStyle=dustGradient;dustContext.fillRect(0,0,32,32);
 const dustTexture=new CanvasTexture(dustCanvas);textures.add(dustTexture);
 const dustGeometry=new BufferGeometry(),dustPositions:number[]=[];
 for(let i=0;i<90;i++){const hall=i<45;dustPositions.push((Math.random()-.5)*(hall?2.6:7),.35+Math.random()*2.6,hall?8+Math.random()*11:-5+Math.random()*10);}
 dustGeometry.setAttribute('position',new Float32BufferAttribute(dustPositions,3));
 const dustMaterial=new PointsMaterial({color:'#b6c3b8',map:dustTexture,transparent:true,opacity:.19,size:.018,depthWrite:false,sizeAttenuation:true});materials.add(dustMaterial);
 const dust=new Points(dustGeometry,dustMaterial);scene.add(dust);
 function signal(id:string,corrupt=false){
  const live=liveTextures.get(id),clean=cleanSignals.get(id);
  if(live&&clean){
   const target=live.image as HTMLCanvasElement,context=target.getContext('2d')!,w=target.width,h=target.height;context.clearRect(0,0,w,h);context.drawImage(clean,0,0);
   if(corrupt){
    const index=Number(id.slice(-1))||0,y=Math.round(h*(.26+index*.12)),height=Math.round(h*.09);
    context.save();context.globalAlpha=.28;context.drawImage(clean,0,0,w,h,4+index*2,0,w,h);context.restore();
    context.fillStyle='#07100edd';context.fillRect(0,y,w,height);context.drawImage(clean,0,y,w,height,-16-index*3,y,w,height);
    context.fillStyle='#a7b7a631';for(let row=y-7;row<y+height+13;row+=3)context.fillRect(0,row,w,1);
    context.fillStyle='#03080688';context.fillRect(0,h*.72,w,3);
   }
   live.needsUpdate=true;
  }
  const item=signals.get(id);if(!item)return;
  const c=item.canvas.getContext('2d')!;c.fillStyle='#091011';c.fillRect(0,0,768,552);
  if(item.image?.complete&&item.image.naturalWidth){
   const image=item.image,scale=Math.max(768/image.naturalWidth,552/image.naturalHeight);c.save();c.filter='saturate(.72) contrast(.96) brightness(.80)';
   c.drawImage(image,(768-image.naturalWidth*scale)/2,(552-image.naturalHeight*scale)/2,image.naturalWidth*scale,image.naturalHeight*scale);c.restore();
  }
  const shade=c.createLinearGradient(0,0,0,552);shade.addColorStop(0,'#02090918');shade.addColorStop(.55,'#02090900');shade.addColorStop(1,'#020909c4');c.fillStyle=shade;c.fillRect(0,0,768,552);
  const words=item.label.title.split(' ');let lines:string[]=[''];for(const word of words){const next=(lines.at(-1)+' '+word).trim();if(next.length>18&&lines.at(-1))lines.push(word);else lines[lines.length-1]=next;}
  lines.forEach((line,i)=>drawGraphicText(c,line,48,365+i*53,36,'#a3aea0',item.index*37+i,680));
  if(item.label.subtitle)drawGraphicText(c,item.label.subtitle,48,504,16,'#768b81',item.index,680);
  // Line timebase and the phosphor aperture remain fine enough to preserve image detail.
  for(let y=1;y<552;y+=3){c.fillStyle=y%9===1?'#02080932':'#02080919';c.fillRect(0,y,768,1);}
  for(let x=1;x<768;x+=3){c.fillStyle='rgba(88,137,128,.022)';c.fillRect(x,0,1,552);}
  const edge=c.createRadialGradient(384,260,150,384,260,470);edge.addColorStop(0,'transparent');edge.addColorStop(1,'#010606bf');c.fillStyle=edge;c.fillRect(0,0,768,552);
  if(corrupt){c.fillStyle='#bed4c21c';c.fillRect(0,144+(item.index*47)%230,768,5);c.fillStyle='#0008';c.fillRect(0,300,768,12);}
  item.texture.needsUpdate=true;
 }
 for(const [index,label]of options.screens.entries()){
  if(!label.id.startsWith('quest_')&&label.id!=='game')continue;
  const mesh=model.scene.getObjectByName('RoomScreen_'+label.id);if(!(mesh instanceof Mesh))continue;
  const source=document.createElement('canvas');source.width=768;source.height=552;
  const texture=new CanvasTexture(source);texture.colorSpace=SRGBColorSpace;texture.flipY=false;textures.add(texture);
  const material=new MeshStandardMaterial({map:texture,emissive:'#a9b9ad',emissiveMap:texture,emissiveIntensity:.52,roughness:.51,metalness:.025});materials.add(material);mesh.material=material;mesh.castShadow=false;
  const item={mesh,material,canvas:source,texture,label,index,image:undefined as HTMLImageElement|undefined};signals.set(label.id,item);signal(label.id);
  physical.set(label.id,material);
  if(label.image){const image=new Image();item.image=image;image.decoding='async';image.onload=()=>{if(alive){signal(label.id);options.invalidate?.();}};image.src=label.image;}
 }
 // A chipped room identity is a physical wall sign, not a foreground heading.
 const plaque=document.createElement('canvas');plaque.width=1024;plaque.height=160;const pc=plaque.getContext('2d')!;
 pc.fillStyle='#17201e';pc.fillRect(0,0,1024,160);pc.strokeStyle='#58605a';pc.lineWidth=5;pc.strokeRect(7,7,1010,146);drawGraphicText(pc,'ИЗНАНКА',130,43,74,'#8d7770',317,900);
 for(let x=20;x<1024;x+=127){pc.fillStyle='#090f0f';pc.fillRect(x,24+(x%57),2,5);}
 const signTexture=new CanvasTexture(plaque);signTexture.colorSpace=SRGBColorSpace;textures.add(signTexture);
 const signMaterial=new MeshStandardMaterial({map:signTexture,roughness:.94});materials.add(signMaterial);const sign=new Mesh(new PlaneGeometry(2.7,.42),signMaterial);sign.position.set(0,3.13,-6.84);scene.add(sign);
 const entranceSign=new Mesh(new PlaneGeometry(1.52,.24),signMaterial);entranceSign.position.set(0,2.87,7.13);scene.add(entranceSign);
 renderer.shadowMap.needsUpdate=true;
 const pixelPass=createRoomPixelPass(renderer);
 const ordinaryFog=new Color('#171c1c'),recordedFog=new Color('#080d15'),ghostPoint=new Vector3();
 let width=0,height=0,previousPulse:string|undefined;
 const picker=new Raycaster();
 function resize(){
  const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
  if(w===width&&h===height)return;
  width=w;height=h;const pixels=roomPixelSize(w,h);renderer.setPixelRatio(1);renderer.setSize(pixels.width,pixels.height,false);pixelPass.resize(pixels.width,pixels.height);camera.aspect=w/h;camera.updateProjectionMatrix();
  canvas.dataset.roomPixels=pixels.width+'×'+pixels.height;
  const size=w<=760?512:1024;if(key.shadow.mapSize.x!==size){key.shadow.mapSize.set(size,size);key.shadow.map?.dispose();key.shadow.map=null;renderer.shadowMap.needsUpdate=true;}
 }
 return{
  liveMotion:true,
  needsLifeFrame:()=>recording&&(camera.position.z>7||ghostsInView),
  setProjection,
  updateSurface(id:RoomStationId,source:HTMLCanvasElement){
   const material=physical.get(id);if(!material)return;
   const key=id;let texture=liveTextures.get(key);
   // WebGL texture storage has fixed dimensions. A breakpoint gets a fresh
   // texture, so a previous mobile image cannot stretch over desktop controls.
   if(!texture||texture.image.width!==source.width||texture.image.height!==source.height){
    if(texture){texture.dispose();textures.delete(texture);}
    const copy=document.createElement('canvas');copy.width=source.width;copy.height=source.height;
    texture=new CanvasTexture(copy);texture.colorSpace=SRGBColorSpace;texture.flipY=!id.startsWith('quest_')&&id!=='game';
    texture.minFilter=texture.magFilter=LinearFilter;texture.generateMipmaps=false;
    liveTextures.set(key,texture);textures.add(texture);
   }
   const copy=texture.image as HTMLCanvasElement,context=copy.getContext('2d')!;
   context.clearRect(0,0,copy.width,copy.height);context.drawImage(source,0,0);
   if(id.startsWith('quest_')){
    context.fillStyle='#00000016';for(let y=1;y<copy.height;y+=3)context.fillRect(0,y,copy.width,1);
    const edge=context.createRadialGradient(copy.width/2,copy.height/2,copy.height*.2,copy.width/2,copy.height/2,copy.width*.62);
    edge.addColorStop(0,'#0000');edge.addColorStop(1,'#010707aa');context.fillStyle=edge;context.fillRect(0,0,copy.width,copy.height);
    let clean=cleanSignals.get(id);if(!clean){clean=document.createElement('canvas');cleanSignals.set(id,clean);}clean.width=copy.width;clean.height=copy.height;clean.getContext('2d')!.drawImage(copy,0,0);
   }
   texture.needsUpdate=true;if(id!=='gallery'&&material.map!==texture){material.map=texture;material.needsUpdate=true;}
   if(id.startsWith('quest_')||id==='game')material.emissiveMap=texture;
   canvas.dataset.roomSurfaceSize=source.width+'×'+source.height;

  },
  render(pose:RoomPose,state:RoomRenderState={}):Record<string,ProjectedGlass>{
   resize();camera.position.set(...pose.position);camera.lookAt(...pose.target);camera.fov=pose.fov;camera.updateProjectionMatrix();camera.updateMatrixWorld();
   const amount=state.cameraAmount??1,haunted=amount>.48;
   if(recording!==haunted){recording=haunted;renderer.shadowMap.needsUpdate=true;}
   fill.intensity=.98-.16*amount;key.intensity=3.55-.55*amount;red.intensity=10*amount;
   scene.fog!.color.copy(ordinaryFog).lerp(recordedFog,amount);(scene.fog as FogExp2).density=.021+.005*amount;
   cameraOnly.forEach(mesh=>mesh.visible=haunted);blood.group.visible=haunted;teamBoard.face.visible=haunted;evidence.outline.visible=haunted;
   ghostsInView=false;
   ghosts.forEach(({mesh,material,rest,phase})=>{
    mesh.position.copy(rest);if(!state.calm)mesh.position.y+=Math.sin((state.lifeTime||0)*.0004+phase)*.025;
    mesh.updateWorldMatrix(true,false);mesh.getWorldPosition(ghostPoint);ghostPoint.y+=.9;ghostPoint.project(camera);
    const inView=ghostPoint.z>-1&&ghostPoint.z<1&&Math.abs(ghostPoint.x)<1.25&&Math.abs(ghostPoint.y)<1.3;
    mesh.visible=haunted&&inView;ghostsInView||=mesh.visible;
    material.opacity=state.calm?.17:.17+Math.sin((state.lifeTime||0)*.00056+phase)*.045;
   });
   canvas.dataset.roomGhosts=String(ghosts.filter(g=>g.mesh.visible).length);canvas.dataset.roomCamera=haunted?'on':'off';
   if(previousPulse!==state.pulse){if(previousPulse)signal(previousPulse);if(state.pulse)signal(state.pulse,true);previousPulse=state.pulse;}
   // Reading never changes the material, exposure, light spill or signal grade.
   for(const [id,item]of signals){
    item.material.emissiveIntensity=id===state.pulse?.34:.52;
    const content=id.startsWith('quest_')&&(!state.questDetails||state.active!==id)?item.texture:liveTextures.get(id)||item.texture;
    item.material.map=item.material.emissiveMap=content;
   }
   const projection=physical.get('gallery')!,filmTime=state.projectorTime||0,on=!!state.projectorOn;
   const filmMap=on?projectionTexture||null:null;
   if(projection.map!==filmMap){projection.map=projection.emissiveMap=filmMap;projection.needsUpdate=true;}
   projection.color.set(on?'#deded8':'#89908a');projection.emissive.set('#ffffff');projection.emissiveIntensity=on?.62+Math.sin(filmTime*.019)*.008:0;
   filmLight.intensity=on?6.2:0;beam.update(camera,on);
   reels.forEach((reel,i)=>{if(reel&&reelRest[i])reel.quaternion.copy(reelRest[i]!).multiply(reelTurn.setFromAxisAngle(reelAxis,filmTime*(i===0?.0022:.0027)));});
   canvas.dataset.roomProjector=on?'on':'off';
   const air=state.atmosphere;
   const handAmount=camera.position.z>7?(air?.hand??(air?.lamp!==undefined?(1-air.lamp)*.55:0)):0;
   const liveTime=state.calm||!haunted?0:state.lifeTime||0;
   hands.update(handAmount,air?.hand!==undefined?air.fixture:Math.max(0,Math.min(7,Math.round((camera.position.z-8)/1.5))),camera.position.z>7?liveTime:0,camera.position.z);
   blood.update(air?.drip,air?.fixture||0);
   canvas.dataset.roomHandsActive=String(camera.position.z>7&&liveTime>0||Math.abs(handAmount)>.02);canvas.dataset.roomDripProgress=String(air?.drip??'');canvas.dataset.roomSignalActive=state.pulse||'';
   fixtures.forEach((fixture,index)=>{
    const level=air?.fixture===index?air.lamp:1;fixture.light.intensity=fixture.power*level;
    if(fixtureMeshes[index])fixtureMeshes[index]!.emissiveIntensity=1.35*level;
   });
   if(curtain&&curtainRest){curtain.rotation.copy(curtainRest);curtain.rotation.z+=(air?.cloth||0)*.015;curtain.rotation.x+=(air?.cloth||0)*.004;}
   if(cable&&cableRest){cable.rotation.copy(cableRest);cable.rotation.z+=(air?.cable||0)*.035;}
   dust.position.y=air?Math.sin(air.drift*.23)*.025:0;dust.position.x=air?Math.sin(air.drift*.11)*.015:0;
   canvas.dataset.roomLamp=String(air?.lamp??1);canvas.dataset.roomCloth=String(air?.cloth??0);
   renderer.setRenderTarget(pixelPass.target);renderer.render(scene,camera);
   const triangles=renderer.info.render.triangles,calls=renderer.info.render.calls;
   pixelPass.present(width<=760?1.3:1.2,state.calm?0:state.cameraTime||0,!!state.pulse,amount);
   canvas.dataset.roomFrames=String(Number(canvas.dataset.roomFrames||0)+1);canvas.dataset.roomTriangles=String(triangles);canvas.dataset.roomCalls=String(calls+1);
   const projected:Record<string,ProjectedGlass>={};
   for(const station of roomStations){
    const [x,y,z]=station.center,w=station.width/2,h=station.height/2;
    const rotation=station.rotationY||0,normal=new Vector3(Math.sin(rotation),0,Math.cos(rotation));
    const points=[[-w,h],[w,h],[w,-h],[-w,-h]].map(([dx,dy])=>new Vector3(x+Math.cos(rotation)*dx+normal.x*.002,y+dy,z-Math.sin(rotation)*dx+normal.z*.002).project(camera));
    const quad=points.map(p=>({x:(p.x+1)*width/2,y:(1-p.y)*height/2})) as ScreenQuad;
    const visible=camera.position.clone().sub(new Vector3(x,y,z)).dot(normal)>.07&&points.every(p=>p.z>-1&&p.z<1)&&Math.max(...quad.map(p=>p.x))>0&&Math.min(...quad.map(p=>p.x))<width&&Math.max(...quad.map(p=>p.y))>0&&Math.min(...quad.map(p=>p.y))<height;
    const depth=-new Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse).z;
    projected[station.id]={quad,visible,depth};
   }
   return projected;
  },
  canSelect(id:RoomStationId,clientX:number,clientY:number){
   const rect=canvas.getBoundingClientRect();picker.setFromCamera(new Vector2((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2),camera);if(id==='door')return true;
   const intersection=picker.intersectObject(model.scene,true).find(hit=>{
    for(let item:import('three').Object3D|null=hit.object;item;item=item.parent)if(!item.visible||item.name.startsWith('RoomGhost_'))return false;
    return true;
   });
   let object:import('three').Object3D|null=intersection?.object||null;
   // A multi-material glTF object is a Group. Its intersected primitive keeps
   // the Blender mesh name, so physical controls must inspect its ancestors.
   while(object){if(id==='projector'?object.name==='RoomFilmProjector'||object.name.startsWith('RoomFilmReel_'):object.name==='RoomScreen_'+id)return true;object=object.parent;}
   return false;
  },
  dispose(){alive=false;hands.dispose();blood.dispose();evidence.dispose();teamBoard.dispose();model.scene.traverse(o=>{if(o instanceof Mesh)o.geometry.dispose()});beam.dispose();sign.geometry.dispose();entranceSign.geometry.dispose();dustGeometry.dispose();key.shadow.dispose();fixtures.forEach(fixture=>fixture.light.shadow.dispose());for(const material of materials){for(const value of Object.values(material))if(value?.isTexture)textures.add(value);material.dispose();}textures.forEach(t=>t.dispose());cleanSignals.clear();pixelPass.dispose();renderer.dispose();renderer.forceContextLoss();}
 };
}
