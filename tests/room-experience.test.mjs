import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PerspectiveCamera,Vector3} from 'three';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {roomCamera,roomCorridorProgress,roomEase,mixRoomPose,roomFocusPose,roomOverviewPose,roomStagePose,roomStages,roomStations,travelRoomPose} from '../src/lib/room-experience.ts';
import {projectionCSS} from '../src/lib/room-projection.ts';
import {setupDOM} from './dom-harness.mjs';

const sizes=[[1440,900],[1920,1080],[768,1024],[390,844],[320,740],[844,390]];
const matrixPoint=(m,x,y)=>{const d=m[3]*x+m[7]*y+m[15];return{x:(m[0]*x+m[4]*y+m[12])/d,y:(m[1]*x+m[5]*y+m[13])/d}};
function screenQuad(station,pose,width,height){
 const camera=new PerspectiveCamera(pose.fov,width/height,.07,45);camera.position.set(...pose.position);camera.lookAt(...pose.target);camera.updateMatrixWorld();
 const [x,y,z]=station.center;
 return[[-1,1],[1,1],[1,-1],[-1,-1]].map(([dx,dy])=>{
  const point=new Vector3(dx*station.width/2,dy*station.height/2,0).applyAxisAngle(new Vector3(0,1,0),station.rotationY||0).add(new Vector3(x,y,z)).project(camera);
  return{x:(point.x+1)*width/2,y:(1-point.y)*height/2};
 });
}

test('Единая камера плавно перемещается между точками, удерживает ракурсы и точно возвращается при обратной прокрутке',()=>{
 assert.equal(roomEase(-1),0);assert.equal(roomEase(2),1);assert.ok(roomEase(.1)<.01);assert.ok(roomEase(.9)>.99);
 for(const [width,height] of sizes){
  const aspect=width/height;
  for(const stage of roomStages){
   const first=roomCamera(stage.anchor*height,height,aspect);
   const held=roomCamera((stage.anchor+.2)*height,height,aspect);
   assert.equal(first.stage,stage.id);assert.equal(first.settled,true);assert.deepEqual(held.pose,first.pose);
  }
  const forward=[];
  for(let scroll=0;scroll<=(roomStages.at(-1).anchor+1.2)*height;scroll+=13){
   const frame=roomCamera(scroll,height,aspect);forward.push([scroll,frame]);
   assert.ok(frame.pose.fov>=40&&frame.pose.fov<=92,'Узкий экран помещается в линзу без въезда в стоящий впереди телевизор');
   if(frame.pose.fov>82)assert.ok(frame.pose.position[2]<-7,'Широкая линза применяется только у стойки дежурного');
   assert.ok(frame.pose.position.every(Number.isFinite));assert.ok(frame.pose.target.every(Number.isFinite));
   const previous=roomCamera(Math.max(0,scroll-1),height,aspect);
   for(let axis=0;axis<3;axis++)assert.ok(Math.abs(frame.pose.position[axis]-previous.pose.position[axis])<.08,'Нет телепортаций между стадиями');
  }
  for(const [scroll,frame] of forward.reverse())assert.deepEqual(roomCamera(scroll,height,aspect),frame,'Обратное направление не зависит от истории скролла');
 }
});

test('Поворот от койки к противоположной стене не схлопывает взгляд и обратим даже на обходном маршруте',()=>{
 const direction=pose=>new Vector3(...pose.target).sub(new Vector3(...pose.position));
 const opposite=[{position:[1,1.8,2],target:[5,1.8,2],fov:48},{position:[-1,1.8,2],target:[-5,1.8,2],fov:48}];
 for(const [width,height] of sizes){
  const aspect=width/height;
  for(const [from,to] of [opposite,[roomStagePose('team',aspect),roomStagePose('ward',aspect)]]){
   for(const interpolate of [mixRoomPose,travelRoomPose]){
    let previous=direction(from).normalize();
    for(let sample=0;sample<=600;sample++){
     const t=sample/600,pose=interpolate(from,to,t),view=direction(pose);
     assert.ok(view.length()>.9,'Во время разворота камера всегда имеет ненулевое направление взгляда');
     view.normalize();assert.ok(previous.angleTo(view)<.012,'Между соседними кадрами нет скачка или переворота на 180°');previous=view;
     const reverse=interpolate(to,from,1-t),reverseView=direction(reverse).normalize();
     assert.ok(view.distanceTo(reverseView)<1e-8,'Обратный скролл повторяет поворот, включая точную противоположность стен');
    }
   }
  }
 }
});

test('Первый кадр проходит по настоящему коридору через дверной проём и удерживает обзор палаты перед галереей',()=>{
 for(const [width,height] of sizes){
  const aspect=width/height,entry=roomStagePose('entry',aspect),overview=roomOverviewPose(aspect);
  assert.deepEqual(roomCamera(0,height,aspect).pose,entry);
  assert.equal(entry.position[2],19.3);assert.equal(entry.fov,aspect<.8?73:61);
  assert.equal(roomCorridorProgress(-100,height),0);assert.equal(roomCorridorProgress(.2*height,height),0);
  assert.equal(roomCorridorProgress(2.8*height,height),1);
  assert.deepEqual(roomCamera(2.8*height,height,aspect).pose,overview);
  assert.deepEqual(roomCamera(3.4*height,height,aspect).pose,overview,'После пролёта можно рассмотреть палату без немедленного ухода к ТВ');
  let previousZ=entry.position[2];
  for(let scroll=0;scroll<=2.8*height;scroll+=3){
   const frame=roomCamera(scroll,height,aspect),[x,y,z]=frame.pose.position;
   assert.equal(frame.stage,'entry');assert.ok(z<=previousZ+1e-9,'Камера непрерывно движется вперёд');previousZ=z;
   assert.ok(Math.abs(x)<.2&&y>1.6&&y<1.8,'Ручная камера не врезается в стены и дверную раму');
   assert.ok(frame.pose.target[2]<z-7.5,'Камера смотрит вдоль коридора, а не на боковую стену');
   assert.deepEqual(roomCamera(scroll,height,aspect),frame,'Движение воспроизводится без временного цикла');
  }
 }
 assert.ok(Math.abs(roomCorridorProgress(1.5,1)-.5)<1e-12);
});

test('Камера обходит корпуса, остаётся внутри комнаты и безопасно открывает любой ТВ с промежуточного ракурса',()=>{
 // Physical cabinet dimensions from the Blender model, expanded by 10 cm for
 // the camera/near plane. These are tighter than the routing safety volumes.
 const insideCabinet=([px,py,pz],station)=>{
  const [x,y,z]=station.center,w=station.width,h=station.height;
  return px>x-w/2-.17&&px<x+w*.62+.17&&py>y-h/2-.195&&py<y+h/2+.195&&pz>z-w*.4223-.1&&pz<z+.15;
 };
 for(const [width,height] of sizes){
  const aspect=width/height;
  const poses=[...roomStages.map(stage=>roomStagePose(stage.id,aspect)),roomOverviewPose(aspect),...roomStations.map(station=>roomFocusPose(station.id,aspect)),...[.8,1.4,2.3,3.7,6.3,8.7,11.3].map(unit=>roomCamera(unit*height,height,aspect).pose)];
  for(const from of poses)for(const to of poses){
   assert.deepEqual(travelRoomPose(from,to,0),from);assert.deepEqual(travelRoomPose(from,to,1),to);
   let previous=from.position;
   // The new 13 m corridor doubles the longest route. Sampling twice as
   // densely keeps the same 15 cm continuity check and covers its doorway.
   for(let sample=0;sample<=600;sample++){
    const progress=sample/600,pose=travelRoomPose(from,to,progress),p=pose.position;
    assert.ok(p[0]>-7.2&&p[0]<4.2&&p[2]>-12.1&&p[2]<=19.31&&p[1]>=1.2&&p[1]<=2.16,'Камера остаётся внутри палаты или существующего коридора');
    if(p[2]<-7.3)assert.ok(p[0]<1.55,'Служебный отсек и кинопроекционная соединены проёмом');
    if(p[0]>-1.85&&p[0]<-1.55&&p[2]<-7.3)assert.ok(p[2]>=-10.01&&p[2]<=-8.69,'Камера входит в кинопроекционную через боковой проём');
    if(p[2]>=-7.3&&p[2]<=-6.7)assert.ok(Math.abs(p[0])<.6,'Переход к футеру идёт через заднюю дверь');
    if(p[2]>7.3)assert.ok(Math.abs(p[0])<1.4,'Камера не проходит через боковые стены коридора');
    if(p[2]>=6.7&&p[2]<=7.3)assert.ok(Math.abs(p[0])<.6,'Любой переход проходит через открытый дверной проём');
    for(const station of roomStations.filter(s=>!s.kind))assert.equal(insideCabinet(p,station),false,`${width}×${height}: камера пересекла корпус ${station.id}`);
    assert.ok(Math.hypot(...p.map((value,axis)=>value-previous[axis]))<.15,'В обходном пути нет скачков');previous=p;
    if(sample%30===0){const reverse=travelRoomPose(to,from,1-progress);for(let axis=0;axis<3;axis++)assert.ok(Math.abs(reverse.position[axis]-p[axis])<1e-8,'Обход корпуса обратим');}
   }
  }
 }
});

test('Читаемые ракурсы смотрят фронтально на реальные экраны, а CSS-гомография точно совпадает с четырьмя углами стекла',()=>{
 assert.equal(roomStations.filter(station=>station.group==='quests').length,4);
 assert.equal(new Set(roomStations.map(station=>station.id)).size,10);
 for(const [width,height] of sizes)for(const station of roomStations.filter(s=>s.kind!=='projector')){
  const pose=roomFocusPose(station.id,width/height),quad=screenQuad(station,pose,width,height);
  assert.deepEqual(pose.target,station.id==='team'?[station.center[0],1.85,station.center[2]]:station.center);
  assert.equal(pose.position[1],station.id==='team'?1.85:station.center[1]);
  const normal=new Vector3(Math.sin(station.rotationY||0),0,Math.cos(station.rotationY||0));
  const offset=new Vector3(...pose.position).sub(new Vector3(...pose.target));
  assert.ok(offset.dot(normal)>0);assert.ok(offset.clone().cross(normal).length()<1e-8);
  assert.ok(Math.abs(quad[0].y-quad[1].y)<1e-7);assert.ok(Math.abs(quad[3].y-quad[2].y)<1e-7);
  assert.ok(Math.abs(quad[0].x-quad[3].x)<1e-7);assert.ok(Math.abs(quad[1].x-quad[2].x)<1e-7);
  for(const point of quad){assert.ok(point.x>0&&point.x<width);assert.ok(point.y>0&&point.y<height);}
  const css=projectionCSS(quad,1024,737);
  [[0,0],[1024,0],[1024,737],[0,737]].forEach(([x,y],index)=>{
   const actual=matrixPoint(css,x,y);assert.ok(Math.abs(actual.x-quad[index].x)<1e-7);assert.ok(Math.abs(actual.y-quad[index].y)<1e-7);
  });
  for(let row=0;row<=4;row++)for(let column=0;column<=4;column++){
   const point=matrixPoint(css,column*256,row*737/4);assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));
  }
 }
});

test('Маршрут содержит одну комнату и полный набор физически привязанных интерфейсов без старого коридора',()=>{
 const x=setupDOM('iznanka',{adult:true});try{
  const root=x.d.querySelector('div[data-room-experience]');assert.ok(root);
  assert.equal(x.d.querySelectorAll('[data-room-canvas]').length,1);
  assert.equal(root.querySelectorAll('[data-room-surface]').length,8);
  assert.equal(root.querySelectorAll('[data-room-quest]').length,4);
  assert.equal(root.querySelectorAll('[data-room-photo]').length,8);
  assert.equal(root.querySelectorAll('[data-game="maze"]').length,1);
  assert.equal(root.querySelectorAll('[data-team-picker]').length,1);
  assert.ok(root.querySelector('[data-room-surface=team] [data-team-picker]'),'Подбор команды находится на табличке у койки');
  assert.equal(root.querySelector('[data-room-surface=info] [data-team-picker]'),null);
  assert.equal(x.d.querySelector('.horror-film,[data-horror-door],[data-passage-film],[data-investigation]'),null);
  assert.equal(root.querySelector('.site-footer,.trial-section,.horror-photos,.horror-afterword'),null);
  assert.ok(root.querySelector('header.room-site-header nav'));assert.ok(root.querySelector('footer[data-room-surface=info]'));
  const links=[...x.d.querySelectorAll('a[href^="#"]')];
  for(const link of links.filter(link=>link.hash.length>1))assert.ok(x.d.getElementById(link.hash.slice(1)),link.hash);
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
 for(const world of ['arhiv','ostrov']){const other=setupDOM(world);try{assert.equal(other.d.querySelector('[data-room-experience]'),null);assert.ok(other.d.querySelector('.site-footer'));assert.deepEqual(other.errors,[]);}finally{other.close()}}
});

test('Без WebGL контент и прямые ссылки доступны, возраст и настройки продолжают работать',()=>{
 const x=setupDOM('iznanka',{adult:true});try{
  const root=x.d.querySelector('div[data-room-experience]');x.intersect(root,true);assert.equal(root.dataset.roomMode,'fallback');
  assert.equal(root.querySelectorAll('[data-room-quest]').length,4);
  for(const surface of root.querySelectorAll('[data-room-quest]')){
   const links=[...surface.querySelectorAll('a[href]')];
   assert.ok(links.some(link=>link.href.includes('/book/')));assert.ok(links.some(link=>link.href.includes('/quests/')));
  }
  x.d.querySelector('.settings-toggle').click();assert.equal(x.d.querySelector('#preferences').open,true);
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
 const html=fs.readFileSync('dist/iznanka/index.html','utf8');
 assert.match(html,/id="age-gate"/);assert.match(html,/class="restricted"/);
});

test('Геометрия GLB и точки интерактивных поверхностей совпадают в метрах, а экраны имеют собственные сетки',()=>{
 const binary=fs.readFileSync('public/models/last-round-ward-v1.glb');
 const gltf=JSON.parse(binary.toString('utf8',20,20+binary.readUInt32LE(12)));
 const meshes=new Set();
 for(const station of roomStations.filter(s=>!s.kind)){
  const node=gltf.nodes.find(item=>item.name==='RoomScreen_'+station.id);assert.ok(node,station.id);meshes.add(node.mesh);
  for(let axis=0;axis<3;axis++)assert.ok(Math.abs(node.translation[axis]-station.center[axis])<1e-5,station.id+' положение');
  const primitive=gltf.meshes[node.mesh].primitives[0],position=gltf.accessors[primitive.attributes.POSITION];
  assert.ok(Math.abs(position.max[0]-position.min[0]-station.width)<1e-5,station.id+' ширина');
  assert.ok(Math.abs(position.max[1]-position.min[1]-station.height)<1e-5,station.id+' высота');
  assert.ok(position.max[2]-position.min[2]>.005,'Стекло имеет кривизну');
  assert.equal(node.extras.front_axis,'+Z');
 }
 assert.equal(meshes.size,4,'Интерактивные экраны не объединены в одну неподвижную поверхность');
 for(const name of ['RoomCurtain_privacy','RoomHangingCable_0','RoomFluorescent_ward',...Array.from({length:3},(_,i)=>'RoomFluorescent_corridor_'+i)]){
  const node=gltf.nodes.find(item=>item.name===name);assert.ok(node&&Number.isInteger(node.mesh),name+' остаётся отдельной анимируемой сеткой');
 }
 assert.ok(binary.length<8*1024*1024,'Коридор и палата не превышают бюджет модели');
});


async function controllerHarness({adult=true,webgl=true,reduced=false,reject=false,hash='',width=1280,height=800,stageHeight=height,random=.5,textures=false,delayed=false,liveMotion=false,camera=true}={}){
 const dom=new JSDOM(`<html class="${adult?'adult':''}"><body data-world="iznanka"><div data-room-experience data-room-model="/models/room.glb"><div data-room-stage><canvas data-room-canvas></canvas><button data-room-camera-power>Камера</button><nav data-room-broadcast-for="quest_0" hidden><button data-room-broadcast-details>Описание</button></nav><details class="room-directory" open>${roomStages.map(stage=>`<a href="#${stage.hash}" data-room-go="${stage.id}">${stage.label}</a>`).join('')}</details><div data-room-tv-content>${roomStations.map(station=>`<section data-room-surface="${station.id}" tabindex="-1"><button data-room-leave>Отойти</button></section><button data-room-open="${station.id}">${station.label}</button>`).join('')}</div><button data-room-fallback>Без 3D</button><script type="application/json" data-room-programs>[]</script></div></div></body></html>`,{url:'https://example.test/iznanka/'+hash,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document;let y=0,hidden=false,now=1000,nextFrame=0,nextTimer=0;const frames=new Map(),timers=new Map(),observers=[];
 Object.defineProperty(w,'scrollY',{get:()=>y});Object.defineProperty(w,'innerWidth',{value:width,writable:true});Object.defineProperty(w,'innerHeight',{value:height,writable:true});Object.defineProperty(d,'hidden',{get:()=>hidden});w.performance.now=()=>now;w.Math.random=()=>random;
 Object.defineProperty(d.querySelector('[data-room-canvas]'),'clientHeight',{value:stageHeight});
 Object.defineProperty(d.querySelector('[data-room-canvas]'),'clientWidth',{value:width});
 const media={matches:reduced,addEventListener(){},removeEventListener(){}};w.matchMedia=()=>media;
 w.requestAnimationFrame=callback=>{frames.set(++nextFrame,callback);return nextFrame;};w.cancelAnimationFrame=id=>frames.delete(id);
 w.setTimeout=(callback,delay)=>{timers.set(++nextTimer,{callback,delay,at:now+delay});return nextTimer;};w.clearTimeout=id=>timers.delete(id);
 w.IntersectionObserver=class{constructor(callback){this.callback=callback;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}};w.ResizeObserver=class{observe(){}disconnect(){}};
 const Native=w.MutationObserver;w.MutationObserver=class extends Native{constructor(callback){super((...args)=>{if(w.document)callback(...args);});}};
 w.HTMLElement.prototype.getBoundingClientRect=function(){return{left:0,top:-y,width,height:height*15,bottom:height*15-y,right:width};};
 w.scrollTo=({top})=>{y=top;w.dispatchEvent(new w.Event('scroll'));};
 w.HTMLElement.prototype.scrollIntoView=function(options){w.__scrolledInto=this;w.__scrollOptions=options;};
 w.HTMLCanvasElement.prototype.getContext=()=>({});w.__liveMotion=liveMotion;w.__textures=textures;w.__delayed=delayed;w.__creates=0;w.__draws=0;w.__disposed=0;w.__reject=reject;w.__poses=[];w.__states=[];w.__sounds=[];
 d.addEventListener('room:ambience',event=>w.__sounds.push(event.detail));
 if(webgl)w.WebGL2RenderingContext=function(){};
 const code=(await build({entryPoints:['src/scripts/room-experience.ts'],bundle:true,format:'iife',globalName:'roomModule',write:false,plugins:[{name:'fake-room-webgl',setup(builder){
  builder.onResolve({filter:/room-renderer$/},()=>({path:'room',namespace:'fake-renderer'}));
  builder.onLoad({filter:/.*/,namespace:'fake-renderer'},()=>({contents:`export async function createRoomRenderer(canvas,url,options){window.__creates++;window.__invalidate=options.invalidate;if(window.__reject)throw new Error('Model unavailable');if(window.__delayed)await new Promise(resolve=>window.__finishLoad=resolve);return{liveMotion:window.__liveMotion,...(window.__textures?{updateSurface(){}}:{}),render(pose,state){window.__draws++;window.__poses.push(pose);window.__states.push(state);return Object.fromEntries(['door','team','window','projector','gallery','game','quest_0','quest_1','quest_2','quest_3','info'].map(id=>[id,{visible:true,quad:[{x:100,y:100},{x:1100,y:100},{x:1100,y:750},{x:100,y:750}]}]));},dispose(){window.__disposed++;}};}` }));
 }}]})).outputFiles[0].text;
 w.eval(code+';window.roomAPI=roomModule.initRoomExperience();');
 const root=d.querySelector('div[data-room-experience]');
 return{w,d,root,frames,timers,async visible(value=true){observers[0].callback([{target:root,isIntersecting:value}]);await Promise.resolve();await Promise.resolve();await Promise.resolve();if(camera&&value&&d.documentElement.classList.contains('adult')&&root.dataset.roomCamera!=='true')root.querySelector('[data-room-camera-power]').click();},
  flush(ms=16){now+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(now));},settle(){for(let i=0;i<200&&frames.size;i++)this.flush(16);assert.equal(frames.size,0);},
  advance(ms){const end=now+ms;let iterations=0;for(;;){const next=[...timers.entries()].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;assert.ok(++iterations<2000,'Таймеры не создают бесконечный цикл');now=Math.max(now,next[1].at);timers.delete(next[0]);next[1].callback();}now=end;},
  nextTimer(){const next=[...timers.values()].sort((a,b)=>a.at-b.at)[0];assert.ok(next,'Ожидается отложенное событие атмосферы');this.advance(Math.max(0,next.at-now));return next;},
  scroll(top){y=top;w.dispatchEvent(new w.Event('scroll'));},hide(value){hidden=value;d.dispatchEvent(new w.Event('visibilitychange'));},
  async preference(value){d.documentElement.classList.toggle('calm',value);await Promise.resolve();await Promise.resolve();},
  close(){w.roomAPI?.destroy();dom.window.close();}};
}

test('3D lifecycle: загрузка только после возраста и видимости, неподвижная камера не рисует, изменения текстуры запрашивают один кадр',async()=>{
 const x=await controllerHarness({adult:false});try{
  await x.visible();assert.equal(x.w.__creates,0);assert.equal(x.frames.size,0);
  x.d.documentElement.classList.add('adult');await Promise.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();
  assert.equal(x.w.__creates,1);x.settle();assert.equal(x.root.dataset.roomMode,'3d');
  const initial=x.w.__draws;assert.ok(initial>=1);x.flush(2000);assert.equal(x.w.__draws,initial);assert.equal(x.frames.size,0);
  x.w.__invalidate();x.settle();assert.equal(x.w.__draws,initial+1,'Новая текстура отображается без необходимости двигать мышь или скроллить');
  x.scroll(600);x.flush();assert.equal(x.frames.size,1);x.settle();assert.ok(x.w.__draws>initial+1);
  const idle=x.w.__draws;x.flush(5000);assert.equal(x.w.__draws,idle);assert.equal(x.frames.size,0);
  assert.ok([...x.timers.values()].every(timer=>timer.delay>=150),'Атмосфера не создаёт быстрый бесконечный RAF');
 }finally{x.close()}
});

test('Атмосфера оживляет один светильник без движения камеры и заканчивает короткий пакет кадров до следующей паузы',async()=>{
 for(const width of [1280,390]){
  const x=await controllerHarness({width});try{
   await x.visible();x.settle();
   const pose=x.w.__poses.at(-1),draws=x.w.__draws;
   assert.equal(x.frames.size,0);assert.equal(x.timers.size,1);
   const waiting=x.nextTimer();assert.ok(waiting.delay>=1100&&waiting.delay<=1900);
   assert.equal(x.root.dataset.roomDisturbance,'light');
   assert.equal(x.w.__sounds.filter(event=>event.kind==='light').length,1,'Электрический треск запускается один раз за событие');
   assert.equal([...x.timers.values()][0].delay,width<=760?67:42,'Кадры атмосферы ограничены отдельно для телефона');
   assert.equal(x.frames.size,0,'Атмосфера не включает постоянный requestAnimationFrame');
   x.advance(300);
   const lightFrames=x.w.__states.slice(draws).map(state=>state.atmosphere).filter(Boolean);
   assert.ok(lightFrames.some(frame=>frame.lamp<.8),'Неисправность действительно изменяет яркость, пока пользователь не прокручивает страницу');
   assert.ok(lightFrames.every(frame=>frame.fixture===3),'В коридоре реагирует ближайшая физическая лампа');
   for(const actual of x.w.__poses.slice(draws))assert.deepEqual(actual,pose,'Освещение не двигает камеру и не срывает ракурс');
   x.advance(1900);
   assert.equal(x.w.__states.at(-1).atmosphere,undefined,'Закончившееся событие возвращает освещение и предметы в покой');
   const count=x.w.__draws-draws;assert.ok(count>15&&count<=(width<=760?32:50),'Пакет имеет конечный бюджет кадров');
   assert.equal(x.frames.size,0);assert.equal(x.timers.size,1);
   const next=[...x.timers.values()][0];assert.ok(next.delay>=3400&&next.delay<=9400,'Следующее событие начинается после спокойного промежутка');
   const resting=x.w.__draws;x.advance(1000);assert.equal(x.w.__draws,resting,'В паузе WebGL не перерисовывается');
  }finally{x.close()}
 }
});

test('Начатый атмосферный эффект прекращается вне экрана, в скрытой вкладке, на pagehide и при уменьшении движения',async()=>{
 const scenarios=[
  {stop:x=>x.visible(false),resume:x=>x.visible(true)},
  {stop:x=>x.hide(true),resume:x=>x.hide(false)},
  {stop:x=>x.w.dispatchEvent(new x.w.Event('pagehide')),resume:x=>x.w.dispatchEvent(new x.w.Event('pageshow'))},
  {stop:x=>x.preference(true),resume:x=>x.preference(false)},
 ];
 for(const scenario of scenarios){
  const x=await controllerHarness();try{
   await x.visible();x.settle();x.nextTimer();x.advance(250);
   assert.ok(x.w.__states.some(state=>state.atmosphere?.lamp<.8));
   assert.ok([...x.timers.values()].some(timer=>timer.delay===42));
   await scenario.stop(x);x.settle();
   assert.equal(x.frames.size,0);assert.equal(x.timers.size,0,'Остановлены и быстрый таймер эффекта, и ожидание следующего события');
   const draws=x.w.__draws,sounds=x.w.__sounds.length;x.advance(20000);
   assert.equal(x.w.__draws,draws);assert.equal(x.w.__sounds.length,sounds,'Во время остановки не появляются новые звуки');
   await scenario.resume(x);x.settle();
   assert.equal(x.w.__states.at(-1).atmosphere,undefined,'Возврат к странице начинается с обычного света');
   assert.equal(x.frames.size,0);assert.equal(x.timers.size,1);
   assert.ok([...x.timers.values()].every(timer=>timer.delay>=3400),'Прерванный эффект не возобновляется частыми кадрами');
  }finally{x.close()}
 }
});

test('Кинопроектор рисует не чаще 14 кадров/с только на активном экране, выключение и выход останавливают катушки',async()=>{
 for(const width of [1280,390]){
  const x=await controllerHarness({width});try{
   const power=on=>x.d.dispatchEvent(new x.w.CustomEvent('room:projector-power',{detail:{on}}));
   const projectorTimers=()=>[...x.timers.values()].filter(timer=>timer.delay===71);
   await x.visible();x.settle();power(true);x.settle();
   assert.equal(projectorTimers().length,0,'Включённый аппарат за пределами активной сцены не создаёт цикл кадров');
   x.scroll(roomStages.find(stage=>stage.id==='gallery').anchor*800);x.settle();
   assert.equal(projectorTimers().length,1);assert.equal(x.frames.size,0,'Катушки не запускают непрерывный requestAnimationFrame');
   x.advance(0); // Flush a timer that became due while the harness settled RAF travel.
   const pose=x.w.__poses.at(-1),start=x.w.__states.at(-1).projectorTime;
   x.advance(70);assert.equal(x.w.__states.at(-1).projectorTime,start);
   x.advance(1);assert.equal(x.w.__states.at(-1).projectorTime,start+71);assert.deepEqual(x.w.__poses.at(-1),pose);
   x.advance(71*3);assert.equal(x.w.__states.at(-1).projectorTime,start+71*4);
   assert.equal(projectorTimers().length,1,'Даже при совпадении атмосферных событий создаётся только один таймер катушек');
   power(false);x.settle();assert.equal(projectorTimers().length,0);
   const stopped=x.w.__states.at(-1).projectorTime;x.advance(500);assert.equal(x.w.__states.at(-1).projectorTime,stopped);
   power(true);x.settle();assert.equal(projectorTimers().length,1);
   x.scroll(roomStages.find(stage=>stage.id==='quests').anchor*800);x.settle();assert.equal(projectorTimers().length,0);
   const left=x.w.__states.at(-1).projectorTime;x.advance(500);assert.equal(x.w.__states.at(-1).projectorTime,left);
  }finally{x.close()}
 }
});

test('Кинопроектор останавливается вне viewport, в скрытой вкладке, на pagehide, в спокойном режиме и при потере WebGL',async()=>{
 const scenarios=[
  {stop:x=>x.visible(false),resume:x=>x.visible(true)},
  {stop:x=>x.hide(true),resume:x=>x.hide(false)},
  {stop:x=>x.w.dispatchEvent(new x.w.Event('pagehide')),resume:x=>x.w.dispatchEvent(new x.w.Event('pageshow'))},
  {stop:x=>x.preference(true),resume:x=>x.preference(false)},
  {stop:x=>x.root.querySelector('canvas').dispatchEvent(new x.w.Event('webglcontextlost',{cancelable:true}))},
  {stop:x=>x.w.roomAPI.destroy()}
 ];
 for(const scenario of scenarios){
  const x=await controllerHarness();try{
   await x.visible();x.settle();x.scroll(roomStages.find(stage=>stage.id==='gallery').anchor*800);x.settle();
   x.d.dispatchEvent(new x.w.CustomEvent('room:projector-power',{detail:{on:true}}));x.settle();x.advance(71);
   assert.ok([...x.timers.values()].some(timer=>timer.delay===71));
   await scenario.stop(x);x.settle();assert.equal(x.frames.size,0);assert.equal(x.timers.size,0);
   const draws=x.w.__draws;x.advance(10000);assert.equal(x.w.__draws,draws,'Остановленные катушки не расходуют кадры в фоне');
   if(scenario.resume){
    await scenario.resume(x);x.settle();assert.equal([...x.timers.values()].filter(timer=>timer.delay===71).length,1);
    assert.equal(x.w.__states.at(-1).projectorOn,true,'Возвращение сохраняет состояние выключателя');
   }
  }finally{x.close()}
 }
});

test('Телевизор с лабиринтом останавливает атмосферные эффекты и возвращает их после выхода из игры',async()=>{
 const x=await controllerHarness();try{
  await x.visible();x.settle();x.nextTimer();x.advance(250);
  x.root.querySelector('[data-room-open="game"]').click();x.settle();
  assert.equal(x.root.querySelector('[data-room-surface="game"]').hidden,false);
  assert.equal(x.w.__states.at(-1).atmosphere,undefined);
  assert.equal(x.frames.size,0);assert.equal(x.timers.size,0,'Игра не конкурирует с таймерами освещения');
  const draws=x.w.__draws,sounds=x.w.__sounds.length;x.advance(30000);
  assert.equal(x.w.__draws,draws);assert.equal(x.w.__sounds.length,sounds);
  x.d.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));x.settle();
  assert.equal(x.root.querySelector('[data-room-surface="game"]').hidden,true);
  assert.equal(x.timers.size,1);assert.ok([...x.timers.values()][0].delay>=3400);
  x.nextTimer();assert.notEqual(x.root.dataset.roomDisturbance,'light','Соседние события отличаются, а не повторяют один эффект по кругу');
  assert.equal(x.frames.size,0);
 }finally{x.close()}
});

test('3D lifecycle: offscreen, hidden-tab, pagehide останавливают кадры, спокойный режим фиксирует ракурсы без фоновых циклов',async()=>{
 const x=await controllerHarness();try{
  await x.visible();x.settle();x.scroll(500);x.flush();assert.equal(x.frames.size,1);
  await x.visible(false);assert.equal(x.frames.size,0);assert.equal(x.timers.size,0);
  const stopped=x.w.__draws;x.flush(4000);assert.equal(x.w.__draws,stopped);
  await x.visible();x.hide(true);assert.equal(x.frames.size,0);assert.equal(x.timers.size,0);
  x.hide(false);x.settle();x.w.dispatchEvent(new x.w.Event('pagehide'));assert.equal(x.frames.size,0);assert.equal(x.timers.size,0);
  x.w.dispatchEvent(new x.w.Event('pageshow'));x.settle();await x.preference(true);x.settle();assert.equal(x.root.dataset.roomReduced,'true');assert.equal(x.timers.size,0);
  x.scroll(roomStages.find(stage=>stage.id==='gallery').anchor*800);x.flush();assert.equal(x.frames.size,0);
  assert.equal(x.root.querySelector('[data-room-surface="gallery"]').hidden,false);
  assert.equal(x.root.querySelector('[data-room-surface="game"]').hidden,true);
  assert.equal(x.root.querySelector('[data-room-surface="game"]').inert,true);
  const draws=x.w.__draws;x.flush(5000);assert.equal(x.w.__draws,draws);
 }finally{x.close()}
});

test('3D lifecycle: сбой модели и потеря WebGL возвращают рабочий HTML, destroy освобождает renderer и слушатели',async()=>{
 for(const reject of [true,false]){
  const x=await controllerHarness({reject});try{
   await x.visible();x.settle();
   if(!reject)x.root.querySelector('canvas').dispatchEvent(new x.w.Event('webglcontextlost',{cancelable:true}));
   assert.equal(x.root.dataset.roomMode,'fallback');assert.equal(x.frames.size,0);assert.equal(x.timers.size,0);
   for(const surface of x.root.querySelectorAll('[data-room-surface]')){assert.equal(surface.hidden,false);assert.equal(surface.inert,false);}
   assert.ok([...x.root.querySelectorAll('[data-room-open]')].every(button=>button.hidden));
   const count=x.w.__draws;x.w.roomAPI.destroy();x.scroll(2000);x.flush();assert.equal(x.w.__draws,count);assert.equal(x.frames.size,0);
  }finally{x.close()}
 }
});

test('Выбор ТВ приближает камеру и переводит фокус внутрь, Escape возвращает к экрану без невидимых hit-зон',async()=>{
 const x=await controllerHarness();try{
  await x.visible();x.settle();
  const button=x.root.querySelector('[data-room-open="quest_2"]');button.focus();button.click();
  x.flush();assert.equal(x.root.querySelector('[data-room-surface="quest_2"]').hidden,true,'Во время движения интерфейс ещё не плавает поверх комнаты');
  x.settle();
  const surface=x.root.querySelector('[data-room-surface="quest_2"]');assert.equal(surface.hidden,false);assert.equal(x.d.activeElement,surface);
  assert.ok([...x.root.querySelectorAll('[data-room-open]')].every(hit=>hit.hidden),'Дальние экраны не перехватывают клики сквозь активный ТВ');
  const expected=roomFocusPose('quest_2',1280/800),actual=x.w.__poses.at(-1);for(let axis=0;axis<3;axis++){assert.ok(Math.abs(actual.position[axis]-expected.position[axis])<1e-8);assert.ok(Math.abs(actual.target[axis]-expected.target[axis])<1e-8);}
  x.d.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));x.settle();
  assert.equal(surface.hidden,true);assert.equal(button.hidden,false);assert.equal(x.d.activeElement,button);
  assert.equal(x.d.documentElement.style.overflow,'','Выход из ТВ не оставляет блокировку прокрутки');
 }finally{x.close()}
});

test('Escape из настроек не закрывает активный ТВ, даже если dialog уже закрылся до всплытия события',async()=>{
 const x=await controllerHarness();try{
  await x.visible();x.settle();
  x.root.querySelector('[data-room-open="quest_2"]').click();x.settle();
  const surface=x.root.querySelector('[data-room-surface="quest_2"]');
  const dialog=x.d.createElement('dialog'),close=x.d.createElement('button');
  dialog.id='preferences';close.textContent='Закрыть настройки';dialog.append(close);x.d.body.append(dialog);
  const escape=()=>new x.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});

  dialog.setAttribute('open','');close.focus();close.dispatchEvent(escape());x.settle();
  assert.equal(surface.hidden,false,'Escape в открытых настройках оставляет квест на экране');
  assert.equal(x.frames.size,0,'Открытые настройки не запускают обратный полёт камеры');

  // Native dialog handling can remove `open` before the event reaches the
  // document listener. Its original target still belongs to the dialog.
  close.addEventListener('keydown',()=>dialog.removeAttribute('open'),{once:true});
  close.dispatchEvent(escape());x.settle();
  assert.equal(dialog.open,false,'Диалог уже закрыт к моменту всплытия');
  assert.equal(surface.hidden,false,'Закрытие настроек не должно заодно закрывать находящийся под ними телевизор');
  assert.equal(x.frames.size,0);

  surface.focus();surface.dispatchEvent(escape());x.settle();
  assert.equal(surface.hidden,true,'Отдельное нажатие Escape вне диалога по-прежнему возвращает в комнату');
  assert.equal(x.d.activeElement,x.root.querySelector('[data-room-open="quest_2"]'));
 }finally{x.close()}
});

test('Переход из открытого ТВ в HTML сохраняет все поверхности, Escape и навигация не возвращают 3D-координаты',async()=>{
 const x=await controllerHarness();try{
  await x.visible();x.settle();x.root.querySelector('[data-room-open="quest_2"]').click();x.settle();
  assert.equal(x.root.querySelector('[data-room-surface="quest_2"]').hidden,false);
  x.root.querySelector('[data-room-fallback]').click();assert.equal(x.w.__disposed,1);
  const assertReadable=()=>{for(const surface of x.root.querySelectorAll('[data-room-surface]')){assert.equal(surface.hidden,false);assert.equal(surface.inert,false);assert.equal(surface.getAttribute('aria-hidden'),null);}};
  assertReadable();
  x.d.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assertReadable();
  x.d.dispatchEvent(new x.w.CustomEvent('room:leave'));assertReadable();
  for(const [id,surfaceId] of [['frames','gallery'],['trial','game'],['quests','quest_0'],['team','team'],['journal','info']]){
   const surface=x.root.querySelector(`[data-room-surface="${surfaceId}"]`);
   x.d.dispatchEvent(new x.w.CustomEvent('room:navigate',{detail:{id}}));
   assert.equal(x.w.__scrolledInto,surface);assert.equal(x.d.activeElement,surface);assertReadable();
  }
  for(const stage of roomStages){
   const link=x.root.querySelector(`[data-room-go="${stage.id}"]`),event=new x.w.MouseEvent('click',{bubbles:true,cancelable:true});link.dispatchEvent(event);
   assert.equal(event.defaultPrevented,true,'В HTML меню использует реальный объект контента вместо прежнего якоря 3D');
   const target=stage.id==='entry'?x.root:x.root.querySelector(`[data-room-surface="${stage.surface||(stage.id==='quests'||stage.id==='ward'?'quest_0':'info')}"]`);
   assert.equal(x.w.__scrolledInto,target);assertReadable();
  }
  x.root.querySelector('[data-room-fallback]').click();assert.equal(x.w.__disposed,1,'Повторное включение HTML не освобождает контекст дважды');
  assert.equal(x.frames.size,0);assert.equal(x.timers.size,0);
 }finally{x.close()}
 const direct=await controllerHarness({webgl:false,hash:'#trial'});try{
  await direct.visible();assert.equal(direct.root.dataset.roomMode,'fallback');
  assert.equal(direct.w.__scrolledInto,direct.root.querySelector('[data-room-surface="game"]'),'Прямая ссылка работает и при отсутствии WebGL');
 }finally{direct.close()}
});


test('Внешние и встроенные настройки комнаты синхронизируются и работают с каждого пульта',()=>{
 const x=setupDOM('iznanka',{adult:true});try{
  const settings=[...x.d.querySelectorAll('.settings-toggle')],motion=[...x.d.querySelectorAll('.motion-toggle')];
  assert.ok(settings.length>=2);assert.ok(motion.length>=2);
  for(const button of settings){button.click();assert.equal(x.d.querySelector('#preferences').open,true);x.d.querySelector('#preferences').close();}
  for(const button of motion){
   const before=x.d.documentElement.classList.contains('calm');button.click();const after=x.d.documentElement.classList.contains('calm');assert.notEqual(after,before);
   for(const other of motion)assert.equal(other.getAttribute('aria-pressed'),String(after));
  }
  const volume=x.d.querySelector('#sound-volume');volume.value='0';volume.dispatchEvent(new x.w.Event('input'));
  for(const button of x.d.querySelectorAll('.sound-toggle')){assert.equal(button.getAttribute('aria-pressed'),'false');assert.equal(button.dataset.audioVolume,'0');}
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});

test('Галерея и кадры квестов загружаются после согласия и включения нужного физического экрана',async()=>{
 const x=setupDOM('iznanka');try{
  const content=x.d.querySelector('[data-room-tv-content]'),images=[...content.querySelectorAll('img[data-room-src]')];
  assert.equal(images.length,16);assert.ok(images.every(image=>!image.getAttribute('src')));
  x.d.dispatchEvent(new x.w.CustomEvent('room:surface-active',{detail:{id:'gallery'}}));
  assert.ok(images.every(image=>!image.getAttribute('src')),'Событие открытия не обходит возраст');
  const form=x.d.querySelector('#age-form');form.elements.adult.checked=true;form.dispatchEvent(new x.w.Event('submit',{cancelable:true}));await Promise.resolve();await Promise.resolve();
  assert.equal(images.filter(image=>image.getAttribute('src')).length,1,'До видимости комнаты грузится только уже выбранный кадр');
  const quest=content.querySelector('[data-room-quest="palata-06"]');quest.querySelector('[data-room-tab="frames"]').click();
  assert.equal(quest.querySelectorAll('img[src]').length,0,'Скрытый квест не загружает галерею');
  x.d.dispatchEvent(new x.w.CustomEvent('room:surface-active',{detail:{id:'quest_0'}}));
  assert.equal(quest.querySelectorAll('img[src]').length,2);
  assert.equal(images.filter(image=>image.getAttribute('src')).length,3);
  assert.equal(x.d.querySelector('[data-scare-video]').getAttribute('src'),null);
  assert.deepEqual(x.errors,[]);
 }finally{x.close()}
});


test('Остановка у койки предшествует телевизорам, табличка смотрит в палату и безопасно закрывается',async()=>{
 const station=roomStations.find(s=>s.id==='team');assert.equal(station.kind,'wall');
 assert.ok(roomStages.find(s=>s.id==='team').anchor<roomStages.find(s=>s.id==='gallery').anchor);
 for(const [width,height] of sizes){const pose=roomFocusPose('team',width/height);assert.ok(pose.position[0]<2.7,'Камера стоит перед койкой, а не внутри матраса');assert.ok(pose.target[0]>4.3);}
 const x=await controllerHarness();try{
  await x.visible();x.settle();x.scroll(roomStages.find(s=>s.id==='team').anchor*800);x.settle();
  const board=x.root.querySelector('[data-room-surface=team]');assert.equal(board.hidden,false);
  x.d.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));x.settle();assert.equal(board.hidden,true);
  assert.deepEqual(JSON.parse(JSON.stringify(x.w.__poses.at(-1))),roomOverviewPose(1280/800));
  x.root.querySelector('[data-room-open=team]').click();x.settle();assert.equal(board.hidden,false);assert.equal(x.d.activeElement,board);
 }finally{x.close()}
});


test('Дверь ведёт к стойке дежурного; окна нет, игра находится на ноутбуке, галерея в кинопроекционной',async()=>{
 assert.deepEqual(roomStations.filter(s=>!s.kind).map(s=>s.id),['quest_0','quest_1','quest_2','quest_3']);
 for(const station of roomStations.filter(s=>!s.kind))assert.ok(station.center[1]-station.height/2>1.32,'Койки и перила не закрывают квест при чтении');
 assert.equal(roomStations.some(s=>s.id==='window'),false,'Окно и его интерактивная плоскость удалены');
 assert.equal(roomStations.find(s=>s.id==='game').kind,'laptop');
 assert.equal(roomStations.find(s=>s.id==='gallery').kind,'projection');
 assert.notDeepEqual(roomStations.find(s=>s.id==='gallery').center,roomStations.find(s=>s.id==='game').center);
 const info=roomFocusPose('info',1.6);assert.ok(info.position[2]<-7.4&&info.position[2]>-11.6);
 const x=await controllerHarness();try{await x.visible();x.settle();x.root.querySelector('[data-room-open=door]').click();x.scroll(roomStages.find(s=>s.id==='info').anchor*800);x.settle();assert.equal(x.root.querySelector('[data-room-surface=info]').hidden,false);}finally{x.close()}
});


test('Прямая ссылка и прокрутка во время загрузки GLB сохраняют активный слой после подготовки текстур',async()=>{
 for(const id of ['game','info','team']){
  const x=await controllerHarness({textures:true,delayed:true});try{
   await x.visible();x.scroll(roomStages.find(s=>s.surface===id).anchor*800);x.settle();
   const surface=x.root.querySelector(`[data-room-surface="${id}"]`);assert.equal(surface.hidden,false,'Чтение выбрано до завершения загрузки');
   x.w.__finishLoad();for(let i=0;i<5;i++)await Promise.resolve();x.settle();
   assert.equal(x.root.dataset.roomMode,'3d');assert.equal(x.root.dataset.roomTextures,'true');assert.equal(surface.hidden,false,'Подготовка текстур не скрыла выбранное управление');assert.equal(surface.inert,false);assert.equal(surface.getAttribute('aria-hidden'),'false');
  }finally{x.close()}
 }
});

test('Оригинал галереи приостанавливает WebGL и эффекты; закрытие возвращает ту же сцену',async()=>{
 const x=await controllerHarness();try{
  await x.visible();x.scroll(roomStages.find(s=>s.id==='gallery').anchor*800);x.settle();
  x.d.dispatchEvent(new x.w.CustomEvent('room:projector-power',{detail:{on:true}}));x.settle();
  const pose=x.w.__poses.at(-1);
  x.d.dispatchEvent(new x.w.CustomEvent('room:original-viewer',{detail:{open:true}}));
  assert.equal(x.frames.size,0);assert.equal(x.timers.size,0);
  const draws=x.w.__draws;x.advance(20000);assert.equal(x.w.__draws,draws);
  x.d.dispatchEvent(new x.w.CustomEvent('room:original-viewer',{detail:{open:false}}));x.settle();
  assert.deepEqual(x.w.__poses.at(-1),pose);assert.ok([...x.timers.values()].some(timer=>timer.delay===71));
 }finally{x.close()}
});

test('Живые руки и призраки используют максимум 12 кадров/с и останавливаются за пределами своих зон',async()=>{
 const x=await controllerHarness({liveMotion:true});try{
  await x.visible();x.settle();const live=()=>[...x.timers.values()].filter(timer=>timer.delay===83);
  assert.equal(live().length,1);assert.equal(x.frames.size,0);
  const pose=x.w.__poses.at(-1),draws=x.w.__draws;x.advance(830);
  assert.ok(x.w.__draws-draws>=9&&x.w.__draws-draws<=11);assert.deepEqual(x.w.__poses.at(-1),pose);
  await x.visible(false);assert.equal(x.timers.size,0);const stopped=x.w.__draws;x.advance(10000);assert.equal(x.w.__draws,stopped);
  await x.visible();x.settle();assert.equal(live().length,1);
  x.hide(true);assert.equal(x.timers.size,0);x.hide(false);x.settle();assert.equal(live().length,1);
  await x.preference(true);x.settle();assert.equal(live().length,0);await x.preference(false);x.settle();assert.equal(live().length,1);
  x.scroll(roomStages.find(s=>s.id==='quests').anchor*800);x.settle();assert.equal(live().length,0);
  x.scroll(roomStages.find(s=>s.id==='ward').anchor*800);x.settle();assert.equal(live().length,1);
  x.w.dispatchEvent(new x.w.Event('pagehide'));assert.equal(x.timers.size,0);
 }finally{x.close()}
});

test('Объектные подписи и подсказка прокрутки отсутствуют; надпись у койки не имеет внутреннего скроллера',()=>{
 const x=setupDOM('iznanka',{adult:true});try{
  assert.equal(x.d.querySelector('.room-screen-hit span,[data-room-guidance]'),null);
  const team=x.d.querySelector('[data-room-surface=team]');assert.equal(team.querySelector('.room-screen-scroll'),null);
  assert.ok(team.querySelector('[data-team-picker]'));assert.equal(x.d.querySelector('[data-room-surface=window]'),null);
 }finally{x.close()}
});

test('Мобильные якоря и камера используют высоту CSS-сцены при отличающемся innerHeight',async()=>{
 const x=await controllerHarness({width:305,height:659,stageHeight:543});try{
  await x.visible();x.settle();
  x.d.querySelector('[data-room-go="team"]').click();x.settle();
  assert.equal(x.w.scrollY,543*5,'Навигация попадает в тот же якорь, что и CSS svh');
  assert.equal(x.root.dataset.roomStageActive,'team');
  assert.equal(x.d.querySelector('[data-room-surface="team"]').hidden,false,'Кровавый блок открыт целиком после остановки камеры');
  assert.deepEqual(JSON.parse(JSON.stringify(x.w.__poses.at(-1))),roomStagePose('team',305/543),'Ракурс соответствует реальному размеру Canvas');
  x.scroll(543*8);x.settle();assert.equal(x.root.dataset.roomStageActive,'ward');
 }finally{x.close()}
});


test('До поднятия камеры среда обычная; переход ограничен по времени, выключение останавливает живые эффекты',async()=>{
 const x=await controllerHarness({camera:false,liveMotion:true});try{
  await x.visible();x.settle();assert.equal(x.root.dataset.roomCamera,'false');assert.equal(x.w.__states.at(-1).cameraAmount,0);
  assert.equal(x.timers.size,1,'В обычном коридоре работает только однократная задержка надевания');
  const button=x.root.querySelector('[data-room-camera-power]');button.click();x.flush(240);
  assert.ok(x.w.__states.at(-1).cameraWear>0,'Сначала поднимается физическая камера');
  assert.equal(x.w.__states.at(-1).cameraAmount,0,'Хоррор не появляется, пока окуляр находится далеко от лица');
  x.flush(1260);assert.ok(x.w.__states.at(-1).cameraAmount>0&&x.w.__states.at(-1).cameraAmount<1,'Среда проявляется при приближении окуляра');
  x.settle();assert.equal(x.w.__states.at(-1).cameraAmount,1);assert.equal(x.root.dataset.roomCameraLifting,'false');
  assert.ok([...x.timers.values()].some(t=>t.delay===83));
  button.click();x.settle();assert.equal(x.w.__states.at(-1).cameraAmount,0);assert.equal(x.timers.size,0);
  await x.preference(true);button.click();x.flush();assert.equal(x.w.__states.at(-1).cameraAmount,1);assert.equal(x.root.dataset.roomCameraLifting,'false');assert.equal(x.timers.size,0,'Спокойный режим сохраняет неподвижное изображение');
 }finally{x.close()}
});

test('Камера сама надевается через секунду видимого коридора; снятие сохраняется при навигации',async()=>{
 const x=await controllerHarness({camera:false,liveMotion:true});try{
  await x.visible();const button=x.root.querySelector('[data-room-camera-power]');
  assert.equal(x.w.__states.at(-1).cameraWear,0);assert.equal(x.root.dataset.roomCameraView,'false');
  x.advance(999);assert.equal(x.root.dataset.roomCamera,'false');
  x.advance(1);assert.equal(x.root.dataset.roomCamera,'true');assert.equal(button.disabled,true);
  x.flush(600);assert.ok(x.w.__states.at(-1).cameraWear>0&&x.w.__states.at(-1).cameraWear<1);assert.equal(x.w.__states.at(-1).cameraAmount,0);
  x.settle();assert.equal(button.textContent,'Убрать камеру');assert.equal(button.disabled,false);assert.equal(x.root.dataset.roomCameraView,'true');
  button.click();x.settle();assert.equal(button.textContent,'Надеть камеру');assert.equal(x.w.__states.at(-1).cameraAmount,0);
  x.d.querySelector('[data-room-go="quests"]').click();x.settle();x.root.querySelector('[data-room-open="quest_0"]').click();x.settle();
  x.advance(10000);assert.equal(x.root.dataset.roomCamera,'false','Переход к квесту не надевает снятую камеру заново');assert.equal(x.timers.size,0);
 }finally{x.close()}
});

test('Секунда ожидания и надевание приостанавливаются в скрытой вкладке и вне комнаты',async()=>{
 const x=await controllerHarness({camera:false});try{
  await x.visible();x.advance(400);x.hide(true);assert.equal(x.timers.size,0);
  x.advance(20000);x.hide(false);x.flush(0);x.advance(599);assert.equal(x.root.dataset.roomCamera,'false');x.advance(1);x.flush(500);
  const wear=x.w.__states.at(-1).cameraWear;assert.ok(wear>0&&wear<1);
  await x.visible(false);assert.equal(x.frames.size,0);assert.equal(x.timers.size,0);x.advance(30000);
  await x.visible();x.flush();assert.equal(x.w.__states.at(-1).cameraWear,wear,'Возврат не пропускает невидимую часть анимации');
  x.settle();assert.equal(x.w.__states.at(-1).cameraWear,1);
 }finally{x.close()}
 const calm=await controllerHarness({camera:false,reduced:true});try{
  await calm.visible();calm.settle();calm.advance(1000);calm.flush();assert.equal(calm.w.__states.at(-1).cameraWear,1);assert.equal(calm.root.dataset.roomCameraLifting,'false');assert.equal(calm.timers.size,0);
 }finally{calm.close()}
});

test('При выборе телевизора остаётся исходный кадр; описание включается отдельно и сбрасывается после возврата',async()=>{
 const x=await controllerHarness();try{
  await x.visible();x.settle();x.root.querySelector('[data-room-open="quest_0"]').click();x.settle();
  const nav=x.root.querySelector('[data-room-broadcast-for="quest_0"]'),button=nav.querySelector('button');
  assert.equal(nav.hidden,false);assert.equal(x.w.__states.at(-1).questDetails,false);assert.equal(x.root.dataset.roomBroadcastView,'image');
  button.click();x.settle();assert.equal(x.w.__states.at(-1).questDetails,true);assert.equal(x.root.dataset.roomBroadcastView,'details');
  button.click();x.settle();assert.equal(x.w.__states.at(-1).questDetails,false);
  x.d.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'Escape'}));x.settle();assert.equal(nav.hidden,true);
  x.root.querySelector('[data-room-open="quest_0"]').click();x.settle();assert.equal(x.w.__states.at(-1).questDetails,false);
 }finally{x.close()}
});

test('В модели есть неподвижный дежурный и два самостоятельных призрака; окон и стеклянных подложек больше нет',()=>{
 const binary=fs.readFileSync('public/models/last-round-ward-v1.glb');const gltf=JSON.parse(binary.toString('utf8',20,20+binary.readUInt32LE(12)));
 for(const name of ['RoomDutyOfficer','RoomGhost_0','RoomGhost_1'])assert.ok(gltf.nodes.some(n=>n.name===name),name);
 assert.equal(gltf.materials.some(m=>/window|frosted/i.test(m.name)),false);
 assert.ok(binary.length<5.5*1024*1024,'Детали больницы сохраняют разумный размер модели');
 const html=fs.readFileSync('dist/iznanka/index.html','utf8');const dom=new JSDOM(html);try{
  const d=dom.window.document;assert.equal(d.querySelector('[data-room-surface="window"],[data-room-open="window"]'),null);
  assert.equal(d.querySelectorAll('[data-room-broadcast-for]').length,4);assert.ok(d.querySelector('[data-room-camera-power]'));assert.equal(d.querySelectorAll('.room-camcorder>i').length,4);
 }finally{dom.window.close()}
});

test('На узком экране сначала виден дежурный; нажатие на регистр приближает ту же бумагу для чтения',async()=>{
 const x=await controllerHarness({width:390,height:844});try{
  await x.visible();x.settle();x.scroll(roomStages.find(s=>s.id==='info').anchor*844);x.settle();
  const surface=x.root.querySelector('[data-room-surface="info"]');assert.equal(surface.hidden,true);
  const wide=x.w.__poses.at(-1);assert.equal(wide.fov,92);
  x.root.querySelector('[data-room-open="info"]').click();x.settle();assert.equal(surface.hidden,false);
  const reading=x.w.__poses.at(-1);assert.equal(reading.fov,73);assert.equal(reading.target[0],roomStations.find(s=>s.id==='info').center[0]);
  assert.ok(reading.position[2]<-7.3&&reading.position[2]>-11,'Камера остаётся в служебной комнате');
  x.d.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'Escape'}));x.settle();assert.equal(surface.hidden,true);
 }finally{x.close()}
});
