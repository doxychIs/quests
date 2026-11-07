import {CanvasTexture,Group,InstancedMesh,Mesh,MeshStandardMaterial,Object3D,PlaneGeometry,SphereGeometry,SRGBColorSpace,type Scene} from 'three';

/** Blood is attached to room surfaces in metres, lit by the same scene.
 * These are static, seeded stains: no screen overlay and no animation loop. */
export function addRoomBlood(scene:Scene){
 let seed=604317;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const group=new Group();group.name='RoomBlood';scene.add(group);
 const maps=['pool','spatter','drag'].map(kind=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const c=canvas.getContext('2d')!;
  function spot(x:number,y:number,rx:number,ry:number,opacity=1){
   c.save();c.translate(x,y);c.scale(rx,ry);c.globalAlpha=opacity;
   const phase=random()*6.28,points=42;
   c.beginPath();
   for(let i=0;i<=points;i++){
    const angle=i/points*Math.PI*2;
    const radius=.83+.10*Math.sin(angle*5+phase)+.07*Math.sin(angle*9+phase*2)+random()*.035;
    const px=Math.cos(angle)*radius,py=Math.sin(angle)*radius;
    if(i===0)c.moveTo(px,py);else c.lineTo(px,py);
   }
   c.closePath();
   const pigment=c.createRadialGradient(-.15,-.1,.1,0,0,1);
   pigment.addColorStop(0,'#8b1021');pigment.addColorStop(.63,'#a31225');pigment.addColorStop(1,'#640916');
   c.fillStyle=pigment;c.fill();c.restore();
  }
  if(kind==='pool'){
   spot(257,266,211,153);
   c.strokeStyle='#861020e6';c.lineWidth=11;c.lineCap='round';c.beginPath();c.moveTo(112,302);c.bezierCurveTo(89,314,78,313,51,335);c.stroke();
   for(let i=0;i<38;i++){const a=random()*Math.PI*2,r=170+random()*78;spot(257+Math.cos(a)*r,270+Math.sin(a)*r*.64,2+random()*10,2+random()*7,.55+random()*.4);}
  }else if(kind==='spatter'){
   spot(245,174,132,86,.94);
   for(let i=0;i<90;i++){
    const a=random()*Math.PI*2,r=Math.pow(random(),.65)*205;
    const size=2+Math.pow(random(),3)*17;
    spot(252+Math.cos(a)*r,197+Math.sin(a)*r*.65,size,size*(.6+random()*.8),.5+random()*.5);
   }
   for(let i=0;i<11;i++){
    const x=156+random()*190,y=179+random()*75,length=65+random()*185,width=1.5+random()*4;
    c.strokeStyle=i%3?'#861020dd':'#4c0713bb';c.lineWidth=width;c.lineCap='round';c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x-3,y+length*.4,x+4,y+length*.8,x+1,y+length);c.stroke();spot(x+1,y+length,width*.8,width*1.4,.85);
   }
  }else{
   for(let i=0;i<12;i++){
    const x=151+i*14+random()*12,top=65+random()*115,length=140+random()*200;
    c.strokeStyle=i%3?'#9c1223d9':'#520714cc';c.lineWidth=5+random()*15;c.lineCap='round';
    c.beginPath();c.moveTo(x,top);c.bezierCurveTo(x-20,top+length*.2,x+25,top+length*.65,x+18,top+length);c.stroke();
   }
   for(let i=0;i<25;i++)spot(100+random()*310,100+random()*320,2+random()*7,3+random()*10,.5);
  }
  // Fine gaps and darker coagulated fragments break up flat graphic fills.
  for(let i=0;i<440;i++){
   c.globalCompositeOperation=i%4?'source-atop':'destination-out';c.globalAlpha=.08+random()*.15;
   c.fillStyle='#24030a';c.fillRect(random()*512,random()*512,1+random()*5,1+random()*4);
  }
  c.globalCompositeOperation='source-over';c.globalAlpha=1;
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;texture.anisotropy=2;
  return texture;
 });
 const materials=maps.map((map,i)=>new MeshStandardMaterial({map,transparent:true,alphaTest:.12,depthWrite:false,roughness:i===0?.57:.85,metalness:0,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
 const geometries:PlaneGeometry[]=[];
 const patch=(name:string,kind:number,position:[number,number,number],size:[number,number],rotation:[number,number,number])=>{
  const geometry=new PlaneGeometry(...size);geometries.push(geometry);
  const mesh=new Mesh(geometry,materials[kind]);mesh.name=name;mesh.position.set(...position);mesh.rotation.set(...rotation);mesh.receiveShadow=true;mesh.renderOrder=2;group.add(mesh);return mesh;
 };
 patch('Ward floor pool',0,[.3,.012,2.55],[2.15,1.65],[-Math.PI/2,0,.3]);
 patch('Bedside floor pool',0,[2.75,.014,3.4],[1.55,1.25],[-Math.PI/2,0,-.4]);
 patch('Ward dragged trail',2,[-.1,.014,-.5],[1.05,3.4],[-Math.PI/2,0,-.16]);
 patch('Rear floor stain',0,[-1.55,.014,-3.8],[1.35,1.5],[-Math.PI/2,0,.8]);
 patch('Corridor floor pool',0,[-.2,.014,14.6],[1.45,1.9],[-Math.PI/2,0,.25]);
 patch('Doorway blood trail',2,[.3,.014,8.1],[.95,2.4],[-Math.PI/2,0,.5]);
 patch('Right tile blood',1,[4.353,1.04,1.35],[2.2,1.72],[0,-Math.PI/2,0]);
 patch('Rear wall blood',1,[-3.52,1.94,-6.88],[1.6,1.85],[0,0,-.09]);
 patch('Left tile drag',2,[-4.334,.94,-2.25],[1.75,1.6],[0,Math.PI/2,0]);
 patch('Corridor wall spatter',1,[1.478,1.48,15.6],[1.65,2.0],[0,-Math.PI/2,0]);
 patch('Corridor wall drag',2,[-1.478,1.10,11.1],[1.05,1.8],[0,Math.PI/2,0]);
 // Follow the existing folded sheet, rather than float a flat image over it.
 const sheet=new PlaneGeometry(1.25,1.65,16,20);sheet.rotateX(-Math.PI/2);sheet.translate(3.45,0,4.4);
 const positions=sheet.attributes.position;
 for(let i=0;i<positions.count;i++){
  const xx=positions.getX(i)-3.45,z=positions.getZ(i),u=(xx+1.01)/2.02,v=(5.43-z)/1.94;
  const y=.922-.43*Math.max(0,(Math.abs(xx)-.66)/.35)+.012*Math.sin(v*18+u*7)+.006*Math.cos(u*28+v*4)+.012*Math.sin(u*68+v*9)*Math.max(0,(Math.abs(xx)-.55)/.45);
  positions.setY(i,y+.004);
 }
 sheet.computeVertexNormals();geometries.push(sheet);
 const sheetBlood=new Mesh(sheet,materials[0]);sheetBlood.name='Blood soaked sheet';sheetBlood.receiveShadow=true;sheetBlood.renderOrder=2;group.add(sheetBlood);
 const ceilingZones:[number,number,number][]=[[.3,3.28,2.55],[.1,3.28,10.8],[-.15,3.28,15.3],[.2,3.28,18.5],[2.8,3.28,4.0]];
 ceilingZones.forEach((position,i)=>patch('Ceiling seep '+i,1,position,[.65,.85],[Math.PI/2,0,i*.3]));
 const dropGeometry=new SphereGeometry(1,6,5),dropMaterial=new MeshStandardMaterial({color:'#780e1d',roughness:.36,metalness:.03});
 const drops=new InstancedMesh(dropGeometry,dropMaterial,8),dummy=new Object3D();drops.name='RoomFallingBlood';drops.visible=false;drops.frustumCulled=false;group.add(drops);
 return{group,update(progress?:number,zone=0){
  drops.visible=progress!==undefined;if(progress===undefined)return;
  const [x,y,z]=ceilingZones[Math.max(0,Math.min(4,zone))];
  for(let i=0;i<8;i++){
   const t=(progress-i*.045)/.58,fall=Math.max(0,Math.min(1,t));
   dummy.position.set(x+Math.sin(i*12.7)*.17,y-fall*fall*(y-.02),z+Math.cos(i*7.1)*.18);
   const show=t>=0&&t<=1;dummy.scale.set(show?.013:0,show?.026+fall*.028:0,show?.013:0);dummy.updateMatrix();drops.setMatrixAt(i,dummy.matrix);
  }
  drops.instanceMatrix.needsUpdate=true;
 },dispose(){scene.remove(group);drops.dispose();dropGeometry.dispose();dropMaterial.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());maps.forEach(t=>t.dispose());}};
}
