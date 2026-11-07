import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSync} from 'esbuild';
import {JSDOM} from 'jsdom';
const bundle=buildSync({entryPoints:['src/lib/room-surface-painter.ts'],bundle:true,format:'iife',globalName:'surfacePainter',write:false}).outputFiles[0].text;
function setup(){
 const dom=new JSDOM('<div id="root"><section id="surface" data-room-surface="team" style="opacity:0;width:960px;height:690px;color:rgb(180,47,59);font:24px monospace"><h2>Не входите одни</h2><div id="scroll" style="overflow:auto;height:150px"><p>Сколько вас?</p><p hidden>Скрытая вкладка</p><button>Выбрать</button><canvas width="1000" height="460"></canvas></div></section></div>',{runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document,calls=[];let invalidations=0;
 w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({globalAlpha:1,measureText(text){return{width:text.length*15,actualBoundingBoxAscent:18,actualBoundingBoxDescent:4}},fillText(...args){calls.push(['text',...args])},drawImage(...args){calls.push(['image',...args])},rect(...args){calls.push(['clip',...args])}},{get(o,key){return key in o?o[key]:()=>{}},set(o,key,v){o[key]=v;return true}})};
 const rect=(x=0,y=0,width=960,height=70)=>({x,y,left:x,top:y,right:x+width,bottom:y+height,width,height});
 w.HTMLElement.prototype.getBoundingClientRect=function(){return rect(0,this.id==='surface'?0:this.tagName==='H2'?20:this.id==='scroll'?100:130,960,this.id==='surface'?690:this.id==='scroll'?150:60)};
 w.Range.prototype.getBoundingClientRect=()=>rect(20,35,150,24);
 const surface=d.querySelector('#surface');Object.defineProperties(surface,{offsetWidth:{value:960},offsetHeight:{value:690}});
 w.eval(bundle+';window.painterAPI=surfacePainter;');const painter=w.painterAPI.createRoomSurfacePainter(d.querySelector('#root'),()=>invalidations++);
 return{dom,w,d,calls,painter,surface,get invalidations(){return invalidations},close(){painter.dispose();dom.window.close()}};
}
test('Невидимый доступный слой рисуется в материал; скрытая вкладка не попадает на стену',()=>{
 const x=setup();try{const result=x.painter.capture(x.surface);assert.ok(result.changed);assert.equal(result.canvas.width,960);assert.ok(x.calls.some(c=>c[0]==='text'&&c[1]==='Не'));assert.ok(x.calls.some(c=>c[0]==='text'&&c[1]==='Выбрать'));assert.equal(x.calls.some(c=>c[1]==='Скрытая'),false);assert.equal(x.surface.style.opacity,'0');assert.equal(x.surface.querySelector('button').textContent,'Выбрать');}finally{x.close()}
});
test('Живой Canvas и обрезка вложенного скролла остаются в той же текстуре; события инвалидируют только кэш',()=>{
 const x=setup();try{x.painter.capture(x.surface);assert.ok(x.calls.some(c=>c[0]==='image'&&c[1]===x.surface.querySelector('canvas')));assert.ok(x.calls.some(c=>c[0]==='clip'&&c[4]===150));const before=x.invalidations;x.surface.querySelector('button').click();assert.ok(x.invalidations>before);assert.equal(x.painter.needsUpdate(),true);x.painter.capture(x.surface);assert.equal(x.painter.needsUpdate(),false);x.painter.dispose();const stopped=x.invalidations;x.surface.querySelector('button').click();assert.equal(x.invalidations,stopped);}finally{x.close()}
});
