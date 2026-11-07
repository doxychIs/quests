import {CanvasTexture,Group,Mesh,MeshStandardMaterial,PlaneGeometry,SRGBColorSpace,type Object3D} from 'three';
import {drawGraphicText} from './broadcast-glyphs';

/** Original medical line drawings and chalk pigment, attached to real surfaces. */
export function addRoomEvidence(parent:Object3D){
 const group=new Group();group.name='RoomHospitalEvidence';parent.add(group);
 const maps:CanvasTexture[]=[],materials:MeshStandardMaterial[]=[],geometries:PlaneGeometry[]=[];
 let seed=20831;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 function surface(canvas:HTMLCanvasElement,position:[number,number,number],size:[number,number],rotation:[number,number,number],transparent=false){
  const map=new CanvasTexture(canvas);map.colorSpace=SRGBColorSpace;maps.push(map);
  const material=new MeshStandardMaterial({map,roughness:.98,transparent,alphaTest:transparent?.035:0,depthWrite:!transparent,polygonOffset:true,polygonOffsetFactor:-1});materials.push(material);
  const geometry=new PlaneGeometry(...size);geometries.push(geometry);const mesh=new Mesh(geometry,material);mesh.position.set(...position);mesh.rotation.set(...rotation);mesh.receiveShadow=true;group.add(mesh);return mesh;
 }
 const paper=(title:string,index:number)=>{
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=640;const c=canvas.getContext('2d')!;
  c.fillStyle=index===1?'#7d8a80':'#a3a08a';c.fillRect(0,0,512,640);
  const shade=c.createRadialGradient(210,280,80,250,300,410);shade.addColorStop(0,'#aeb69b10');shade.addColorStop(1,'#242e2977');c.fillStyle=shade;c.fillRect(0,0,512,640);
  c.strokeStyle='#45574b';c.lineWidth=3;c.strokeRect(23,23,466,594);drawGraphicText(c,title,40,46,25,'#394d43',index+80,430);
  c.strokeStyle='#384c43';c.lineWidth=3;c.lineCap='round';
  if(index===0){
   // Rib cage, sternum, spine and a pelvis: a worn teaching chart.
   c.beginPath();c.moveTo(256,130);c.lineTo(256,491);c.stroke();
   for(let rib=0;rib<9;rib++){const y=181+rib*22,w=88-Math.abs(rib-3)*8;for(const side of [-1,1]){c.beginPath();c.moveTo(256,y);c.bezierCurveTo(256+side*w*.8,y-28,256+side*w*1.12,y-13,256+side*w,y+17);c.bezierCurveTo(256+side*w*.8,y+30,256+side*16,y+22,256,y+8);c.stroke();}}
   for(let y=154;y<486;y+=14){c.strokeRect(249,y,14,7);}
   c.beginPath();c.ellipse(256,132,34,43,0,0,Math.PI*2);c.moveTo(253,465);c.bezierCurveTo(141,429,172,558,225,535);c.lineTo(256,494);c.lineTo(285,535);c.bezierCurveTo(340,550,365,430,259,465);c.stroke();
  }else if(index===1){
   for(let i=0;i<5;i++){c.strokeRect(57,130+i*82,38,38);for(let row=0;row<3;row++){c.fillStyle='#43594a';c.fillRect(119,133+i*82+row*15,235-(row%2)*60,3);}}
   c.strokeStyle='#78352d';c.lineWidth=5;c.beginPath();c.moveTo(65,331);c.lineTo(88,354);c.lineTo(123,306);c.stroke();
  }else{
   c.fillStyle='#34493e';c.fillRect(60,127,390,365);c.strokeStyle='#899887';c.lineWidth=3;
   for(let side of [-1,1]){c.beginPath();c.moveTo(256,171);c.bezierCurveTo(256+side*64,178,256+side*138,271,256+side*111,410);c.bezierCurveTo(256+side*49,434,256+side*18,392,256,355);c.stroke();}
   c.beginPath();c.moveTo(255,147);c.lineTo(255,326);c.stroke();
  }
  for(let i=0;i<1600;i++){c.fillStyle=i%3?'#172d2110':'#c2c2a121';c.fillRect(random()*512,random()*640,1+random()*5,1+random()*3);}
  for(let y=566;y<602;y+=10){c.fillStyle='#3b504477';c.fillRect(54,y,160+random()*200,2);}
  return canvas;
 };
 surface(paper('АНАТОМИЯ',0),[-4.313,2.12,2],[1.09,1.29],[0,Math.PI/2,0]);
 surface(paper('ЛИСТ НАЗНАЧЕНИЙ',1),[4.313,2.13,-1],[.85,1.09],[0,-Math.PI/2,0]);
 surface(paper('АРХИВ / 1986',2),[-5.65,2.08,-11.816],[.94,1.12],[0,0,0]);
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=1536;const c=canvas.getContext('2d')!;
 c.strokeStyle='#c3c7b8';c.lineWidth=18;c.lineJoin=c.lineCap='round';
 const contour=()=>{
  c.beginPath();c.moveTo(337,327);c.bezierCurveTo(248,292,277,145,367,145);c.bezierCurveTo(464,140,484,286,411,326);
  c.lineTo(416,358);c.lineTo(500,393);c.lineTo(589,585);c.lineTo(636,739);c.lineTo(600,754);c.lineTo(547,627);c.lineTo(487,537);
  c.lineTo(480,802);c.lineTo(523,1005);c.lineTo(596,1268);c.lineTo(603,1342);c.lineTo(532,1348);c.lineTo(510,1293);c.lineTo(414,1017);
  c.lineTo(379,888);c.lineTo(346,1023);c.lineTo(306,1300);c.lineTo(319,1368);c.lineTo(237,1369);c.lineTo(235,1284);c.lineTo(266,997);
  c.lineTo(270,786);c.lineTo(267,535);c.lineTo(218,630);c.lineTo(173,757);c.lineTo(138,744);c.lineTo(173,578);c.lineTo(245,400);c.lineTo(331,359);c.closePath();c.stroke();
 };
 contour();c.globalAlpha=.22;c.translate(2,-2);c.lineWidth=24;contour();c.resetTransform();c.globalAlpha=1;
 c.globalCompositeOperation='destination-out';for(let i=0;i<2600;i++)c.fillRect(random()*768,random()*1536,1+random()*7,1+random()*3);c.globalCompositeOperation='source-over';
 const outline=surface(canvas,[.12,.032,-.20],[1.18,2.30],[-Math.PI/2,0,-.22],true);outline.name='RoomChalkHumanOutline';outline.renderOrder=3;
 outline.material.emissive.set('#8e9d87');outline.material.emissiveIntensity=.08;
 return{outline,dispose(){parent.remove(group);maps.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());}};
}
