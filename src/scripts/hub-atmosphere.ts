import {AdditiveBlending,BufferAttribute,BufferGeometry,Mesh,PlaneGeometry,Points,ShaderMaterial,Vector2,type Scene} from 'three';

export interface HandPresentation{presence:number;opening:number;progress:number;arrival?:number;reveal?:number;handOpacity?:number}

// Shared by the silk surface and the motes travelling through its folds.
const silkPath=`
 float silkY(float u,float side,float layer,float phase,vec2 focus){
  float envelope=max(0.0,sin(u*3.14159265));
  return focus.y+(1.0-u)*(.56-side*.10+layer*.055)
   +sin(u*6.6+phase+side*1.15+layer*.86)*(.15+layer*.025)*envelope
   +sin(u*12.0-phase*.6+layer)*.025*envelope;
 }
 float silkWidth(float u,float layer){
  return (.022+.095*max(0.0,sin(u*3.14159265)))*(1.0-u*.86)*(1.0+layer*.14);
 }`;

/** Two tiny draw calls in the hand's existing renderer; never covers the porcelain mesh. */
export function createHandAtmosphere(scene:Scene,compact:boolean){
 const uniforms={
  uTime:{value:0},uPresence:{value:0},uOpening:{value:0},uProgress:{value:0},
  uPointer:{value:new Vector2()},uViewport:{value:new Vector2(1,1)},uFocus:{value:new Vector2(0,-.5)},uCrown:{value:new Vector2(0,.05)},uReveal:{value:0},uDpr:{value:1},
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
   uniform vec2 uPointer,uFocus,uCrown;
   varying float vOpacity,vSeed,vBokeh;
   ${silkPath}
   void main(){
    float phase=aDetail.x,depth=aDetail.y;
    vec2 p=position.xy;
    p.y=mod(p.y+1.0+uTime*(.008+depth*.016)+uProgress*.34,2.0)-1.0;
    p.x+=sin(uTime*.075+phase)*.045+sin(uTime*.12+phase*3.0)*.016;
    float nearHand=exp(-p.x*p.x*5.0-(p.y+.05)*(p.y+.05)*2.0);
    p.x+=sign(p.x)*uOpening*nearHand*.10;
    float stream=step(.5,fract(phase*1.37));
    float u=fract(phase*.68+uTime*.024+uProgress*.12);
    float side=sin(phase*3.0)>0.0?1.0:-1.0,layer=floor(fract(phase*.3)*3.0);
    vec2 flowing=vec2(mix(side*1.22,uFocus.x,u),silkY(u,side,layer,uTime*.065+uProgress*.38,uFocus));
    flowing.y+=sin(phase*7.0)*silkWidth(u,layer)*.8;
    p=mix(p,flowing,stream*uOpening);
    float rising=step(.84,fract(phase*2.13))*uOpening;
    float lift=fract(phase*.31+uTime*.042);
    vec2 energy=mix(uFocus,uCrown,lift);
    energy.x+=sin(phase*5.0+lift*7.0)*.035*sin(lift*3.14159265);
    p=mix(p,energy,rising);
    p+=uPointer*(.006+depth*.022);
    float edge=(1.0-smoothstep(.78,1.0,abs(p.x)))*(1.0-smoothstep(.82,1.0,abs(p.y)));
    vBokeh=step(7.0,aDetail.z);
    vOpacity=uPresence*edge*(.20+depth*.48)*(.65+.35*pow(max(0.0,sin(uTime*.8+phase)),4.0));
    vOpacity*=mix(1.0,1.25,stream*uOpening);
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
   varying vec2 vUv;uniform float uTime,uPresence,uOpening,uProgress,uReveal;uniform vec2 uPointer,uViewport,uFocus,uCrown;
   ${silkPath}
   void main(){
    vec2 p=vUv*2.0-1.0;p+=uPointer*.009;
    float phase=uTime*.065+uProgress*.38;
    float magic=uOpening*(1.0-smoothstep(.73,.96,uProgress));
    float side=p.x<uFocus.x?-1.0:1.0;
    float u=clamp((p.x-side*1.22)/(uFocus.x-side*1.22),0.0,1.0);
    float silk=0.0;
    for(int i=0;i<3;i++){
     float layer=float(i),center=silkY(u,side,layer,phase,uFocus);
     float width=silkWidth(u,layer),d=(p.y-center)/width;
     float fabric=exp(-d*d*.85)*(.11+.045*sin(u*9.0-phase+layer));
     float fibers=pow(.5+.5*sin(d*13.0+u*20.0+sin(u*17.0-phase)*1.3+layer),24.0)*exp(-d*d*.7)*.08;
     float crest=exp(-pow((d-sin(u*9.0+phase+layer)*.26)*12.0,2.0))*.28;
     crest*=.3+.7*pow(.5+.5*sin(u*10.0-phase*.6+layer),3.0);
     float folds=.35+.65*pow(.5+.5*sin(u*15.0-phase+layer),2.0);
     silk+=(fabric+fibers+crest)*folds/(1.0+layer*.45);
    }
    silk*=1.0-smoothstep(.85,1.12,abs(p.x));
    vec2 q=(p-uFocus)*vec2(uViewport.x/uViewport.y,1.0);float r=length(q);
    float orb=exp(-r*r*14500.0)*1.4+exp(-r*r*2200.0)*.68+exp(-r*r*130.0)*.14;
    orb+=exp(-abs(q.x)*22.0-abs(q.y)*340.0)*.30+exp(-abs(q.y)*48.0-abs(q.x)*420.0)*.18;
    orb*=.97+.03*sin(uTime*.7);
    float lift=clamp((p.y-uFocus.y)/max(.03,uCrown.y-uFocus.y),0.0,1.0);
    float threadX=mix(uFocus.x,uCrown.x,lift)+sin(lift*7.0-phase*.8)*.022*sin(lift*3.14159265);
    float breath=.96+.04*sin(uTime*.65);
    float energy=exp(-pow((p.x-threadX)/(.016+.055*lift),2.0))*sin(lift*3.14159265)*.16;
    float crown=exp(-pow((p.y-uCrown.y)*55.0,2.0)-pow((p.x-uCrown.x)*5.0,2.0))*.10*uReveal;
    float alpha=(silk*1.35+orb+energy+crown)*magic*uPresence*breath;
    gl_FragColor=vec4(.84,.91,1.0,alpha);
   }`,
 });
 const veil=new Mesh(new PlaneGeometry(2,2),veilMaterial);veil.frustumCulled=false;
 scene.add(veil,dust);
 return {
  update(state:HandPresentation,time:number,pointerX:number,pointerY:number,focus?:{x:number;y:number},crown?:{x:number;y:number}){
   uniforms.uTime.value=time;uniforms.uPresence.value=state.presence;
   uniforms.uOpening.value=state.opening;uniforms.uProgress.value=state.progress;
   uniforms.uPointer.value.set(pointerX,pointerY);
   if(focus)uniforms.uFocus.value.set(focus.x,focus.y);
   if(crown)uniforms.uCrown.value.set(crown.x,crown.y);
   uniforms.uReveal.value=state.reveal??state.opening;
   dust.visible=veil.visible=state.presence>.001;
  },
  resize(width:number,height:number,dpr:number){
   uniforms.uViewport.value.set(width,height);uniforms.uDpr.value=dpr;
   geometry.setDrawRange(0,Math.min(count,width<=760?100:190));
  },
  dispose(){scene.remove(veil,dust);geometry.dispose();dustMaterial.dispose();veil.geometry.dispose();veilMaterial.dispose()},
 };
}
