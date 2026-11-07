import fs from 'node:fs/promises';
import {build} from 'vite';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import forms from '@tailwindcss/forms';
import containers from '@tailwindcss/container-queries';
import sharp from 'sharp';
const original=await fs.readFile('frontend/original.html','utf8');
const start=original.lastIndexOf('<script>'),end=original.indexOf('</script>',start);
let js=original.slice(start+8,end);
function replace(a,b){if(!js.includes(a))throw Error('Missing frontend integration anchor: '+a.slice(0,80));js=js.replace(a,b);}
function section(a,b,content){const i=js.indexOf(a),j=js.indexOf(b,i);if(i<0||j<0)throw Error('Missing integration section '+a);js=js.slice(0,i)+content+'\n\n      '+js.slice(j);}
replace('(() => {','(async () => {');replace('"use strict";','"use strict";\n      ');
replace('let stories = JSON.parse(localStorage.getItem("dain_stories")) || seedStories;','let stories = [];');
section('let savedUser = null;','let currentUser =','const savedUser = null;');
section('window.handleSignOut = function() {','window.handleLoginSubmit =',`window.handleSignOut = async function() {
        try {await DAIN.logout();sessionStorage.removeItem('dain_api_session');localStorage.removeItem('dain_user');location.reload();}catch(error){showToast(error.message,'error');}
      };`);
section('window.handleLoginSubmit =','window.loginAsDemo =',`window.handleLoginSubmit = async function(event) {
        event.preventDefault();const button=event.target.querySelector('[type=submit]');button.disabled=true;
        try{const user=await DAIN.login(document.getElementById('login-email').value.trim(),document.getElementById('login-password').value);stories=await DAIN.list();completeAuthSuccess(user,user.role==='Admin'?'admin':'home');}
        catch(error){showToast(error.message,'error');}finally{button.disabled=false;}
      };
      window.handleRegisterSubmit = async function(event) {
        event.preventDefault();const button=event.target.querySelector('[type=submit]');button.disabled=true;
        try{const email=document.getElementById('register-email').value.trim();const user=await DAIN.register(document.getElementById('register-name').value.trim(),email,document.getElementById('register-password').value);
          if(user){completeAuthSuccess(user);return;}pendingRegistrationEmail=email;document.getElementById('verify-email-address').textContent=email;setAuthTab('verify');showToast('Check your email and enter the verification code.','mark_email_read');
        }catch(error){showToast(error.message,'error');}finally{button.disabled=false;}
      };
      window.handleVerifyEmailSubmit = async function(event) {
        event.preventDefault();try{const user=await DAIN.verify(pendingRegistrationEmail||document.getElementById('register-email').value.trim(),document.getElementById('verify-email-token').value.trim());completeAuthSuccess(user);}catch(error){showToast(error.message,'error');}
      };`);
section('window.loginAsDemo =','window.switchView =',`window.loginAsDemo = function(){showToast('Demo access cannot create a real session. Please sign in with your account.','lock');};\n      `);
// Remote data replaces local simulations; the original rendering functions remain intact.
section('window.approveAdminStory =','// Modal Dialog',`window.approveAdminStory = async function(id) {
        try{const queued=await DAIN.publish(id);stories=await DAIN.list();renderAdminSubmissions();showToast('Published. '+queued+' approved newsroom deliveries queued; sending is disabled.','verified');}catch(error){showToast(error.message,'error');}
      };\n      `);
section('async function requestStoryVerification(payload) {','function createStoryId()',`async function requestStoryVerification(payload) { return window.DAIN.submit(payload); }\n      `);
replace('const status = verification.status === "verified" ? "Approved" : (verification.status === "rejected" ? "Rejected" : "Pending Review");','const status = "Pending Review";');
replace('id: createStoryId(), headline: payload.headline, summary: payload.summary,','id: verification.submission_id, headline: payload.headline, summary: payload.summary,');
replace('localStorage.setItem("dain_stories", JSON.stringify([newStory, ...stories]));','// Submission and AI results were persisted by the backend.');
replace('stories.unshift(newStory);','stories = await DAIN.list();');
replace('showToast("Story submitted and syndicated to 100+ media outlets!", "verified");','showToast("Story published. Distribution status is shown in the media network.", "verified");');
replace("story.authorEmail || 'contact@du.ac.bd'","story.authorEmail || 'Contact not shared'");
// Refresh remote records and the existing status panels without changing source markup or CSS.
replace('if (viewName === "admin") renderAdminSubmissions();',`if (viewName === "admin") renderAdminSubmissions();
        if (viewName === 'distribution') renderDistributionStatus();`);
replace('// Restore saved user session & draft on load',`async function renderDistributionStatus(){
        try{const data=await DAIN.distribution();let panel=document.getElementById('distribution-live-status');if(!panel){panel=document.createElement('div');panel.id='distribution-live-status';panel.className='p-5 rounded-3xl bg-white border border-border-light shadow-apple space-y-2';document.getElementById('view-distribution').append(panel);}
        panel.innerHTML='<p class="font-bold text-sm">Distribution is disabled</p><p class="text-xs text-on-surface-variant">No newsroom emails are being sent. Approved recipients and sender configuration are required.</p>'+(data.staff?'<p class="text-xs font-mono">'+data.newsrooms.length+' configured newsrooms · '+data.jobs.length+' delivery jobs</p>'+data.jobs.map(j=>'<p class="text-xs font-mono">'+escapeHTML(j.story_id)+' · '+escapeHTML(j.status)+' · attempts '+j.attempts+'</p>').join(''):'');
        }catch(error){showToast(error.message,'error');}
      }
      DAIN.ready.then(async()=>{const user=await DAIN.account();if(user)applyUserSession(user);stories=await DAIN.list();renderHomeFeatured();}).catch(error=>showToast(error.message,"error"));
      document.getElementById('verify-email-token').minLength=6;
      document.querySelectorAll('#view-analytics .text-2xl').forEach(el=>el.textContent='Not tracked');
      if(DAIN.entryHash.startsWith('#/auth'))openAuthModal(DAIN.entryHash.includes('register')?'register':'login');
      // Restore saved user session & draft on load`);
replace('window.switchView = function(viewName, skipHistory = false) {',`window.switchView = function(viewName, skipHistory = false) {
 if(viewName==='admin' && currentUser.role!=='Admin'){showToast('Only administrators can open Editorial Review.','error');return;}`);
replace("s.status === 'Pending Review' ?", "s.status === 'Pending Review' && currentUser.role === 'Admin' ?");
replace('// Restore saved user session & draft on load',`
      const oldToast=window.showToast;
      window.showToast=function(message,icon){oldToast(message,icon);const dialog=document.getElementById('auth-modal');if(dialog.open){let status=document.getElementById('auth-status');if(!status){status=document.createElement('p');status.id='auth-status';status.className='p-3 text-sm text-red-700 bg-red-50 rounded-xl';status.setAttribute('role','alert');dialog.append(status);}status.textContent=message;}};
      function syncAccess(){document.querySelectorAll('[data-view="admin"]').forEach(el=>el.style.display=currentUser.role==='Admin'?'':'none');}
      const oldApply=window.applyUserSession;window.applyUserSession=function(user){oldApply(user);syncAccess();};syncAccess();
      const loginForm=document.getElementById('auth-form-login');
      const forgot=document.createElement('button');forgot.type='button';forgot.className='text-xs text-dunite-red mt-3';forgot.textContent='Forgot password?';loginForm.append(forgot);
      forgot.onclick=()=>{let recovery=document.getElementById('recovery-form');if(recovery){recovery.hidden=!recovery.hidden;return;}
       recovery=document.createElement('form');recovery.id='recovery-form';recovery.className='space-y-3 mt-4';
       recovery.innerHTML='<label>Email<input name="email" type="email" required class="w-full p-3 border rounded-xl"></label><button type="button" class="text-dunite-red">Send reset code</button><label>Reset code<input name="code" required autocomplete="one-time-code" class="w-full p-3 border rounded-xl"></label><label>New password<input name="password" type="password" required minlength="12" autocomplete="new-password" class="w-full p-3 border rounded-xl"></label><button type="submit" class="bg-dunite-red text-white p-3 rounded-xl">Reset password</button>';
       loginForm.after(recovery);recovery.elements.email.value=document.getElementById('login-email').value;
       recovery.querySelector('[type=button]').onclick=async()=>{try{if(!recovery.elements.email.checkValidity())throw Error('Enter a valid email address.');await DAIN.forgot(recovery.elements.email.value.trim());showToast('If this account exists, a reset code has been sent.','mail');}catch(error){showToast(error.message,'error');}};
       recovery.onsubmit=async event=>{event.preventDefault();try{await DAIN.reset(recovery.elements.email.value.trim(),recovery.elements.code.value.trim(),recovery.elements.password.value);showToast('Password updated. Sign in with your new password.','verified');recovery.hidden=true;}catch(error){showToast(error.message,'error');}};
      };
      const own=document.createElement('button');own.className='nav-item w-full px-3 py-2 text-left text-xs';own.textContent='My submissions';document.querySelector('[data-view="stories"]').after(own);
      own.onclick=async()=>{try{const mine=await DAIN.mine();enterAppWorkspace('stories');setTimeout(()=>{document.getElementById('stories-directory-grid').innerHTML=mine.map(s=>'<div class="p-4 border rounded-xl"><h3>'+escapeHTML(s.headline)+'</h3><p>'+escapeHTML(s.rawStatus)+'</p><p>'+escapeHTML(s.summary)+'</p></div>').join('')||'<p>No submissions yet.</p>';},300);}catch(error){showToast(error.message,'error');}};
      // Restore saved user session & draft on load`);
const output=original.slice(0,start+8)+js+original.slice(end);
// Protect the exact retained design: all HTML/CSS outside the application script is identical.
if(output.slice(0,start)!==original.slice(0,start)||output.slice(output.lastIndexOf('</script>'))!==original.slice(original.lastIndexOf('</script>')))throw Error('Original frontend markup changed');
await build({configFile:false,build:{outDir:'dist',emptyOutDir:true,lib:{entry:'src/bridge.js',name:'DAINIntegration',formats:['iife'],fileName:()=> 'api-config.js'}}});
await fs.cp('assets','dist/assets',{recursive:true});
const context={tailwind:{}};vm.runInNewContext(original.match(/<script>\s*(tailwind.config[\s\S]*?)<\/script>/)[1],context);
const css=await postcss([tailwind({...context.tailwind.config,content:[{raw:output,extension:'html'}],plugins:[forms,containers]})]).process('@tailwind base;@tailwind components;@tailwind utilities;',{from:undefined});
const cssName='ui-'+createHash('sha256').update(css.css).digest('hex').slice(0,12)+'.css';
await fs.writeFile('dist/assets/'+cssName,css.css);
await sharp('assets/dunite-logo.png').resize({width:320,withoutEnlargement:true}).webp({quality:85}).toFile('dist/assets/dunite-logo.webp');
const optimized=output.replace('<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>', '<link rel="stylesheet" href="assets/'+cssName+'">').replace(/<script>\s*tailwind.config[\s\S]*?<\/script>/,'').replaceAll('assets/dunite-logo.png','assets/dunite-logo.webp');
await fs.writeFile('dist/index.html',optimized.replace('<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/mortezaom/google-sans-cdn@master/fonts.css" />','<link rel="preload" href="assets/fonts/ProductSans-Regular.woff2" as="font" type="font/woff2" crossorigin>'));
console.log('Original frontend source SHA-256:',createHash('sha256').update(original).digest('hex'));
