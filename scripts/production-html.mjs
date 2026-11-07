import {load} from 'cheerio';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';

// Convert the trusted source's handlers at build time. No eval or runtime compilation.
export async function productionHTML(source){
 const handlers=[];
 source=source.replace(/\s+on(click|submit|input|error)="([^"]*)"/g,(_,event,code)=>{
  if(event==='error')return '';
  const id=handlers.push({event,code})-1;
  return ` data-event-${event}="${id}"`;
 });
 const $=load(source);
 $('#auth-form-demo,#tab-auth-demo').remove();
 $('#verify-email-token').attr('minlength','6').attr('inputmode','numeric').attr('autocomplete','one-time-code');
 $('p').filter((_,n)=>$(n).text().trim()==='Admin & Reach').attr('data-admin-heading','').attr('hidden','');
 $('[data-view="admin"],[data-view="distribution"],[data-view="analytics"]').attr('hidden','');
 $('#confirm-box').closest('label').find('span').text('I certify that this story is authentic and that I have permission to submit it.');
 // Replace invented reach statistics and contacts with truthful workflow information.
 $('#view-analytics').html('<div class="p-6 bg-white border border-border-light rounded-3xl"><h2 class="text-xl font-bold">Queue activity</h2><p class="text-sm mt-3">Audience reach is not measured. Open Media Network to see configured recipients and delivery jobs. Newsroom sending remains disabled.</p></div>');
 $('#view-distribution').html('<div class="space-y-3"><h2 class="text-xl font-bold">Media Network</h2><p class="text-sm">Only approved newsroom recipients are eligible for queue preparation. No emails are being sent.</p></div>');
 $('a[href*="netlify.com"]').filter((_,n)=>/netlify/i.test($(n).text())).remove();
 $('[data-event-click]').each((_,n)=>{if(n.tagName==='div')$(n).attr({role:'button',tabindex:'0'});});
 const events=handlers.map(({event,code},id)=>`${id}:function(event){${code}}`).join(',\n');
 const listener=`\n(()=>{const handlers={${events}};for(const type of ['click','submit','input'])document.addEventListener(type,event=>{const el=event.target.closest('[data-event-'+type+']');if(el){const result=handlers[el.getAttribute('data-event-'+type)].call(el,event);if(result===false)event.preventDefault();}});document.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('[role="button"][data-event-click]')){event.preventDefault();event.target.click();}});})();`;
 const scripts=$('script:not([src])').toArray();
 for(const node of scripts){const code=$(node).html();if(!code?.trim()){ $(node).remove();continue;}const content=code+listener;const name='app-'+createHash('sha256').update(content).digest('hex').slice(0,12)+'.js';await fs.writeFile('dist/assets/'+name,content);$(node).empty().attr('src','assets/'+name);}
 const theme="try{document.documentElement.classList.toggle('dark',(localStorage.getItem('dain_theme')|| (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'))==='dark');}catch{}";
 await fs.writeFile('dist/assets/theme.js',theme);$('head').prepend('<script src="assets/theme.js"></script>');
 let html=$.html().replaceAll('100+ Media Network','Media Network').replaceAll('100+ Media Distribution Network','Media Network').replaceAll('100+ Media','Media Network').replaceAll('100+ Outlets','Editorial review').replaceAll('100+ national media partners','approved newsroom recipients').replaceAll('100+ accredited journalists','approved newsroom recipients').replaceAll('100+ national, digital, and campus media','approved newsroom recipients').replaceAll('100% Verified','Confirmed email').replaceAll('Instant verification via @du.ac.bd institutional email or alumni records.','Confirm your DU institutional email before submitting.').replaceAll('Verified against Dhaka University institutional active records.','Must match your confirmed signed-in email.').replaceAll('DU Email (du.ac.bd or a department subdomain) *','Confirmed account email *');
 return html;
}
