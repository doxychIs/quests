/** Независимые материалы первого экрана и прокручиваемой сцены.
 * Для будущего хиро замените только hero.video на путь к новому ролику.
 * Ролики пролёта никогда не используются как фон первого экрана.
 */
export const worldMedia={
 arhiv:{hero:{image:'arhiv.webp',video:null as string|null},cinema:{name:'archive',end:9.875,fps:24}},
 ostrov:{hero:{image:'island-passage-final.webp',video:null as string|null},cinema:{name:'island',end:6.25,fps:24}}
};
export const islandIdentities=[
 {theme:'jungle',symbol:'✳',place:'Джунгли',note:'Там, где тропинки играют в прятки',x:24,y:45},
 {theme:'frozen',symbol:'❄',place:'Ледяной мир',note:'Большие открытия любят тёплую команду',x:47,y:24},
 {theme:'stone',symbol:'◇',place:'Древние пещеры',note:'У каждой стены есть своя история',x:65,y:37},
 {theme:'volcano',symbol:'☀',place:'Вулкан',note:'Приключение с огоньком',x:84,y:53}
] as const;
