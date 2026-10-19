export const giftNames:Record<string,string>={all:'Три мира на выбор',iznanka:'ИЗНАНКА / 18+',arhiv:'АРХИВ / 14+',ostrov:'ОСТРОВ / 6+'};
export type Invitation={to:string;message:string;world:string};
const escape=(s:string)=>s.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
function lines(text:string){
 const words=text.replace(/\s+/g,' ').trim().split(' '),result:string[]=[];let line='';
 for(let word of words){if(line&&line.length+word.length+1>43){result.push(line);line=''}while(word.length>43){result.push(word.slice(0,43));word=word.slice(43)}line+=(line?' ':'')+word}
 if(line)result.push(line);return result;
}
/** Автономная открытка: тот же билет, что в предпросмотре, без внешних шрифтов и файлов. */
export function invitationSVG(v:Invitation){
 const colors=v.world==='iznanka'?['#151b15','#d1d7c2','#b98576']:v.world==='arhiv'?['#e6e1d3','#2c362c','#8b6746']:v.world==='ostrov'?['#f2e3b9','#1c5348','#ba643f']:['#f5f0e4','#29382b','#b85c3d'];
 const [paper,ink,accent]=colors,nameSize=v.to.length>23?38:v.to.length>15?48:70;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><title>Личное приглашение на квест — ИНОЕ</title><rect width="1200" height="800" fill="${paper}"/><path d="M930 30V770" stroke="${ink}" opacity=".35" stroke-dasharray="4 8"/><path d="M38 38H1162V762H38Z" fill="none" stroke="${ink}" opacity=".18"/><g fill="${ink}"><text x="75" y="120" font-family="Arial,sans-serif" font-size="48" font-weight="bold" letter-spacing="-3">ИНОЕ</text><text x="75" y="230" font-family="Arial,sans-serif" font-size="17" letter-spacing="2">ЛИЧНОЕ ПРИГЛАШЕНИЕ НА КВЕСТ</text><text x="75" y="350" font-family="Georgia,serif" font-size="${nameSize}" font-style="italic">Для ${escape(v.to)}.</text><text x="75" y="414" font-family="Arial,sans-serif" font-size="21">${escape(giftNames[v.world]||giftNames.all)}</text>${lines(v.message).map((line,i)=>`<text x="75" y="${502+i*36}" font-family="Georgia,serif" font-size="27" font-style="italic">${escape(line)}</text>`).join('')}<text x="75" y="710" font-family="Arial,sans-serif" font-size="13" opacity=".65">Демонстрационное приглашение.</text><text x="75" y="734" font-family="Arial,sans-serif" font-size="13" opacity=".65">Не является оплаченным сертификатом.</text></g><g stroke="${accent}" fill="none" stroke-width="2"><path d="M985 475V315H1030V475M1043 475V255a23 23 0 0 1 46 0v220M1102 475V355a23 23 0 0 1 46 0v120M975 475H1158"/></g><g fill="${ink}" font-family="Arial,sans-serif" font-size="17"><text x="990" y="125">ПО ТУ СТОРОНУ</text><text x="990" y="150">ОБЫЧНОГО.</text><text x="990" y="645">ОДНА ДВЕРЬ.</text><text x="990" y="674">НОВАЯ ИСТОРИЯ.</text></g></svg>`;
}
