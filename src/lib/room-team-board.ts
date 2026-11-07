import {CanvasTexture,Group,Mesh,MeshStandardMaterial,PlaneGeometry,SRGBColorSpace,type Object3D} from 'three';
import {roomStations} from './room-experience';

/** Blood pigment on existing plaster: no board, frame, glass or light source. */
export function addRoomTeamBoard(parent:Object3D,rows:{title:string;subtitle?:string}[]){
 const station=roomStations.find(s=>s.id==='team')!,group=new Group();group.name='RoomBloodWriting';group.position.set(...station.center);group.rotation.y=station.rotationY!;
 const canvas=document.createElement('canvas');canvas.width=960;canvas.height=690;
 const c=canvas.getContext('2d')!;c.fillStyle='#b43139';
 function line(text:string,x:number,y:number,size:number){
  c.font=`bold ${size}px "Segoe Print",cursive`;let px=x;
  for(const [i,char]of [...text].entries()){c.save();c.translate(px,y+Math.sin(i*4.7)*2);c.rotate(Math.sin(i*2.3)*.025);c.fillText(char,0,0);c.restore();if(i%4===0&&char!==' '){c.fillRect(px+size*.2,y-2,1.5,12+i%17);}px+=c.measureText(char).width;}
 }
 line('НЕ ВХОДИТЕ ОДНИ',42,88,54);line('Сколько вас?',48,166,34);line('2    3    4    5    6',48,235,42);
 rows.forEach((row,index)=>{line(row.title,48,320+index*83,31);line(row.subtitle||'',48,352+index*83,23);});
 const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;
 const material=new MeshStandardMaterial({map:texture,transparent:true,alphaTest:.025,depthWrite:false,roughness:.91,metalness:0,polygonOffset:true,polygonOffsetFactor:-2});
 const face=new Mesh(new PlaneGeometry(station.width,station.height),material);face.name='RoomScreen_team';face.receiveShadow=true;group.add(face);parent.add(group);
 return{face,material,dispose(){parent.remove(group);face.geometry.dispose();texture.dispose();material.dispose();}};
}
