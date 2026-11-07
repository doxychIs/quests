import {BoxGeometry,Matrix4,Mesh,ShaderMaterial,Vector3,type PerspectiveCamera,type Scene} from 'three';

/** A finite, feathered volume, not a translucent polygon across the picture.
 * Twelve samples only inside a small proxy box; no full-screen postprocess. */
export function addRoomFilmBeam(scene:Scene,start:Vector3,end:Vector3,width:number,height:number){
 const material=new ShaderMaterial({transparent:true,depthWrite:false,
  uniforms:{eye:{value:new Vector3()},power:{value:0}},
  vertexShader:`varying vec3 exitPoint;void main(){exitPoint=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`precision highp float;varying vec3 exitPoint;uniform vec3 eye;uniform float power;
  void main(){
   vec3 ray=normalize(exitPoint-eye),safeRay=ray+mix(vec3(-.00001),vec3(.00001),step(vec3(0.),ray));
   vec3 nearT=(-vec3(1.)-eye)/safeRay,farT=(vec3(1.)-eye)/safeRay;
   vec3 lo=min(nearT,farT),hi=max(nearT,farT);
   float enter=max(0.,max(lo.x,max(lo.y,lo.z))),leave=min(hi.x,min(hi.y,hi.z));
   if(leave<=enter)discard;
   float stepSize=(leave-enter)/12.,density=0.;
   for(int i=0;i<12;i++){
    vec3 p=eye+ray*(enter+(float(i)+.5)*stepSize);
    float along=(p.z+1.)*.5,spread=mix(.015,1.,along);
    float edge=max(abs(p.x),abs(p.y))/spread;
    float feather=1.-smoothstep(.75,1.,edge);
    density+=feather*smoothstep(0.,.06,along)*(1.-smoothstep(.97,1.,along))*stepSize;
   }
   float alpha=(1.-exp(-density*.13))*power;
   gl_FragColor=vec4(vec3(.9,.92,.91),min(.23,alpha));
  }`});
 const geometry=new BoxGeometry(2,2,2),mesh=new Mesh(geometry,material),direction=end.clone().sub(start);
 mesh.name='RoomWhiteFilmBeam';mesh.position.copy(start).add(end).multiplyScalar(.5);
 mesh.quaternion.setFromUnitVectors(new Vector3(0,0,1),direction.clone().normalize());
 mesh.scale.set(width/2,height/2,direction.length()/2);mesh.updateMatrixWorld();mesh.visible=false;mesh.renderOrder=3;scene.add(mesh);
 const inverse=new Matrix4();
 return{update(camera:PerspectiveCamera,on:boolean){mesh.visible=on;material.uniforms.power.value=on?1:0;inverse.copy(mesh.matrixWorld).invert();material.uniforms.eye.value.copy(camera.position).applyMatrix4(inverse);},dispose(){scene.remove(mesh);geometry.dispose();material.dispose();}};
}
