const toggle=document.querySelector('.theme-toggle');
const media=matchMedia('(prefers-color-scheme: dark)');
function syncTheme(){const dark=document.documentElement.classList.contains('dark');toggle.textContent=dark?'Light mode':'Dark mode';toggle.setAttribute('aria-pressed',String(dark));document.querySelector('meta[name="theme-color"]').content=dark?'#0c111b':'#f8f9fb';}
toggle.addEventListener('click',()=>{const dark=document.documentElement.classList.toggle('dark');document.documentElement.classList.toggle('light',!dark);try{localStorage.setItem('dain_theme',dark?'dark':'light');}catch{}syncTheme();});
media.addEventListener('change',()=>{let saved;try{saved=localStorage.getItem('dain_theme');}catch{}if(!saved){document.documentElement.classList.toggle('dark',media.matches);document.documentElement.classList.toggle('light',!media.matches);syncTheme();}});
syncTheme();
const form=document.querySelector('#contact-form');
form?.addEventListener('submit',async event=>{
 event.preventDefault();if(!form.reportValidity())return;
 const button=form.querySelector('[type="submit"]'),status=document.querySelector('#contact-status');
 if(button.disabled)return;
 button.disabled=true;button.textContent='Sending…';status.textContent='Submitting your message…';form.setAttribute('aria-busy','true');
 try{
  const response=await fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(new FormData(form)).toString(),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('submission_failed');
  form.reset();status.textContent='Thank you. Your message has been received for the DUNITE technical team.';
 }catch(error){status.textContent=error.name==='TimeoutError'?'Confirmation timed out. Your message may have arrived. Please email tech.dunite@gmail.com to check before submitting again.':'We could not confirm your submission. Your message is still here. Please retry or email tech.dunite@gmail.com.';}
 finally{button.disabled=false;button.textContent='Send message →';form.removeAttribute('aria-busy');status.focus();}
});
