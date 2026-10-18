import {analogProfiles,newSignalEvent,advanceSignalEvent,type AnalogProfile,type SignalEvent} from './analog-profiles';

const vertex=`attribute vec2 position;varying vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
/** Chroma is band-limited independently of luma. There is no full-image blur pass. */
const fragment=`precision mediump float;
varying vec2 uv;uniform sampler2D image;uniform sampler2D previous;
uniform vec2 resolution;uniform float time;uniform float seed;uniform float gain;uniform float contrast;uniform float black;
uniform float bleed;uniform float ghost;uniform float scan;uniform float pitch;uniform float maskStrength;uniform float curve;
uniform float disruption;uniform float disruptionRow;uniform float quiet;uniform float reflection;uniform vec3 temperature;
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+seed)*43758.5453);}
float luma(vec3 c){return dot(c,vec3(.299,.587,.114));}
vec2 chroma(vec3 c){return vec2(dot(c,vec3(.596,-.274,-.322)),dot(c,vec3(.211,-.523,.312)));}
void main(){
 vec2 p=uv;vec2 radial=p*2.-1.;p+=radial*dot(radial,radial)*curve*.095;
 float line=floor(p.y*resolution.y);
 float wobble=(sin(line*.029+time*.63+seed)+sin(line*.113-time*.41+seed*.17))*.105*(1.-quiet);
 float window=1.-smoothstep(.005,.035,abs(p.y-disruptionRow));
 p.x+=(wobble+disruption*window*sin(line*.16+time*4.))/resolution.x;
 p=clamp(p,vec2(.001),vec2(.999));vec2 dx=vec2(1./resolution.x,0.);
 vec3 center=texture2D(image,p).rgb;
 float edge=pow(clamp(dot(radial,radial)*.46,0.,1.),2.);
 float y=mix(luma(center),luma((texture2D(image,p-dx).rgb+texture2D(image,p+dx).rgb)*.5),edge*.13);
 vec2 iq=chroma(center)*.55+chroma(texture2D(image,p-dx*bleed*1.6).rgb)*.27+chroma(texture2D(image,p+dx*bleed*.8).rgb)*.18;
 vec3 color=vec3(y+.956*iq.x+.621*iq.y,y-.272*iq.x-.647*iq.y,y-1.106*iq.x+1.703*iq.y);
 // Weak cable echo and phosphor persistence: a real previous source frame.
 vec3 echo=texture2D(previous,clamp(p-vec2((2.4+bleed*1.8)/resolution.x,0.),vec2(.001),vec2(.999))).rgb;
 color=mix(color,echo,ghost*(1.-quiet*.65));
 float beam=1.-scan*(.5+.5*cos((gl_FragCoord.y+sin(time*.13+seed)*.16)*6.283185/pitch));
 float triad=mod(gl_FragCoord.x,3.);vec3 phosphor=vec3(1.);
 if(triad<1.)phosphor.gb-=maskStrength;else if(triad<2.)phosphor.rb-=maskStrength;else phosphor.rg-=maskStrength;
 float field=1.+(sin(time*.71+seed)*.007+sin(time*1.27+seed*1.8)*.004)*(1.-quiet);
 float lineNoise=(hash(vec2(line,floor(time*5.)+seed))-.5)*.007*(1.-quiet*.7);
 float cameraGrain=(hash(gl_FragCoord.xy+floor(time*11.))-.5)*.013;
 color=(color-.12)*(contrast+sin(time*.33+seed)*.003*(1.-quiet))+.12;color*=temperature*gain*beam*phosphor*field;
 // Glass absorbs oblique rays. The image stays sharp in the central field.
 float falloff=1.-smoothstep(.24,1.55,dot(radial,radial))*.33;color*=falloff;
 color+=black+lineNoise+cameraGrain;
 // A few weak phosphor sites age differently; never a uniform digital grid overlay.
 float aged=step(.997,hash(floor(gl_FragCoord.xy/2.)));color*=1.-aged*.14;
 float glare=exp(-pow((p.x+p.y*.25-.21)*4.8,2.))*pow(1.-p.y,3.);
 color+=vec3(.64,.7,.66)*reflection*glare;
 color*=1.-disruption*window*.06;
 gl_FragColor=vec4(clamp(color,vec3(0.),vec3(.87)),1.);
}`;

type ScreenState={event:SignalEvent;output:HTMLCanvasElement;ctx:CanvasRenderingContext2D;texture?:WebGLTexture;previous?:WebGLTexture;hasPrevious:boolean;last:number};
export class AnalogSignalRenderer{
 readonly surface:HTMLCanvasElement;private gl:WebGLRenderingContext|null=null;private program:WebGLProgram|null=null;private states=new Map<string,ScreenState>();private uniforms=new Map<string,WebGLUniformLocation|null>();private modeValue='canvas';
 constructor(readonly width=640,readonly height=480){
  this.surface=document.createElement('canvas');this.surface.width=width;this.surface.height=height;
  this.initialize();this.surface.addEventListener('webglcontextlost',e=>{e.preventDefault();this.gl=null;this.modeValue='canvas';for(const state of this.states.values()){state.texture=undefined;state.previous=undefined;state.hasPrevious=false}});
  this.surface.addEventListener('webglcontextrestored',()=>this.initialize());
 }
 get mode(){return this.modeValue}
 private initialize(){
  try{
   const gl=this.surface.getContext('webgl',{alpha:false,depth:false,stencil:false,antialias:false,powerPreference:'low-power'});
   if(!gl||typeof gl.createShader!=='function')return;
   const compile=(type:number,source:string)=>{const shader=gl.createShader(type)!;gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);return null}return shader};
   const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);if(!vs||!fs)return;
   const program=gl.createProgram()!;gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS))return;
   gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const attr=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
   this.gl=gl;this.program=program;this.uniforms.clear();this.modeValue='webgl';gl.viewport(0,0,this.width,this.height);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  }catch{this.gl=null}
 }
 private location(name:string){if(!this.uniforms.has(name))this.uniforms.set(name,this.gl!.getUniformLocation(this.program!,name));return this.uniforms.get(name)!}
 private texture(){const gl=this.gl!,texture=gl.createTexture()!;gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);return texture}
 render(id:string,source:HTMLCanvasElement,time:number,quiet:boolean){
  const profile=analogProfiles[id]||analogProfiles['wood-floor'];let state=this.states.get(id);
  if(!state){const output=document.createElement('canvas');output.width=this.width;output.height=this.height;const ctx=output.getContext('2d');if(!ctx)return source;state={output,ctx,event:newSignalEvent(),hasPrevious:false,last:time};this.states.set(id,state)}
  const event=quiet?0:advanceSignalEvent(state.event,time,profile);
  if(this.gl&&this.program){try{
   const gl=this.gl;gl.useProgram(this.program);state.texture??=this.texture();state.previous??=this.texture();
   gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,state.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
   gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,state.previous);if(!state.hasPrevious)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
   gl.uniform1i(this.location('image'),0);gl.uniform1i(this.location('previous'),1);gl.uniform2f(this.location('resolution'),this.width,this.height);gl.uniform3f(this.location('temperature'),...profile.temperature);
   const uniforms={time:quiet?0:time,seed:profile.seed,gain:profile.gain,contrast:profile.contrast,black:profile.black,bleed:profile.bleed,ghost:profile.ghost,scan:profile.scan,pitch:profile.pitch,maskStrength:profile.mask,curve:profile.curve,reflection:profile.reflection,disruption:event,disruptionRow:state.event.row,quiet:quiet?1:0};
   for(const [name,value]of Object.entries(uniforms))gl.uniform1f(this.location(name),value);
   gl.drawArrays(gl.TRIANGLE_STRIP,0,4);state.ctx.drawImage(this.surface,0,0);
   gl.bindTexture(gl.TEXTURE_2D,state.previous);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);state.hasPrevious=true;return state.output;
  }catch{this.gl=null;this.modeValue='canvas'}}
  this.fallback(state,source,profile,time,quiet,event);return state.output;
 }
 private fallback(state:ScreenState,source:HTMLCanvasElement,p:AnalogProfile,time:number,quiet:boolean,event:number){
  const c=state.ctx,w=this.width,h=this.height;c.globalCompositeOperation='source-over';c.globalAlpha=1;c.fillStyle='#070b0b';c.fillRect(0,0,w,h);
  // Conservative fallback keeps luma detail and row structure; no blur or resolution trick.
  c.filter=`saturate(.65) contrast(${p.contrast}) brightness(${p.gain})`;
  for(let y=0;y<h;y+=6){const offset=quiet?0:Math.sin(y*.03+time*.7+p.seed)*.23+(Math.abs(y/h-state.event.row)<.03?event:0);c.drawImage(source,0,y,w,6,offset,y,w,6)}c.filter='none';
  c.globalAlpha=p.ghost;c.drawImage(source,3,0);c.globalAlpha=1;c.fillStyle=`rgba(0,0,0,${p.scan*.85})`;for(let y=0;y<h;y+=p.pitch)c.fillRect(0,y,w,.55);
  const shade=c.createRadialGradient(w*.5,h*.47,w*.22,w*.5,h*.5,w*.72);shade.addColorStop(0,'#00000000');shade.addColorStop(1,'#01040470');c.fillStyle=shade;c.fillRect(0,0,w,h);
 }
 destroy(){if(this.gl){for(const s of this.states.values()){if(s.texture)this.gl.deleteTexture(s.texture);if(s.previous)this.gl.deleteTexture(s.previous)}if(this.program)this.gl.deleteProgram(this.program)}this.states.clear()}
}
