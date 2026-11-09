import {AdditiveBlending,BufferAttribute,BufferGeometry,Color,DoubleSide,Mesh,OrthographicCamera,Scene,ShaderMaterial,Vector2,WebGLRenderer} from 'three';
import {SILK_FABRIC_GLSL} from '../lib/silk-fabric.ts';
import type {EnergyPath,buildEnergyRoute} from '../lib/hub-energy-path';

const colors=['#e0e5ed','#ef6977','#e6c16e','#6cb8f3'];

/** A ribbon is a soft translucent surface, using the exact fabric equations of the hero. */
export function createEnergyRibbon(canvas:HTMLCanvasElement,onLost:()=>void){
 const renderer=new WebGLRenderer({canvas,alpha:true,antialias:false,powerPreference:'low-power',premultipliedAlpha:true});
 renderer.setClearColor(0,0);
 const scene=new Scene(),camera=new OrthographicCamera(-1,1,1,-1,.1,3);camera.position.z=1;
 const shared={uTime:{value:0},uScroll:{value:0},uViewport:{value:new Vector2(1,1)},uStrength:{value:0}};
 const meshes=colors.map((color,i)=>{
  const material=new ShaderMaterial({
   transparent:true,depthTest:false,depthWrite:false,side:DoubleSide,blending:AdditiveBlending,toneMapped:false,
   uniforms:{...shared,uColor:{value:new Color(color)},uFrontier:{value:0},uLength:{value:1},uBranch:{value:i===0?0:1}},
   vertexShader:`
    uniform vec2 uViewport;uniform float uScroll;
    attribute float aDistance,aSide;varying float vDistance,vSide;
    void main(){
     vDistance=aDistance;vSide=aSide;
     gl_Position=vec4(position.x/uViewport.x*2.0-1.0,1.0-(position.y-uScroll)/uViewport.y*2.0,0.0,1.0);
    }`,
   fragmentShader:`
    uniform float uTime,uStrength,uFrontier,uLength,uBranch;uniform vec3 uColor;
    varying float vDistance,vSide;
    ${SILK_FABRIC_GLSL}
    void main(){
     float phase=uTime*.065,u=vDistance/mix(650.0,300.0,uBranch),silk=0.0;
     for(int i=0;i<3;i++){
      float layer=float(i);
      float center=sin(u*6.6+phase+layer*.86)*.13+sin(u*12.0-phase*.6+layer)*.035+(layer-1.0)*.10;
      float width=.27+layer*.026+sin(u*4.0+layer)*.025;
      silk+=silkFabric((vSide-center)/width,u,layer,phase);
     }
     float edge=1.0-smoothstep(.72,1.0,abs(vSide));
     float reveal=1.0-smoothstep(uFrontier-65.0,uFrontier+8.0,vDistance);
     float ends=smoothstep(0.0,22.0,vDistance)*(1.0-smoothstep(uLength-30.0,uLength,vDistance));
     float alpha=silk*edge*reveal*ends*uStrength*(.96+.04*sin(uTime*.65));
     gl_FragColor=vec4(uColor,alpha*mix(.90,1.05,uBranch));
    }`,
  });
  const mesh=new Mesh(new BufferGeometry(),material);mesh.frustumCulled=false;scene.add(mesh);return mesh;
 });
 let disposed=false;
 const lost=(event:Event)=>{event.preventDefault();onLost()};canvas.addEventListener('webglcontextlost',lost);
 function geometry(path:EnergyPath,halfWidth:number){
  const positions:number[]=[],distances:number[]=[],sides:number[]=[],indices:number[]=[];
  // Narrow gently at tight bends, preventing the inner edge from folding over itself.
  const widths=path.samples.map((p,i)=>{
   const before=path.samples[Math.max(0,i-1)],after=path.samples[Math.min(path.samples.length-1,i+1)];
   const ax=p.x-before.x,ay=p.y-before.y,bx=after.x-p.x,by=after.y-p.y;
   const a=Math.hypot(ax,ay),b=Math.hypot(bx,by);
   const angle=a>.001&&b>.001?Math.acos(Math.max(-1,Math.min(1,(ax*bx+ay*by)/(a*b)))):0;
   const radius=angle>.001?(a+b)*.5/angle:1e5;
   const taper=.07+.93*Math.pow(Math.max(0,Math.sin(p.distance/path.length*Math.PI)),.35);
   return Math.min(halfWidth*taper,Math.max(2,radius*.48));
  });
  for(let i=1;i<widths.length;i++)widths[i]=Math.min(widths[i],widths[i-1]+(path.samples[i].distance-path.samples[i-1].distance)*.32);
  for(let i=widths.length-2;i>=0;i--)widths[i]=Math.min(widths[i],widths[i+1]+(path.samples[i+1].distance-path.samples[i].distance)*.32);
  path.samples.forEach((p,i)=>{
   const before=path.samples[Math.max(0,i-1)],after=path.samples[Math.min(path.samples.length-1,i+1)];
   const dx=after.x-before.x,dy=after.y-before.y,length=Math.max(.001,Math.hypot(dx,dy));
   for(const side of [-1,1]){
    positions.push(p.x-dy/length*widths[i]*side,p.y+dx/length*widths[i]*side,0);
    distances.push(p.distance);sides.push(side);
   }
   if(i){const a=(i-1)*2,b=i*2;indices.push(a,a+1,b,a+1,b+1,b)}
  });
  const result=new BufferGeometry();result.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));
  result.setAttribute('aDistance',new BufferAttribute(new Float32Array(distances),1));
  result.setAttribute('aSide',new BufferAttribute(new Float32Array(sides),1));result.setIndex(indices);return result;
 }
 return {
  resize(width:number,height:number){
   if(disposed)return;renderer.setPixelRatio(Math.min(devicePixelRatio||1,width<=760?1:1.25));
   renderer.setSize(width,height,false);shared.uViewport.value.set(width,height);
  },
  setRoute(route:ReturnType<typeof buildEnergyRoute>,compact:boolean){
   if(disposed)return;
   [route.main,...route.branches.map(b=>b.path)].forEach((path,i)=>{
    const old=meshes[i].geometry;meshes[i].geometry=geometry(path,i===0?(compact?42:112):(compact?28:48));old.dispose();
    meshes[i].material.uniforms.uLength.value=path.length;
   });
  },
  render(route:ReturnType<typeof buildEnergyRoute>,frontier:number,scroll:number,time:number,strength:number){
   if(disposed)return;
   shared.uTime.value=time;shared.uScroll.value=scroll;shared.uStrength.value=strength;
   meshes[0].material.uniforms.uFrontier.value=frontier;
   route.branches.forEach((branch,i)=>meshes[i+1].material.uniforms.uFrontier.value=Math.max(0,frontier-branch.startDistance));
   renderer.render(scene,camera);
  },
  dispose(){if(disposed)return;disposed=true;canvas.removeEventListener('webglcontextlost',lost);meshes.forEach(mesh=>{mesh.geometry.dispose();mesh.material.dispose()});renderer.dispose()},
 };
}
