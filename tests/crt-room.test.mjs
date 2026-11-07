import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {roomScreens,roomSize,screenHomography,projectScreen,screenCenter,roundedScreenPath} from '../src/lib/crt-room.ts';

// The image-based corridor is no longer mounted on the horror home page.
// Preserve the independently useful signal-layout and projective-mapping contract.
test('Каталог ТВ: семь вариантов сигнала представляют четыре существующих квеста и три атмосферных канала',()=>{
 assert.equal(roomScreens.length,7);
 const quests=roomScreens.filter(s=>s.kind==='quest');assert.equal(quests.length,4);
 assert.equal(new Set(quests.map(s=>s.slug)).size,4);
 for(const screen of quests)assert.ok(fs.existsSync(path.join('dist/iznanka/quests',screen.slug,'index.html')));
 assert.equal(roomScreens.filter(s=>s.kind==='ambient').length,3);
});
test('Гомография: все четыре угла каждого сигнала совпадают с исходной разметкой',()=>{
 for(const screen of roomScreens){
  const h=screenHomography(screen.quad);
  [[0,0],[1,0],[1,1],[0,1]].forEach(([u,v],i)=>{
   const p=projectScreen(h,u,v);
   assert.ok(Math.abs(p.x-screen.quad[i].x)<1e-8,screen.id);
   assert.ok(Math.abs(p.y-screen.quad[i].y)<1e-8,screen.id);
  });
 }
});
test('Проекция сигнала имеет конечную сетку, не переворачивается и остаётся в границах кадра',()=>{
 for(const screen of roomScreens){
  const h=screenHomography(screen.quad);
  for(let y=0;y<=12;y++)for(let x=0;x<=12;x++){
   const p=projectScreen(h,x/12,y/12);
   assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
   assert.ok(p.x>0&&p.x<roomSize.width&&p.y>0&&p.y<roomSize.height);
  }
  const center=screenCenter(screen.quad);assert.ok(center.x>0&&center.y>0);
  assert.match(roundedScreenPath(screen.quad,screen.radius),/^M .+ Z$/);
 }
});
