import {drawGraphicText} from './broadcast-glyphs';

type Rect={x:number;y:number;width:number;height:number};
/** Paint the accessible DOM into its actual world material. Controls keep their
 * native semantics, pointer/keyboard handling and scroll; no second visual UI.
 * Only the settled, front-facing surface is measured. No HTML screenshots,
 * dependencies, data URLs, extra WebGL contexts or full-page rasterization. */
export function createRoomSurfacePainter(root:HTMLElement,onDirty:()=>void=()=>{}){
 const canvas=document.createElement('canvas'),c=canvas.getContext('2d')!;
 const base=document.createElement('canvas'),bc=base.getContext('2d')!;
 let surface:HTMLElement|undefined,dirty=true,rootRect:DOMRect,sx=1,sy=1;
 let live:{element:HTMLCanvasElement|HTMLVideoElement;rect:Rect;clip:Rect}[]=[];
 const local=(rect:DOMRect):Rect=>({x:(rect.left-rootRect.left)*sx,y:(rect.top-rootRect.top)*sy,width:rect.width*sx,height:rect.height*sy});
 const intersect=(a:Rect,b:Rect):Rect=>({x:Math.max(a.x,b.x),y:Math.max(a.y,b.y),width:Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)),height:Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y))});
 const clip=(rect:Rect)=>{c.beginPath();c.rect(rect.x,rect.y,rect.width,rect.height);c.clip();};
 function image(source:CanvasImageSource,rect:Rect,fit='fill'){
  const element=source as HTMLImageElement,video=source as HTMLVideoElement;
  const w=element.naturalWidth||video.videoWidth||(source as HTMLCanvasElement).width,h=element.naturalHeight||video.videoHeight||(source as HTMLCanvasElement).height;
  if(!w||!h)return;
  let width=rect.width,height=rect.height;if(fit==='contain'||fit==='cover'){const k=(fit==='contain'?Math.min:Math.max)(width/w,height/h);width=w*k;height=h*k;}
  c.save();clip(rect);c.drawImage(source,rect.x+(rect.width-width)/2,rect.y+(rect.height-height)/2,width,height);c.restore();
 }
 function text(node:Text,style:CSSStyleDeclaration){
  if(!node.textContent?.trim())return;
  c.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;c.fillStyle=style.color;c.textBaseline='alphabetic';
  const range=document.createRange(),value=node.textContent;
  // A Range per word follows the real native line breaks, including scrollers.
  for(const match of value.matchAll(/\S+\s*/g)){
   const start=match.index!,word=match[0];range.setStart(node,start);range.setEnd(node,start+word.trimEnd().length);
   const rect=local(range.getBoundingClientRect());if(!rect.width||!rect.height)continue;
   const size=parseFloat(style.fontSize),metrics=c.measureText(word.trimEnd()),ascent=metrics.actualBoundingBoxAscent||size*.8,descent=metrics.actualBoundingBoxDescent||size*.2,baseline=rect.y+(rect.height-ascent-descent)/2+ascent;c.strokeStyle=style.color;c.lineWidth=surface?.dataset.roomSurface==='team'?1.25:.4;c.strokeText(word.trimEnd(),rect.x,baseline);c.fillText(word.trimEnd(),rect.x,baseline);if(surface?.dataset.roomSurface==='team'&&node.parentElement?.closest('h2')){let advance=0;for(const [i,char]of [...word.trimEnd()].entries()){if(i%3===1){const x=rect.x+advance+size*.16,length=9+(i*7)%18;c.fillStyle=style.color;c.fillRect(x,baseline-2,1.5,length);c.beginPath();c.ellipse(x+.7,baseline+length-2,1.15,1.8,0,0,Math.PI*2);c.fill();}advance+=c.measureText(char).width;}}
  }
 }
 function paint(element:HTMLElement|SVGElement,parentClip:Rect,opacity=1){
  const style=getComputedStyle(element);if(element.hasAttribute('hidden')||style.display==='none'||style.visibility==='hidden'||element!==surface&&Number(style.opacity||1)===0)return;
  const rect=local(element.getBoundingClientRect()),inside=intersect(rect,parentClip);if(!inside.width||!inside.height)return;
  c.save();c.globalAlpha=opacity*(element===surface?1:Number(style.opacity||1));clip(parentClip);
  if(style.backgroundColor!=='rgba(0, 0, 0, 0)'&&style.backgroundColor!=='transparent'){c.fillStyle=style.backgroundColor;c.fillRect(rect.x,rect.y,rect.width,rect.height);}
  const round=parseFloat(style.borderTopLeftRadius);
  if(round>0&&parseFloat(style.borderTopWidth)>0){c.strokeStyle=style.borderTopColor;c.lineWidth=parseFloat(style.borderTopWidth);c.beginPath();c.ellipse(rect.x+rect.width/2,rect.y+rect.height/2,Math.max(1,rect.width/2-1),Math.max(1,rect.height/2-1),-.025,0,Math.PI*2);c.stroke();}
  for(const [edge,x,y,w,h]of [
   ['Top',rect.x,rect.y,rect.width,parseFloat(style.borderTopWidth)],
   ['Bottom',rect.x,rect.y+rect.height-parseFloat(style.borderBottomWidth),rect.width,parseFloat(style.borderBottomWidth)],
   ['Left',rect.x,rect.y,parseFloat(style.borderLeftWidth),rect.height],
   ['Right',rect.x+rect.width-parseFloat(style.borderRightWidth),rect.y,parseFloat(style.borderRightWidth),rect.height],
  ] as [string,number,number,number,number][]){if(w&&h&&!round){c.fillStyle=style.getPropertyValue('border-'+edge.toLowerCase()+'-color');c.fillRect(x,y,w,h);}}
  if(element instanceof HTMLImageElement){if(element.complete&&element.naturalWidth){c.filter=style.filter;image(element,rect,style.objectFit);}c.restore();return;}
  if(element instanceof HTMLCanvasElement||element instanceof HTMLVideoElement){if(!(element instanceof HTMLCanvasElement&&element.closest('.game-shell')?.querySelector('.game-result:not([hidden])')))live.push({element,rect,clip:parentClip});c.restore();return;}
  if(element instanceof HTMLElement&&element.dataset.graphicText){
   drawGraphicText(c,element.dataset.graphicText,rect.x,rect.y+3,parseFloat(style.fontSize),style.color,17,rect.width);c.restore();return;
  }
  if(element instanceof SVGElement){c.restore();return;}
  const childClip=/(auto|scroll|hidden|clip)/.test(style.overflow+style.overflowX+style.overflowY)?inside:parentClip;
  c.save();clip(childClip);
  for(const child of element.childNodes){if(child instanceof Text)text(child,style);else if(child instanceof HTMLElement||child instanceof SVGElement)paint(child,childClip,c.globalAlpha);}
  c.restore();
  if(element.scrollHeight>element.clientHeight+3&&/(auto|scroll)/.test(style.overflowY)){
   const track=rect.height-12,thumb=Math.max(20,track*element.clientHeight/element.scrollHeight);c.fillStyle=style.color;c.globalAlpha=.35;c.fillRect(rect.x+rect.width-4,rect.y+6+(track-thumb)*element.scrollTop/(element.scrollHeight-element.clientHeight),2,thumb);
  }
  if(style.outlineStyle!=='none'&&parseFloat(style.outlineWidth)>0){c.strokeStyle=style.outlineColor;c.lineWidth=parseFloat(style.outlineWidth);c.strokeRect(rect.x+2,rect.y+2,rect.width-4,rect.height-4);}
  c.restore();
 }
 const invalidate=()=>{dirty=true;onDirty();};
 const observer=new MutationObserver(records=>{
  if(records.some(record=>record.target!==surface&&(!surface||surface.contains(record.target))))invalidate();
 });observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','class','aria-pressed','aria-expanded','data-suitable','style']});
 const events=new AbortController();
 for(const event of ['click','change','input','scroll','load','focusin','focusout','pointerover','pointerout'])root.addEventListener(event,invalidate,{capture:true,passive:true,signal:events.signal});
 return{
  capture(next:HTMLElement){
   if(next!==surface){surface=next;dirty=true;}
   const width=next.offsetWidth,height=next.offsetHeight;if(!width||!height)return;
   if(canvas.width!==width||canvas.height!==height){canvas.width=base.width=width;canvas.height=base.height=height;dirty=true;}
   const changed=dirty||live.length>0;
   if(dirty){
    rootRect=next.getBoundingClientRect();if(!rootRect.width||!rootRect.height)return;
    sx=width/rootRect.width;sy=height/rootRect.height;live=[];c.clearRect(0,0,width,height);
    paint(next,{x:0,y:0,width,height});
    // Physical stains interrupt ink, never a continuously moving noise layer.
    if(next.dataset.roomSurface==='team'){
     c.save();c.globalCompositeOperation='destination-out';c.fillStyle='#000';
     for(let i=0;i<210;i++){const x=(i*173.19)%width,y=(i*91.37)%height;c.globalAlpha=.25+(i%4)*.13;c.fillRect(x,y,1+(i%3),.65);}
     c.restore();
    }
    bc.clearRect(0,0,width,height);bc.drawImage(canvas,0,0);dirty=false;
   }
   c.clearRect(0,0,width,height);c.drawImage(base,0,0);
   for(const item of live){if(item.element instanceof HTMLVideoElement&&item.element.readyState<2)continue;c.save();clip(item.clip);image(item.element,item.rect,getComputedStyle(item.element).objectFit);c.restore();}
   return{canvas,changed};
  },
  invalidate,
  needsUpdate(){return dirty;},
  dispose(){observer.disconnect();events.abort();live=[];surface=undefined;canvas.width=base.width=1;},
 };
}
