import {Matrix4,Vector3,type Material,type Object3D} from 'three';

// Bind-pose coordinates of the approved GLB. The wrist is y=0; its cut end is y=.197.
export const HAND_ORIGIN_FADE_START=.12,HAND_ORIGIN_FADE_END=.185,HAND_ORIGIN_Y=.16;
export function handOriginOpacity(y:number){
 const t=Math.max(0,Math.min(1,(y-HAND_ORIGIN_FADE_START)/(HAND_ORIGIN_FADE_END-HAND_ORIGIN_FADE_START)));
 return 1-t*t*(3-2*t);
}

/** Use the animated forearm's coordinate frame after morphing and skinning. */
export function softenHandOrigin(material:Material,forearm:Object3D,wristLocal:Vector3,directionLocal:Vector3){
 const before=material.onBeforeCompile,cache=material.customProgramCacheKey.bind(material);
 const frame={value:new Matrix4().copy(forearm.matrixWorld).invert()},wrist={value:wristLocal.clone()},direction={value:directionLocal.clone()};
 material.transparent=true;
 material.onBeforeCompile=function(shader,renderer){
  before.call(this,shader,renderer);
  shader.uniforms.uHandOriginFrame=frame;shader.uniforms.uHandOriginWrist=wrist;shader.uniforms.uHandOriginDirection=direction;
  shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
   uniform mat4 uHandOriginFrame;uniform vec3 uHandOriginWrist,uHandOriginDirection;varying vec3 vHandOriginPosition;varying float vHandOriginY;`)
   .replace('#include <skinning_vertex>',`#include <skinning_vertex>
    vHandOriginPosition=(uHandOriginFrame*modelMatrix*vec4(transformed,1.0)).xyz;
    vHandOriginY=dot(vHandOriginPosition-uHandOriginWrist,uHandOriginDirection);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vHandOriginPosition;varying float vHandOriginY;')
   .replace('#include <color_fragment>',`#include <color_fragment>
    float originNoise=sin(vHandOriginPosition.x*190.0+vHandOriginPosition.z*130.0)*.002;
    diffuseColor.a*=1.0-smoothstep(${HAND_ORIGIN_FADE_START},${HAND_ORIGIN_FADE_END},vHandOriginY+originNoise);`);
 };
 material.customProgramCacheKey=()=>cache()+'|inoe-soft-origin-2';
 material.needsUpdate=true;
 return {update(){frame.value.copy(forearm.matrixWorld).invert()}};
}
