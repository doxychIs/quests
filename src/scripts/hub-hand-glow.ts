import {Mesh,OrthographicCamera,PlaneGeometry,Scene,ShaderMaterial,Vector2,WebGLRenderTarget,type Texture,type WebGLRenderer} from 'three';

const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';

/** Blur the cached silhouette at quarter resolution, only when the hand pose changes. */
export function createHandGlow(renderer:WebGLRenderer,source:Texture,scene:Scene){
 const horizontal=new WebGLRenderTarget(1,1,{depthBuffer:false}),vertical=new WebGLRenderTarget(1,1,{depthBuffer:false});
 const blurScene=new Scene(),camera=new OrthographicCamera(-1,1,1,-1,.1,5);camera.position.z=1;
 const blur=new ShaderMaterial({
  depthTest:false,depthWrite:false,toneMapped:false,
  uniforms:{uSource:{value:source},uStep:{value:new Vector2()}},vertexShader,
  fragmentShader:`
   varying vec2 vUv;uniform sampler2D uSource;uniform vec2 uStep;
   void main(){
    float a=0.0,total=0.0;
    for(int i=-6;i<=6;i++){
     float offset=float(i),weight=exp(-offset*offset/12.5);
     a+=texture2D(uSource,vUv+uStep*offset).a*weight;total+=weight;
    }
    a/=total;gl_FragColor=vec4(a,a,a,a);
   }`,
 });
 const geometry=new PlaneGeometry(2,2),blurQuad=new Mesh(geometry,blur);blurQuad.frustumCulled=false;blurScene.add(blurQuad);
 const material=new ShaderMaterial({
  transparent:true,depthTest:false,depthWrite:false,
  uniforms:{uSource:{value:source},uGlow:{value:vertical.texture},uPixel:{value:new Vector2()},uStrength:{value:0},uOpacity:{value:1},
   uOrigin:{value:new Vector2()},uOriginAxis:{value:new Vector2(0,-1)},uOriginRadius:{value:0},uAspect:{value:1},uTime:{value:0}},vertexShader,
  fragmentShader:`
   varying vec2 vUv;uniform sampler2D uSource,uGlow;uniform vec2 uPixel;uniform float uStrength,uOpacity;
   uniform vec2 uOrigin,uOriginAxis;uniform float uOriginRadius,uAspect,uTime;
   void main(){
    vec4 hand=texture2D(uSource,vUv);float halo=texture2D(uGlow,vUv).a;
    float left=texture2D(uSource,vUv-vec2(uPixel.x,0.0)).a,right=texture2D(uSource,vUv+vec2(uPixel.x,0.0)).a;
    float up=texture2D(uSource,vUv+vec2(0.0,uPixel.y)).a,down=texture2D(uSource,vUv-vec2(0.0,uPixel.y)).a;
    float outer=max(0.0,max(max(left,right),max(up,down))-hand.a);
    float inner=max(0.0,hand.a-min(min(left,right),min(up,down)));
    vec2 q=(vUv*2.0-1.0-uOrigin)*vec2(uAspect,1.0);
    vec2 side=vec2(-uOriginAxis.y,uOriginAxis.x);
    vec2 o=vec2(dot(q,side),dot(q,uOriginAxis))/max(.001,uOriginRadius);
    // Finish the transition in screen space, including the bright silhouette at the cap.
    float originFade=mix(1.0,smoothstep(-.12,.95,o.y),step(.0001,uOriginRadius));
    hand.a*=originFade;halo*=originFade;outer*=originFade;inner*=originFade;
    float drift=uTime*.22;
    float fog=exp(-o.x*o.x*.42-o.y*o.y*2.6)*(.16+.05*sin(o.x*3.1+sin(o.y*4.0+drift)-drift));
    float fold=o.y-.14*sin(o.x*2.3+drift);
    float wisp=exp(-pow((fold+.12)/.15,2.0)-o.x*o.x*.40)*.16;
    float curl=exp(-pow((o.y+.35-.12*sin(o.x*3.0-drift))/.22,2.0)-o.x*o.x*.70)*.09;
    float mist=(fog+wisp+curl)*step(.0001,uOriginRadius);
    float glow=clamp((halo*.70+outer*.65+mist)*uStrength,0.0,.9)*(1.0-hand.a);
    float alpha=hand.a+glow;
    vec3 surface=hand.rgb+vec3(.8,.95,1.18)*inner*uStrength*.8;
    vec3 color=(surface*hand.a+vec3(1.0,1.12,1.38)*glow)/max(alpha,.00001);
    gl_FragColor=vec4(color,alpha*uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`,
 });
 const composite=new Mesh(geometry,material);composite.frustumCulled=false;composite.renderOrder=2;scene.add(composite);
 return {
  resize(width:number,height:number,dpr:number){
   horizontal.setSize(Math.max(1,Math.ceil(width*dpr/4)),Math.max(1,Math.ceil(height*dpr/4)));
   vertical.setSize(horizontal.width,horizontal.height);material.uniforms.uPixel.value.set(1/width,1/height);material.uniforms.uAspect.value=width/height;
  },
  refresh(){
   const previous=renderer.getRenderTarget();
   blur.uniforms.uSource.value=source;blur.uniforms.uStep.value.set(1/horizontal.width,0);
   renderer.setRenderTarget(horizontal);renderer.render(blurScene,camera);
   blur.uniforms.uSource.value=horizontal.texture;blur.uniforms.uStep.value.set(0,1/vertical.height);
   renderer.setRenderTarget(vertical);renderer.render(blurScene,camera);renderer.setRenderTarget(previous);
  },
  setStrength(strength:number){material.uniforms.uStrength.value=strength},
  setTime(time:number){material.uniforms.uTime.value=time},
  setOrigin(point:{x:number;y:number},wrist:{x:number;y:number},side:{x:number;y:number}){
   const aspect=material.uniforms.uAspect.value;
   material.uniforms.uOrigin.value.set(point.x,point.y);
   material.uniforms.uOriginAxis.value.set((wrist.x-point.x)*aspect,wrist.y-point.y).normalize();
   if(material.uniforms.uOriginAxis.value.lengthSq()<.00001)material.uniforms.uOriginAxis.value.set(0,-1);
   material.uniforms.uOriginRadius.value=Math.hypot((side.x-point.x)*aspect,side.y-point.y);
  },
  setOpacity(opacity:number){material.uniforms.uOpacity.value=Math.max(0,Math.min(1,opacity));composite.visible=material.uniforms.uOpacity.value>0},
  dispose(){scene.remove(composite);horizontal.dispose();vertical.dispose();geometry.dispose();blur.dispose();material.dispose()},
 };
}
