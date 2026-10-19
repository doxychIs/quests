/** Независимые материалы первого экрана и прокручиваемой сцены.
 * Фон первого экрана и пролёт подготовлены из разных исходников.
 * Ролики пролёта никогда не используются как фон первого экрана.
 */
export const worldMedia={
 arhiv:{hero:{image:'archive-hero-poster.webp',video:'assets/archive-hero.mp4',mobile:'assets/archive-hero-mobile.mp4'},cinema:{name:'archive',end:9.875,fps:24}},
 ostrov:{hero:{image:'island-hero-poster.webp',video:'assets/island-hero.mp4',mobile:'assets/island-hero-mobile.mp4'},cinema:{name:'island',end:6.25,fps:24}}
};
export const islandIdentities=[
 {theme:'jungle',symbol:'✳',place:'Джунгли',note:'Там, где тропинки играют в прятки',x:24,y:45},
 {theme:'frozen',symbol:'❄',place:'Ледяной мир',note:'Большие открытия любят тёплую команду',x:47,y:24},
 {theme:'stone',symbol:'◇',place:'Древние пещеры',note:'У каждой стены есть своя история',x:65,y:37},
 {theme:'volcano',symbol:'☀',place:'Вулкан',note:'Приключение с огоньком',x:84,y:53}
] as const;
// Внутренние полотна в финальном кадре 1280×720. Рамы остаются частью видео.
export const archivePaintings=[
 {points:'555,186 722,187 723,416 554,414',x:554,y:186,width:170,height:231},
 {points:'343,160 475,158 476,333 343,334',x:343,y:158,width:134,height:177},
 {points:'339,380 479,378 480,495 337,494',x:337,y:378,width:144,height:118},
 {points:'803,310 930,310 930,430 803,430',x:803,y:310,width:128,height:121}
] as const;
