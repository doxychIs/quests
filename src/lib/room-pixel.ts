import {HalfFloatType,Mesh,NearestFilter,OrthographicCamera,PlaneGeometry,RawShaderMaterial,Scene,UnsignedByteType,Vector2,Vector3,WebGLRenderTarget,type WebGLRenderer} from 'three';

// One palette and camera transfer for the complete physical scene, including CRT content.
const palette=['06080c','0b1017','121923','1a242e','24323b','30414a','40535a','52666a','687b79','82918a','a2ad98','c3c7ac','23080c','420c14','681320','921f2b','bd3741','3d4134','5d6653','7b8569'];

export function roomPixelSize(width:number,height:number){
 const step=width<=760?1.65:2.25;
 const w=Math.max(1,Math.round(width/step));
 return{width:w,height:Math.max(1,Math.round(w*height/Math.max(1,width)))};
}

/** A modest scene buffer and a restrained palette pass, with nearest-neighbour output.
 * No second context, composer, bloom or full-resolution postprocessing. */
export function createRoomPixelPass(renderer:WebGLRenderer){
 const target=new WebGLRenderTarget(1,1,{
  minFilter:NearestFilter,magFilter:NearestFilter,generateMipmaps:false,
  type:renderer.extensions.has('EXT_color_buffer_float')?HalfFloatType:UnsignedByteType,
  depthBuffer:true,stencilBuffer:false,
 });
 const material=new RawShaderMaterial({
  depthTest:false,depthWrite:false,
  uniforms:{tScene:{value:target.texture},toneMappingExposure:{value:.9},cameraTime:{value:0},cameraSignal:{value:0},recording:{value:1},texel:{value:new Vector2(1,1)},palette:{value:palette.map(hex=>new Vector3(parseInt(hex.slice(0,2),16)/255,parseInt(hex.slice(2,4),16)/255,parseInt(hex.slice(4,6),16)/255))}},
  vertexShader:`precision highp float;
   attribute vec3 position;attribute vec2 uv;varying vec2 vUv;
   void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
  fragmentShader:`precision highp float;
   uniform sampler2D tScene;uniform vec3 palette[${palette.length}];varying vec2 vUv;
   uniform vec2 texel;uniform float cameraTime;uniform float cameraSignal;uniform float recording;
   #include <tonemapping_pars_fragment>
   #include <colorspace_pars_fragment>
   float bayer(vec2 p){
    vec2 a=mod(floor(p),2.0),b=mod(floor(p/2.0),2.0);
    float first=mod(a.x+a.y,2.0)*2.0+a.y;
    float second=mod(b.x+b.y,2.0)*2.0+b.y;
    return (first*4.0+second+.5)/16.0;
   }
   void main(){
    // A filmed tape transfer: restrained chroma lag, edge softness and row timebase.
    // Every object and light source goes through the same transfer once.
    vec2 uv=vUv;float row=floor(uv.y/texel.y);
    uv.x+=recording*(sin(row*.69+cameraTime*1.7)*.00028+cameraSignal*.0011*sin(uv.y*87.));
    vec3 raw=texture2D(tScene,uv).rgb;
    vec3 shoulders=(texture2D(tScene,uv+vec2(texel.x,0.)).rgb+texture2D(tScene,uv-vec2(texel.x,0.)).rgb)*.5;
    vec3 vertical=(texture2D(tScene,uv+vec2(0.,texel.y)).rgb+texture2D(tScene,uv-vec2(0.,texel.y)).rgb)*.5;
    float periphery=smoothstep(.15,.75,length((vUv-.5)*vec2(1.,.8)));
    raw=mix(raw,shoulders,recording*(.13+periphery*.16));
    raw=mix(raw,vertical,recording*.035);
    raw+=max(shoulders-vec3(.75),vec3(0.))*recording*.06;
    raw.r=mix(raw.r,texture2D(tScene,uv+vec2(texel.x*.90,0.)).r,recording*.34);
    raw.b=mix(raw.b,texture2D(tScene,uv-vec2(texel.x*.70,0.)).b,recording*.31);
    vec3 color=ACESFilmicToneMapping(raw);
    color=sRGBTransferOETF(vec4(color,1.0)).rgb;
    float luma=dot(color,vec3(.2126,.7152,.0722));
    color=mix(vec3(luma),color,mix(.95,.85,recording))*mix(vec3(1.),vec3(.94,1.,.99),recording);
    color=clamp(color+vec3((bayer(gl_FragCoord.xy)-.5)*.012),0.0,1.0);
    float grain=fract(sin(dot(floor(gl_FragCoord.xy)+floor(cameraTime*11.),vec2(12.9898,78.233)))*43758.5453)-.5;
    float lineNoise=fract(sin(row*57.31+floor(cameraTime*8.))*13758.17)-.5;
    color+=recording*(grain*.014+lineNoise*.006);color*=1.-recording*.021*(.5+.5*sin(gl_FragCoord.y*3.14159));
    vec3 chosen=palette[0];float nearest=100.0;
    for(int i=0;i<${palette.length};i++){
     vec3 delta=color-palette[i];float distance=dot(delta*delta,vec3(.30,.58,.12));
     if(distance<nearest){nearest=distance;chosen=palette[i];}
    }
    gl_FragColor=vec4(mix(color,chosen,mix(.28,.50,recording)),1.0);
   }`,
 });
 const geometry=new PlaneGeometry(2,2),quad=new Mesh(geometry,material),scene=new Scene(),camera=new OrthographicCamera(-1,1,1,-1,0,1);scene.add(quad);
 return{
  target,
  resize(width:number,height:number){target.setSize(width,height);material.uniforms.texel.value.set(1/width,1/height);},
  present(exposure:number,time=0,signal=false,recording=1){material.uniforms.recording.value=recording;material.uniforms.toneMappingExposure.value=exposure;material.uniforms.cameraTime.value=time;material.uniforms.cameraSignal.value=Number(signal);renderer.setRenderTarget(null);renderer.render(scene,camera);},
  dispose(){target.dispose();geometry.dispose();material.dispose();},
 };
}
