import {ACESFilmicToneMapping,Color,DirectionalLight,FogExp2,HemisphereLight,Mesh,PCFShadowMap,PerspectiveCamera,PointLight,Scene,SRGBColorSpace,WebGLRenderer,type Material,type Texture} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import type {InvestigationPose} from './horror-investigation';

/** Genuine Blender geometry; renders only when the scroll camera changes. */
export async function createWardRenderer(canvas:HTMLCanvasElement,url:string){
 const renderer=new WebGLRenderer({canvas,antialias:innerWidth>760,alpha:false,powerPreference:'low-power'});
 renderer.outputColorSpace=SRGBColorSpace;renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,innerWidth<=760?1:1.4));
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=PCFShadowMap;renderer.shadowMap.autoUpdate=false;
 const scene=new Scene();scene.background=new Color('#0b1216');scene.fog=new FogExp2('#101a20',.027);
 const camera=new PerspectiveCamera(65,1,.07,45);
 scene.add(new HemisphereLight('#b6cbd6','#252b2a',1.15));
 const key=new DirectionalLight('#b0c7e0',1.8);key.position.set(-3.8,3.2,1.2);key.target.position.set(1,0,-1);
 key.castShadow=true;key.shadow.mapSize.set(innerWidth<=760?1024:2048,innerWidth<=760?1024:2048);
 Object.assign(key.shadow.camera,{left:-8,right:8,top:9,bottom:-9,near:.2,far:25});key.shadow.bias=-.00035;key.shadow.normalBias=.025;key.shadow.radius=2;
 scene.add(key,key.target);
 const fill=new PointLight('#c1d2c5',8,9,2);fill.position.set(.4,2.9,-.9);scene.add(fill);
 const red=new PointLight('#a9212b',23,5.4,2);red.position.set(0,2.9,-6.45);scene.add(red);
 let model;
 try{model=await new GLTFLoader().loadAsync(url);}catch(error){renderer.dispose();throw error;}
 model.scene.traverse(object=>{
  if(!(object instanceof Mesh))return;
  // The key represents the long frosted windows. The merged room shell must not
  // occlude that outside light; furniture still casts real contact shadows.
  const materials=Array.isArray(object.material)?object.material:[object.material];
  object.castShadow=!materials.some(material=>/Damp_flaking_paint|Cracked_wall_tiles|Dirty_floor_tiles|Dried_crimson|Cold_frosted_glass/.test(material.name));
  object.receiveShadow=true;object.frustumCulled=true;
 });
 scene.add(model.scene);renderer.shadowMap.needsUpdate=true;
 let width=0,height=0;
 function resize(){
  const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight),ratio=Math.min(devicePixelRatio||1,w<=760?1:1.4);
  if(w===width&&h===height&&renderer.getPixelRatio()===ratio)return;
  width=w;height=h;renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  const shadowSize=w<=760?1024:2048;
  if(key.shadow.mapSize.x!==shadowSize){key.shadow.mapSize.set(shadowSize,shadowSize);key.shadow.map?.dispose();key.shadow.map=null;renderer.shadowMap.needsUpdate=true;}
 }
 return{
  render(pose:InvestigationPose){
   resize();camera.position.set(...pose.position);
   renderer.toneMappingExposure=width<700?1.42:1.12;
   // Portrait framing steps back along the clear aisle so the whole bed remains visible.
   if(width<700)camera.position.z=Math.min(6.5,camera.position.z+1.4);
   camera.lookAt(...pose.target);
   const fov=pose.fov+(width<700?12:0);if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}
   renderer.render(scene,camera);
   canvas.dataset.wardFrames=String(Number(canvas.dataset.wardFrames||0)+1);
   canvas.dataset.wardTriangles=String(renderer.info.render.triangles);canvas.dataset.wardCalls=String(renderer.info.render.calls);
  },
  dispose(){
   const materials=new Set<Material>(),textures=new Set<Texture>();
   model.scene.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();for(const material of Array.isArray(o.material)?o.material:[o.material])materials.add(material);}});
   for(const m of materials){for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose();}
   textures.forEach(texture=>texture.dispose());renderer.dispose();
  }
 };
}
