import {Mesh,Vector3,type Object3D} from 'three';

export const roomHandAnchors=[[-1,8,2.19],[1,8.7,1.46],[-1,10.6,1.32],[1,11.3,2.38],[-1,13.8,2.09],[1,15.3,1.15],[-1,17,1.49],[1,18.7,2.29]];
/** Deform only the existing hand mesh, with a fixed root at the plaster.
 * Original editable Blender hands stay intact; no new models or draw calls. */
export function createRoomHands(root:Object3D){
 const entries:{mesh:Mesh;rest:Float32Array;groups:Uint8Array}[]=[];
 root.traverse(object=>{
  if(!(object instanceof Mesh)||!object.name.includes('Corridor_shadowed_skin'))return;
  const attribute=object.geometry.attributes.position;if(!attribute)return;
  const rest=new Float32Array(attribute.count*3),groups=new Uint8Array(attribute.count);object.updateWorldMatrix(true,false);
  const point=new Vector3();
  for(let i=0;i<attribute.count;i++){
   rest.set([attribute.getX(i),attribute.getY(i),attribute.getZ(i)],i*3);
   point.fromBufferAttribute(attribute,i).applyMatrix4(object.matrixWorld);let nearest=Infinity;
   roomHandAnchors.forEach(([side,z,y],index)=>{const distance=(point.z-z)**2+(point.y-y)**2+(point.x-side)**2;if(distance<nearest){nearest=distance;groups[i]=index;}});
  }
  entries.push({mesh:object,rest,groups});
 });
 let previous='';
 return{update(amount=0,index=0,time=0,cameraZ=0){
  const signature=amount+':'+index+':'+time+':'+cameraZ;if(signature===previous)return;previous=signature;
  for(const {mesh,rest,groups}of entries){
   const attribute=mesh.geometry.attributes.position;
   for(let i=0;i<attribute.count;i++){
    const offset=i*3,x=rest[offset],y=rest[offset+1],z=rest[offset+2],side=Math.sign(x)||1;
    const group=groups[i],anchor=roomHandAnchors[group],visible=time>0&&anchor[1]<cameraZ+.2&&anchor[1]>cameraZ-7;
    const idle=visible?(Math.sin(time*.00145+group*2.17)*.72+Math.sin(time*.0029+group*.81)*.28):0;
    const strength=(group===index?amount:0)+idle,weight=Math.max(0,Math.min(1,(1.5-Math.abs(x))/.85));
    const reach=time>0?.21:.075,curl=time>0?.12:.055,sweep=time>0?.19:.065;
    attribute.setXYZ(i,side*Math.max(time>0?.45:.56,Math.abs(x)-strength*weight*reach),y+strength*weight*curl,z+strength*weight*weight*sweep);
   }
   attribute.needsUpdate=true;
  }
 },dispose(){for(const {mesh,rest}of entries){const attribute=mesh.geometry.attributes.position;for(let i=0;i<attribute.count;i++)attribute.setXYZ(i,rest[i*3],rest[i*3+1],rest[i*3+2]);attribute.needsUpdate=true;}entries.length=0;}};
}
