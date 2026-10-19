import test from 'node:test';
import assert from 'node:assert/strict';
import {roomScreens,roomSize,screenHomography,projectScreen} from '../src/lib/crt-room.ts';
import {tvReadingCamera} from '../src/lib/tv-reading.ts';

test('Чтение на ТВ: камера выравнивает каждый экран и сохраняет размер букв при любой ширине',()=>{
 for(const [vw,vh] of [[1440,900],[1920,1080],[768,1024],[390,844],[320,740],[844,390]]){
  const sw=Math.min(vw,vh*16/9),scale=sw/roomSize.width;
  for(const screen of roomScreens.filter(s=>s.kind==='quest')){
   const camera=tvReadingCamera(screen.quad,sw,vw,vh),m=camera.css;
   const transform=p=>{const x=p.x*scale,y=p.y*scale,d=m[3]*x+m[7]*y+m[15];return{x:(m[0]*x+m[4]*y+m[12])/d+camera.stageLeft,y:(m[1]*x+m[5]*y+m[13])/d+camera.stageTop}};
   const h=screenHomography(screen.quad);
   for(const [u,v] of [[0,0],[1,0],[1,1],[0,1],[.25,.4],[.7,.8]]){
    const p=transform(projectScreen(h,u,v));
    assert.ok(Math.abs(p.x-(camera.left+u*camera.width))<1e-7,screen.id+' horizontal');
    assert.ok(Math.abs(p.y-(camera.top+v*camera.height))<1e-7,screen.id+' vertical');
   }
   assert.ok(camera.left>=19&&camera.left+camera.width<=vw-19);
   assert.ok(camera.top>=69&&camera.top+camera.height<vh);
  }
 }
});
