/** Один раз раскрывает изображение при появлении, не прячет текст при сбое сценария. */
export function initWorldMotion(){
 const targets=document.querySelectorAll<HTMLElement>('[data-world-reveal]');
 if(!targets.length)return;
 document.body.classList.add('world-motion-ready');
 const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('world-revealed');observer.unobserve(e.target)}}),{threshold:.08});
 targets.forEach(el=>observer.observe(el));
}
