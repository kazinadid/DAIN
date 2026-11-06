import { createClient } from '@supabase/supabase-js';
import { sectors, institutionalEmail, safeUrl, validateStory, escapeHtml as e } from './domain.js';
import './style.css';

const url = import.meta.env.VITE_SUPABASE_URL || 'https://hfxlcvigujvyuayhzhax.supabase.co';
// Publishable key is intentionally public. Database policies protect every operation.
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_FGN-XtMGVUZairpVWBx36w_LrHZRh6O';
const db = createClient(url, key);
const app = document.querySelector('#app');
let user = null, role = 'member', profile = null, stories = [], submissions = [], active = null;
let authMode = 'login', filter = '', search = '', notice = '', error = '', busy = false;
let requestId = 0;
const icons = ['↗', '◈', '↟', '◎', '✦'];
const date = v => new Date(v).toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'});
const tag = s => `<span class="tag ${e(s)}">${e(s.replaceAll('_',' '))}</span>`;
const sectorOptions = selected => sectors.map(s => `<option ${s === selected ? 'selected' : ''}>${e(s)}</option>`).join('');
const link = (href,text,cls='') => `<a class="${cls}" href="${href}">${text}</a>`;
const check = result => { if (result.error) throw result.error; return result.data; };
const field = (label, name, value='', extra='') => `<label>${label}<input name="${name}" value="${e(value)}" ${extra}></label>`;

function shell(content, page='') {
 app.innerHTML = `<header><div class="wrap header"><a href="#/" class="brand" aria-label="DAIN home"><span class="brand-symbol">d.</span><span>DAIN<small>BY DUNITE</small></span></a><nav aria-label="Main navigation">${link('#/stories','Discover',page==='discover'?'selected':'')}${user ? link('#/dashboard','My workspace',page==='workspace'?'selected':'') : link('#/about','How it works')}${user && role !== 'member' ? link('#/editor','Editorial',page==='editor'?'selected':'') : ''}</nav><div class="account">${user ? `<span class="desktop muted">${e(profile?.display_name || user.email.split('@')[0])}</span><button class="ghost" id="logout">Sign out</button>` : link('#/auth','Sign in','ghost')}${link(user?'#/new':'#/auth/register','Share an achievement <span>↗</span>','button small')}</div></div></header><main>${notice ? `<div class="wrap alert success" role="status">${e(notice)}</div>`:''}${error ? `<div class="wrap alert danger" role="alert">${e(error)}</div>`:''}${content}</main><footer><div class="wrap footer"><a href="#/" class="brand">DAIN<span class="muted"> / DUNITE</span></a><p>Extraordinary people. Meaningful impact.</p><span>University of Dhaka · Bangladesh</span></div></footer>`;
 document.querySelector('#logout')?.addEventListener('click', run(async()=>{check(await db.auth.signOut());location.hash='#/';}));
}
function run(fn) {
 return async event => {
  event?.preventDefault(); if (busy) return;
  busy = true; error = ''; notice = '';
  const buttons = [...document.querySelectorAll('button[type=submit],button[data-action]')];
  buttons.forEach(b=>b.disabled=true);
  try { await fn(event); } catch (err) { error = err.message || 'Something went wrong. Please try again.'; renderAlert(); }
  finally {busy=false;buttons.forEach(b=>b.disabled=false);}
 };
}
function renderAlert() {
 document.querySelectorAll('.alert').forEach(n=>n.remove());
 const a = document.createElement('div');a.className=`wrap alert ${error?'danger':'success'}`;a.setAttribute('role',error?'alert':'status');a.textContent=error || notice;document.querySelector('main')?.prepend(a);
}
function storyCard(s) {
 const ix = sectors.indexOf(s.sector);
 return `<a href="#/story/${e(s.id)}" class="story-card"><div class="card-art art-${ix}"><span>${icons[ix] || '✦'}</span><small>DAIN / IMPACT STORIES</small></div><div class="card-body"><span class="eyebrow">${e(s.sector)}</span><h3>${e(s.headline)}</h3><p>${e(s.summary)}</p><div class="card-foot"><span>${e(s.author_name)}</span><span>${date(s.published_at)} ↗</span></div></div></a>`;
}
function home(discover=false) {
 const visible = stories.filter(s=>(!filter || s.sector===filter) && `${s.headline} ${s.summary} ${s.author_name}`.toLowerCase().includes(search.toLowerCase()));
 shell(`${!discover ? `<section class="hero"><div class="wrap hero-grid"><div><div class="eyebrow"><span class="live-dot"></span> THE DHAKA UNIVERSITY ACHIEVEMENT NETWORK</div><h1>Great stories<br>deserve a<br><em>bigger stage.</em></h1><p class="hero-copy">From a breakthrough in the lab to an idea that changes a community. Share your achievement. Let your impact travel further.</p><div class="actions">${link(user?'#/new':'#/auth/register','Tell your story <span>↗</span>','button')}${link('#/stories','Explore achievements <span>↓</span>','text-link')}</div><div class="hero-note"><span class="seal">DU</span><span>Rooted in Dhaka University.<br><strong>Built for a world of possibilities.</strong></span></div></div><div class="hero-art" aria-hidden="true"><span class="art-label">POTENTIAL → POSSIBILITY</span><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="orbit orbit-three"></div><div class="monogram">d<span>↗</span></div><div class="art-caption"><span>IDEAS. ACHIEVEMENTS. IMPACT.</span><strong>One community.<br>Countless possibilities.</strong></div><span class="art-cross">+</span></div></div></section><div class="sector-strip"><div class="wrap">${sectors.map((s,i)=>`<span>${icons[i]} ${e(s.split(' & ')[0])}</span>`).join('')}</div></div>` : ''}<section class="wrap section"><div class="section-heading"><div><span class="eyebrow">THE DAIN JOURNAL</span><h2>${discover?'Discover achievements':'Ideas taking shape.<br>People making a difference.'}</h2></div><p>Stories of ambition and achievement<br>from our university community.</p></div><div class="filters"><label class="search"><span>⌕</span><input id="search" placeholder="Search achievements or people" value="${e(search)}" aria-label="Search achievements"></label><select id="sector-filter" aria-label="Filter by sector"><option value="">All sectors</option>${sectorOptions(filter)}</select></div><div class="story-grid">${visible.length ? visible.map(storyCard).join('') : `<div class="empty"><span>↗</span><h3>${stories.length?'No matching stories':'The next great story could be yours.'}</h3><p>${stories.length?'Try another search or sector.':'DAIN is just getting started. Published, editorially reviewed achievements will appear here.'}</p>${link(user?'#/new':'#/auth/register','Share an achievement','button')}</div>`}</div></section>${!discover?`<section class="process"><div class="wrap"><span class="eyebrow">FROM ACHIEVEMENT TO AMPLIFICATION</span><div class="section-heading"><h2>Your achievement.<br>Our shared story.</h2>${link('#/about','Meet the process ↗','text-link')}</div><div class="steps"><article><span>01 / SHARE</span><h3>Start with your story.</h3><p>Tell us what you achieved, why it matters, and share the evidence behind it.</p></article><article><span>02 / REFINE</span><h3>Give it the care it deserves.</h3><p>Our editorial team reviews the details and helps shape a clear, credible narrative.</p></article><article><span>03 / PUBLISH</span><h3>Make your impact visible.</h3><p>Approved stories become public, shareable pages with a press-ready summary.</p></article></div></div></section>`:''}`, 'discover');
 document.querySelector('#sector-filter').onchange = ev => {filter=ev.target.value;home(discover);};
 document.querySelector('#search').oninput = ev => { search=ev.target.value; const pos=ev.target.selectionStart;home(discover);const i=document.querySelector('#search');i.focus();i.setSelectionRange(pos,pos);};
}
function auth() {
 const registering = authMode==='register', reset = authMode==='reset';
 shell(`<section class="wrap auth-layout"><div class="auth-intro"><span class="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span><h1>A community<br>of <em>possibility.</em></h1><p>One place to celebrate the people moving Dhaka University forward.</p><div class="auth-quote">“An achievement shared<br>can become someone else's inspiration.”</div></div><div class="panel auth-panel"><span class="eyebrow">WELCOME TO DAIN</span><h2>${registering?'Make your mark.':reset?'Reset your password.':'Good to see you.'}</h2><p class="muted">${registering?'Use your DU institutional email to submit achievements.':reset?'We’ll send a secure password reset link.':'Sign in to your achievement workspace.'}</p><form id="auth-form">${registering?field('Your name','name','','required minlength="2" maxlength="100" autocomplete="name"'):''}${field('Email address','email','','required type="email" autocomplete="email" placeholder="you@du.ac.bd"')}${!reset?field('Password','password','','required type="password" minlength="12" autocomplete="'+(registering?'new-password':'current-password')+'"'):''}<button class="button" type="submit">${registering?'Create account':reset?'Send reset link':'Sign in'} ↗</button></form><p class="muted auth-switch">${registering?'Already have an account?':reset?'Remember your password?':'New to DAIN?'} <a href="${registering || reset?'#/auth':'#/auth/register'}">${registering || reset?'Sign in':'Create an account'}</a></p>${!registering&&!reset?'<a href="#/auth/reset" class="muted">Forgot your password?</a>':''}<p class="fineprint">Submissions require a confirmed @du.ac.bd email or departmental subdomain. Editorial accounts are assigned separately.</p></div></section>`);
 document.querySelector('#auth-form').onsubmit = run(async ev=>{
  const f = new FormData(ev.target), email=String(f.get('email')).trim(), password=String(f.get('password')||'');
  if (reset) { check(await db.auth.resetPasswordForEmail(email,{redirectTo:`${location.origin}/#/password`}));notice='Check your email for a password reset link.';renderAlert();return; }
  if (registering) {
   // Non-DU accounts may sign in as invited staff; SQL still gates submissions to verified DU members.
   const data=check(await db.auth.signUp({email,password,options:{data:{display_name:String(f.get('name'))},emailRedirectTo:`${location.origin}/#/dashboard`}}));
   if(data.session) {location.hash='#/dashboard';} else {notice='Check your email to confirm your account, then sign in. If no email arrives, contact the DAIN administrator.';renderAlert();}
  } else {check(await db.auth.signInWithPassword({email,password}));location.hash='#/dashboard';}
 });
}
function passwordPage() {
 shell(`<section class="wrap narrow section"><div class="panel"><h2>Choose a new password</h2><form id="password-form">${field('New password','password','','required type="password" minlength="12" autocomplete="new-password"')}<button type="submit" class="button">Update password</button></form></div></section>`);
 document.querySelector('#password-form').onsubmit=run(async ev=>{check(await db.auth.updateUser({password:new FormData(ev.target).get('password')}));notice='Password updated.';location.hash='#/dashboard';});
}
function dashboard(editor=false) {
 const rows = editor ? submissions.filter(s=>s.status!=='draft') : submissions;
 shell(`<section class="wrap section"><div class="section-heading"><div><span class="eyebrow">${editor?'EDITORIAL DESK':'YOUR DAIN WORKSPACE'}</span><h1 class="page-title">${editor?'Give great stories a voice.':`Hello, ${e(profile?.display_name?.split(' ')[0] || 'storyteller')}.`}</h1><p class="muted">${editor?'Review evidence, guide authors, and publish approved stories.':'Every achievement starts with a story. This is where yours takes shape.'}</p></div>${!editor?link('#/new','New achievement ↗','button'):''}</div><div class="stats"><div><strong>${rows.length}</strong><span>${editor?'Stories in the desk':'Your achievements'}</span></div><div><strong>${rows.filter(s=>s.status==='submitted').length}</strong><span>Awaiting review</span></div><div><strong>${rows.filter(s=>s.status==='published').length}</strong><span>Published</span></div></div><div class="list-heading"><h2>${editor?'Editorial queue':'Your stories'}</h2><button class="ghost" id="refresh">Refresh ↻</button></div><div class="submission-list">${rows.length?rows.map(s=>`<a href="#/${editor?'review':'edit'}/${e(s.id)}" class="submission-row"><div><span class="eyebrow">${e(s.sector)}</span><h3>${e(s.headline)}</h3><span class="muted">${e(s.author_name)} · ${date(s.created_at)}</span></div><div>${tag(s.status)}<span class="row-arrow">↗</span></div></a>`).join(''):`<div class="empty"><span>◈</span><h3>${editor?'The editorial desk is clear.':'Your story starts here.'}</h3><p>${editor?'Submitted achievements will appear here for review.':'Create your first achievement and share what you have been working on.'}</p>${!editor?link('#/new','Create a draft','button'):''}</div>`}</div>${!editor?`<details class="panel profile"><summary>Your profile</summary><form id="profile-form">${field('Display name','name',profile?.display_name || user.user_metadata.display_name || '', 'required minlength="2" maxlength="100"')}${field('Department','department',profile?.department || '', 'maxlength="200"')}<button type="submit" class="button">Save profile</button></form></details>`:''}</section>`,editor?'editor':'workspace');
 document.querySelector('#refresh').onclick=()=>route();
 document.querySelector('#profile-form')?.addEventListener('submit',run(async ev=>{const f=new FormData(ev.target);profile=check(await db.from('profiles').upsert({id:user.id,display_name:f.get('name'),department:f.get('department')}).select().single());notice='Profile saved.';renderAlert();}));
}
function editorForm(s=null, reviewing=false) {
 active=s;
 const editable = !reviewing && (!s || ['draft','changes_requested'].includes(s.status));
 shell(`<section class="wrap section editor-layout"><div><a class="back" href="#/${reviewing?'editor':'dashboard'}">← Back to ${reviewing?'editorial desk':'workspace'}</a><div class="section-heading"><div><span class="eyebrow">${reviewing?'EDITORIAL REVIEW':'YOUR ACHIEVEMENT'}</span><h1 class="page-title">${reviewing?'A closer look.':s?'Shape your story.':'Something worth sharing.'}</h1></div>${s?tag(s.status):tag('draft')}</div><div class="panel"><form id="story-form"><fieldset ${editable?'':'disabled'}>${field('Headline','headline',s?.headline,'required minlength="10" maxlength="120" placeholder="What did you achieve?"')}<div class="form-grid"><label>Achievement sector<select name="sector">${sectorOptions(s?.sector)}</select></label>${field('Achievement date','achievement_date',s?.achievement_date,'required type="date" max="'+new Date().toISOString().slice(0,10)+'"')}</div><label>Summary <span class="muted">30–600 characters</span><textarea name="summary" required minlength="30" maxlength="600" rows="3" placeholder="The achievement, its significance, and the people behind it.">${e(s?.summary)}</textarea></label><label>The full story <span class="muted">80–20,000 characters</span><textarea name="narrative" required minlength="80" maxlength="20000" rows="9" placeholder="Tell us how it happened. What challenge did you tackle? What changed? Why does it matter?">${e(s?.narrative)}</textarea></label><div class="form-grid">${field('Public author name','author_name',s?.author_name || profile?.display_name || user.user_metadata.display_name || '', 'required minlength="2" maxlength="100"')}${field('Institution / department','institution',s?.institution || 'University of Dhaka','required maxlength="200"')}</div>${field('Evidence link (optional)','evidence_url',s?.evidence_url,'type="url" maxlength="2048" placeholder="https://…"')}</fieldset>${editable?`<div class="actions"><button type="submit" class="button">Save draft ↗</button><span class="muted">Save before attaching evidence or submitting.</span></div>`:''}</form></div>${s?`<div class="panel evidence"><h3>Supporting evidence</h3><p class="muted">Files are private to you and the editorial team. PDF, JPEG, PNG or WebP, up to 5 MB each.</p><div id="files">Loading files…</div>${editable?'<form id="upload-form"><label>Attach evidence<input type="file" name="file" required accept=".pdf,.jpg,.jpeg,.png,.webp"></label><button type="submit" class="ghost">Upload file ↑</button></form>':''}</div><div class="panel"><h3>Review history</h3><div id="history">Loading review history…</div></div>`:''}</div><aside><div class="panel guidance"><span class="eyebrow">A STORY WORTH TELLING</span><h3>Start with the impact.</h3><p>Be specific. Include dates, names, outcomes and a source an editor can check.</p><hr><h4>Before you submit</h4><p>✓ A clear, factual headline<br>✓ Context and measurable impact<br>✓ Supporting links or documents<br>✓ Permission to publish the story</p><p class="fineprint">Automated fact-checking is not enabled. An editor reviews the evidence before publication. Contact details and evidence documents are never included in public story pages.</p>${s&&editable?'<button class="button full" id="submit-story" data-action>Submit for review ↗</button>':''}${reviewing && s?.owner_id===user.id?'<p class="fineprint">Another editor must review your own story.</p>':reviewing && s?.status==='submitted'?`<form id="review-form"><label>Editorial decision<select name="decision"><option value="approved">Approve</option><option value="changes_requested">Request changes</option><option value="rejected">Reject</option></select></label><label>Note to the author<textarea name="note" maxlength="4000" rows="4"></textarea></label><button class="button full" type="submit">Save decision</button></form>`:reviewing&&s?.status==='approved'?'<button class="button full" id="publish-story" data-action>Publish story ↗</button>':''}${s?.status==='published'?link(`#/story/${e(s.id)}`,'View published story ↗','button full'):''}</div></aside></section>`,'workspace');
 document.querySelector('#story-form').onsubmit=run(async ev=>{
  const payload=Object.fromEntries(new FormData(ev.target));Object.keys(payload).forEach(k=>payload[k]=payload[k].trim());const invalid=validateStory(payload);if(invalid) throw Error(invalid);
  if(s) check(await db.from('submissions').update(payload).eq('id',s.id));
  else {s=check(await db.from('submissions').insert(payload).select().single());}
  notice='Draft saved.';if(location.hash===`#/edit/${s.id}`) await route();else location.hash=`#/edit/${s.id}`;
 });
 if(s){loadExtras(s,editable);}
 document.querySelector('#submit-story')?.addEventListener('click',run(async()=>{check(await db.rpc('submit_story',{story_id:s.id}));notice='Submitted. Your story is now awaiting editorial review.';await route();}));
 document.querySelector('#review-form')?.addEventListener('submit',run(async ev=>{const f=new FormData(ev.target);check(await db.rpc('review_story',{story_id:s.id,decision:f.get('decision'),review_note:f.get('note')}));notice='Editorial decision saved.';await route();}));
 document.querySelector('#publish-story')?.addEventListener('click',run(async()=>{check(await db.rpc('review_story',{story_id:s.id,decision:'published',review_note:'Published after editorial approval.'}));notice='Story published.';await route();}));
 document.querySelector('#upload-form')?.addEventListener('submit',run(async ev=>{
  const file=new FormData(ev.target).get('file');if(!file?.size)throw Error('Choose a file.');if(file.size>5242880)throw Error('The file must be 5 MB or smaller.');
  if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a PDF, JPEG, PNG or WebP file.');
  const ext={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
  check(await db.storage.from('evidence').upload(`${user.id}/${s.id}/${crypto.randomUUID()}.${ext}`,file,{contentType:file.type,upsert:false}));notice='Evidence uploaded.';renderAlert();await loadExtras(s,editable);
 }));
}
async function loadExtras(s,editable) {
 try{
 const reviews=check(await db.from('reviews').select('decision,note,created_at').eq('submission_id',s.id).order('created_at'));
 if(active?.id!==s.id)return;
 document.querySelector('#history').innerHTML=reviews.length?reviews.map(r=>`<article class="history-item">${tag(r.decision)} <span class="muted">${date(r.created_at)}</span><p>${e(r.note)}</p></article>`).join(''):'<p class="muted">No review activity yet.</p>';
 const folder=`${s.owner_id}/${s.id}`;
 const files=check(await db.storage.from('evidence').list(folder));
 if(active?.id!==s.id || !document.querySelector('#files'))return;
 document.querySelector('#files').innerHTML=files.length?files.map(f=>`<div class="file-row"><span>▤ ${e(f.name)}</span><button class="ghost" data-file="${e(folder+'/'+f.name)}">Open ↗</button>${editable?`<button class="ghost" data-remove="${e(folder+'/'+f.name)}" aria-label="Remove file ${e(f.name)}">Remove</button>`:''}</div>`).join(''):'<p class="muted">No evidence files attached.</p>';
 document.querySelectorAll('[data-file]').forEach(b=>b.onclick=run(async()=>{const data=check(await db.storage.from('evidence').createSignedUrl(b.dataset.file,60));window.open(data.signedUrl,'_blank','noopener,noreferrer');}));
 document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=run(async()=>{if(!window.confirm('Remove this evidence file?'))return;check(await db.storage.from('evidence').remove([b.dataset.remove]));await loadExtras(s,editable);}));
 }catch(err){if(document.querySelector('#files'))document.querySelector('#files').textContent=err.message;}
}
function storyPage(s) {
 if(!s)throw Error('This story is not published or could not be found.');
 document.title=`${s.headline} — DAIN`;
 shell(`<article class="wrap article section"><a href="#/stories" class="back">← All achievements</a><div class="article-heading"><span class="eyebrow">${e(s.sector)}</span><h1>${e(s.headline)}</h1><p class="article-lead">${e(s.summary)}</p><div class="byline"><span class="avatar">${e(s.author_name.slice(0,1))}</span><div><strong>${e(s.author_name)}</strong><p>${e(s.institution)} · ${date(s.published_at)}</p></div><span class="tag published">Editorially reviewed</span></div></div><div class="article-body">${s.narrative.split(/\n\s*\n/).map(p=>`<p>${e(p).replaceAll('\n','<br>')}</p>`).join('')}</div><div class="panel press-kit"><span class="eyebrow">PRESS & SHARING</span><h2>Help this story travel.</h2><p class="muted">A concise summary, ready to share with your community.</p><blockquote>${e(s.summary)}</blockquote><div class="actions"><button id="copy-link" class="button">Copy story link ↗</button><button id="download-kit" class="ghost">Download press kit ↓</button><button id="print" class="ghost">Print story</button></div></div></article>`);
 document.querySelector('#copy-link').onclick=run(async()=>{await navigator.clipboard.writeText(location.href);notice='Story link copied.';renderAlert();});
 document.querySelector('#print').onclick=()=>window.print();
 document.querySelector('#download-kit').onclick=()=>{const text=`DAIN PRESS KIT\n\nHEADLINE\n${s.headline}\n\nEXECUTIVE SUMMARY\n${s.summary}\n\nSTORY\n${s.narrative}\n\nAUTHOR\n${s.author_name}, ${s.institution}\n\nACHIEVEMENT DATE\n${s.achievement_date}\n\nSOURCE\n${location.href}\n\nEditorially reviewed by DAIN. Private evidence and contact details are excluded.\n`;const u=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download=`dain-${s.id}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
}
function about() {
 shell(`<section class="wrap section narrow"><span class="eyebrow">ABOUT THE NETWORK</span><h1 class="page-title">Achievement becomes<br>inspiration when shared.</h1><p class="article-lead">DAIN is the DUNITE Achievement & Impact Network, built to document and celebrate the Dhaka University community.</p><div class="steps vertical"><article><span>01 / SHARE</span><h3>Your work deserves to be seen.</h3><p>Create an account with your DU email, write your achievement, and attach supporting evidence. Save a draft and return when you are ready.</p></article><article><span>02 / REVIEW</span><h3>Credibility comes first.</h3><p>An editor checks the story and its evidence. They may request changes before approval. Institutional email confirms access to that email address; it is not proof of every claim.</p></article><article><span>03 / PUBLISH</span><h3>Make it easy to share.</h3><p>Approved stories can be published with a public page and a downloadable press kit. Private evidence and account details remain private. Publication does not automatically distribute stories to newsrooms.</p></article></div>${link(user?'#/new':'#/auth/register','Share your achievement ↗','button')}</section>`);
}
async function route() {
 const id=++requestId;
 error='';active=null;document.title='DAIN — Achievement & Impact Network';
 const [page='',item] = location.hash.slice(2).split('/');
 try {
 if(['dashboard','new','edit','editor','review'].includes(page) && !user){authMode='login';auth();return;}
 if(['editor','review'].includes(page) && role==='member')throw Error('This area is available to assigned editors and administrators.');
 if(page==='auth'){authMode=item||'login';auth();return;}
 if(page==='password'){passwordPage();return;}
 if(page==='about'){about();return;}
 shell('<section class="wrap section"><p class="muted" role="status">Loading DAIN…</p></section>');
 if(page==='dashboard'||page==='editor'){
  let q=db.from('submissions').select('*').order('created_at',{ascending:false});if(page==='dashboard')q=q.eq('owner_id',user.id);
  const data=check(await q);if(id!==requestId)return;submissions=data;dashboard(page==='editor');
 } else if(page==='new'){editorForm();}
 else if(page==='edit'||page==='review'){
  const data=check(await db.from('submissions').select('*').eq('id',item).single());if(id!==requestId)return;
  if(page==='edit'&&data.owner_id!==user.id)throw Error('Open this story from the editorial desk.');editorForm(data,page==='review');
 } else if(page==='story') {
  const data=check(await db.from('stories').select('*').eq('id',item).single());if(id!==requestId)return;storyPage(data);
 } else {const data=check(await db.from('stories').select('*').order('published_at',{ascending:false}));if(id!==requestId)return;stories=data;home(page==='stories');}
 }catch(err){if(id!==requestId)return;error=err.message;shell(`<section class="wrap section narrow"><h1 class="page-title">We couldn’t open this page.</h1><p class="muted">Check your connection and access, then try again.</p><div class="actions"><button class="button" id="retry">Try again ↻</button>${link('#/','Back to DAIN','ghost')}</div></section>`);document.querySelector('#retry').onclick=()=>route();}
}
async function sessionChanged(session) {
 user=session?.user||null;role='member';profile=null;
 if(user){try{role=check(await db.rpc('my_role'));profile=check(await db.from('profiles').select('*').eq('id',user.id).maybeSingle());}catch(err){console.warn('Could not load account profile:',err.message);}}
 await route();
}
window.addEventListener('hashchange',()=>{notice='';route();window.scrollTo(0,0);});
db.auth.onAuthStateChange((event,session)=>{
 if(event==='PASSWORD_RECOVERY')location.hash='#/password';
 // Avoid awaiting Supabase calls inside its auth lock callback.
 setTimeout(()=>sessionChanged(session),0);
});
shell('<section class="wrap section"><p class="muted" role="status">Opening DAIN…</p></section>');
