import fs from 'node:fs/promises';
import {build} from 'vite';
import {createHash} from 'node:crypto';
const original=await fs.readFile('frontend/original.html','utf8');
const start=original.lastIndexOf('<script>'),end=original.indexOf('</script>',start);
let js=original.slice(start+8,end);
function replace(a,b){if(!js.includes(a))throw Error('Missing frontend integration anchor: '+a.slice(0,80));js=js.replace(a,b);}
function section(a,b,content){const i=js.indexOf(a),j=js.indexOf(b,i);if(i<0||j<0)throw Error('Missing integration section '+a);js=js.slice(0,i)+content+'\n\n      '+js.slice(j);}
replace('(() => {','(async () => {');replace('"use strict";','"use strict";\n      await window.DAIN.ready;');
replace('let stories = JSON.parse(localStorage.getItem("dain_stories")) || seedStories;','let stories = [];');
section('let savedUser = null;','let currentUser =','const savedUser = await window.DAIN.account();');
section('window.handleSignOut = function() {','window.handleLoginSubmit =',`window.handleSignOut = async function() {
        try {await DAIN.logout();sessionStorage.removeItem('dain_api_session');localStorage.removeItem('dain_user');location.reload();}catch(error){showToast(error.message,'error');}
      };`);
section('window.handleLoginSubmit =','window.loginAsDemo =',`window.handleLoginSubmit = async function(event) {
        event.preventDefault();const button=event.target.querySelector('[type=submit]');button.disabled=true;
        try{const user=await DAIN.login(document.getElementById('login-email').value.trim(),document.getElementById('login-password').value);stories=await DAIN.list();completeAuthSuccess(user,['Admin','Editor'].includes(user.role)?'admin':'home');}
        catch(error){showToast(error.message,'error');}finally{button.disabled=false;}
      };
      window.handleRegisterSubmit = async function(event) {
        event.preventDefault();const button=event.target.querySelector('[type=submit]');button.disabled=true;
        try{const email=document.getElementById('register-email').value.trim();const user=await DAIN.register(document.getElementById('register-name').value.trim(),email,document.getElementById('register-password').value);
          if(user){completeAuthSuccess(user);return;}pendingRegistrationEmail=email;document.getElementById('verify-email-address').textContent=email;setAuthTab('verify');showToast('Check your email. Confirm with its link, or enter the signup code if your email includes one.','mark_email_read');
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
      stories=await DAIN.list();
      document.getElementById('verify-email-token').minLength=6;
      document.querySelectorAll('#view-analytics .text-2xl').forEach(el=>el.textContent='Not tracked');
      if(DAIN.entryHash.startsWith('#/auth'))openAuthModal(DAIN.entryHash.includes('register')?'register':'login');
      // Restore saved user session & draft on load`);
const output=original.slice(0,start+8)+js+original.slice(end);
// Protect the exact retained design: all HTML/CSS outside the application script is identical.
if(output.slice(0,start)!==original.slice(0,start)||output.slice(output.lastIndexOf('</script>'))!==original.slice(original.lastIndexOf('</script>')))throw Error('Original frontend markup changed');
await build({configFile:false,build:{outDir:'dist',emptyOutDir:true,lib:{entry:'src/bridge.js',name:'DAINIntegration',formats:['iife'],fileName:()=> 'api-config.js'}}});
await fs.writeFile('dist/index.html',output);
await fs.cp('assets','dist/assets',{recursive:true});
console.log('Original frontend source SHA-256:',createHash('sha256').update(original).digest('hex'));
