import {AdditiveBlending,BufferAttribute,BufferGeometry,Mesh,PlaneGeometry,Points,ShaderMaterial,Vector2,type Scene} from 'three';

export interface HandPresentation{presence:number;opening:number;progress:number}

/** Two tiny draw calls in the hand's existing renderer; never covers the porcelain mesh. */
export function createHandAtmosphere(scene:Scene,compact:boolean){
 const uniforms={
  uTime:{value:0},uPresence:{value:0},uOpening:{value:0},uProgress:{value:0},
  uPointer:{value:new Vector2()},uViewport:{value:new Vector2(1,1)},uDpr:{value:1},
 };
 const count=compact?100:190;
 const positions=new Float32Array(count*3),details=new Float32Array(count*3);
 let seed=7281;
 const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 for(let i=0;i<count;i++){
  positions[i*3]=random()*2-1;positions[i*3+1]=random()*2-1;
  const depth=random(),bokeh=i%19===0;
  details[i*3]=random()*6.283185;details[i*3+1]=depth;
  details[i*3+2]=bokeh?8+random()*8:1.7+depth*3.3;
 }
 const geometry=new BufferGeometry();
 geometry.setAttribute('position',new BufferAttribute(positions,3));
 geometry.setAttribute('aDetail',new BufferAttribute(details,3));
 const dustMaterial=new ShaderMaterial({
  uniforms,transparent:true,depthWrite:false,depthTest:true,blending:AdditiveBlending,
  vertexShader:`
   attribute vec3 aDetail;
   uniform float uTime,uPresence,uOpening,uProgress,uDpr;
   uniform vec2 uPointer;
   varying float vOpacity,vSeed,vBokeh;
   void main(){
    float phase=aDetail.x,depth=aDetail.y;
    vec2 p=position.xy;
    p.y=mod(p.y+1.0+uTime*(.008+depth*.016)+uProgress*.34,2.0)-1.0;
    p.x+=sin(uTime*.075+phase)*.045+sin(uTime*.12+phase*3.0)*.016;
    float nearHand=exp(-p.x*p.x*5.0-(p.y+.05)*(p.y+.05)*2.0);
    p.x+=sign(p.x)*uOpening*nearHand*.10;
    p+=uPointer*(.006+depth*.022);
    float edge=(1.0-smoothstep(.78,1.0,abs(p.x)))*(1.0-smoothstep(.82,1.0,abs(p.y)));
    vBokeh=step(7.0,aDetail.z);
    vOpacity=uPresence*edge*(.20+depth*.36)*(.72+.28*sin(uTime*.21+phase));
    vOpacity*=mix(1.0,.15,vBokeh);vSeed=phase;
    gl_PointSize=aDetail.z*uDpr;
    gl_Position=vec4(p,.9+depth*.07,1.0);
   }`,
  fragmentShader:`
   varying float vOpacity,vSeed,vBokeh;
   void main(){
    float r=length(gl_PointCoord-.5);if(r>.5)discard;
    float core=exp(-r*r*45.0),halo=exp(-r*r*9.0)*.22;
    float alpha=mix(core+halo,exp(-r*r*9.0),vBokeh)*vOpacity;
    vec3 silver=mix(vec3(.65,.70,.79),vec3(.93,.95,1.0),.5+.5*sin(vSeed));
    gl_FragColor=vec4(silver,alpha);
   }`,
 });
 const dust=new Points(geometry,dustMaterial);dust.frustumCulled=false;
 const veilMaterial=new ShaderMaterial({
  uniforms,transparent:true,depthWrite:false,depthTest:true,blending:AdditiveBlending,
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,.99,1.0);}`,
  fragmentShader:`
   varying vec2 vUv;uniform float uTime,uPresence,uOpening,uProgress;uniform vec2 uPointer,uViewport;
   void main(){
    vec2 p=vUv*2.0-1.0;p+=uPointer*.014;
    float phase=uTime*.028+uProgress*.35;
    float y=p.y+.17+sin(p.x*2.5+phase)*.17+sin(p.x*5.0-phase*.6)*.045;
    float ribbon=exp(-pow(y*13.0,2.0))*.030+exp(-pow((y+.045)*25.0,2.0))*.016;
    float folds=.6+.4*sin(p.x*7.0+phase);
    float sides=smoothstep(.08,.54,abs(p.x))*(1.0-smoothstep(.70,1.04,abs(p.x)));
    float halo=exp(-p.x*p.x*12.0-(p.y-.2)*(p.y-.2)*2.5)*.022;
    float alpha=(ribbon*folds*sides+halo)*uPresence*(.5+.5*uOpening);
    gl_FragColor=vec4(.68,.73,.82,alpha);
   }`,
 });
 const veil=new Mesh(new PlaneGeometry(2,2),veilMaterial);veil.frustumCulled=false;
 scene.add(veil,dust);
 return {
  update(state:HandPresentation,time:number,pointerX:number,pointerY:number){
   uniforms.uTime.value=time;uniforms.uPresence.value=state.presence;
   uniforms.uOpening.value=state.opening;uniforms.uProgress.value=state.progress;
   uniforms.uPointer.value.set(pointerX,pointerY);
   dust.visible=veil.visible=state.presence>.001;
  },
  resize(width:number,height:number,dpr:number){
   uniforms.uViewport.value.set(width,height);uniforms.uDpr.value=dpr;
   geometry.setDrawRange(0,Math.min(count,width<=760?100:190));
  },
  dispose(){scene.remove(veil,dust);geometry.dispose();dustMaterial.dispose();veil.geometry.dispose();veilMaterial.dispose()},
 };
}
