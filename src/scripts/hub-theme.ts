/** Only the entrance and its information pages share this theme. Worlds stay independent. */
export function initHubTheme(){
 if(document.body.dataset.world!=='hub')return;
 const root=document.documentElement;
 const cinematicHome=!!document.querySelector('[data-hub-hero]');
 const buttons=[...document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')];
 const apply=(theme:'dark'|'light')=>{
  if(cinematicHome)theme='dark';
  root.dataset.siteTheme=theme;
  const light=theme==='light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',light?'#fafafa':'#101010');
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content',theme);
  buttons.forEach(button=>{button.setAttribute('aria-pressed',String(light));button.setAttribute('aria-label',light?'Включить тёмную тему':'Включить светлую тему');const label=button.querySelector('[data-theme-label]');if(label)label.textContent=light?'Тёмная тема':'Светлая тема'});
 };
 apply(root.dataset.siteTheme==='light'?'light':'dark');
 buttons.forEach(button=>button.addEventListener('click',()=>{const theme=root.dataset.siteTheme==='light'?'dark':'light';apply(theme);try{localStorage.setItem('inoe-theme',theme)}catch{}}));
 window.addEventListener('storage',event=>{if(event.key==='inoe-theme')apply(event.newValue==='light'?'light':'dark')});
}
