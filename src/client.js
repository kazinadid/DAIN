import {AuthClient} from '@supabase/auth-js';
import {PostgrestClient} from '@supabase/postgrest-js';
import {config} from './config.js';
import {normalizeEvidence,submissionMessage} from './submission-errors.js';
import {installUI} from './ui-runtime.js';
import {captchaToken as getCaptcha,installCaptcha} from './captcha.js';
const auth=new AuthClient({url:config.url+'/auth/v1',headers:{apikey:config.key},storageKey:'sb-'+new URL(config.url).hostname.split('.')[0]+'-auth-token',autoRefreshToken:true,persistSession:true,detectSessionInUrl:false});
const rest=new PostgrestClient(config.url+'/rest/v1',{headers:{apikey:config.key},fetch:async(input,init={})=>{const s=await auth.getSession();const headers=new Headers(init.headers);if(s.data.session)headers.set('Authorization','Bearer '+s.data.session.access_token);return fetch(input,{...init,headers});}});
const check=r=>{if(r.error)throw Object.assign(new Error(submissionMessage(r.error)),{code:r.error.code});return r.data;};
const map={Academic:'Academic & Research',Professional:'Professional & Corporate',Entrepreneurial:'Entrepreneurship & Startups','Social Impact':'Social Impact & Community',Personal:'Personal Milestones'};
const reverse=Object.fromEntries(Object.entries(map).map(([k,v])=>[v,k]));
export const labels={draft:'Draft',submitted:'Submitted',changes_requested:'Changes requested',approved:'Approved',rejected:'Rejected',published:'Published'};
const summaryCols='id,headline,summary,sector,author_name,institution,achievement_date,published_at';
const ownCols='id,owner_id,headline,summary,sector,author_name,institution,achievement_date,status,created_at,updated_at';
const detailCols=ownCols+',narrative,evidence_url,classification,impact,syndication_consent';
let cachedAccount=null,accountExpiry=0,accountPromise=null;
const entryHash=location.hash;
const ready=auth.getSession();
auth.onAuthStateChange(()=>{cachedAccount=null;accountExpiry=0;accountPromise=null;});
function mapped(s,published=false){const raw=published?'published':s.status;return {...s,category:reverse[s.sector]||s.sector,subType:s.classification||'',date:s.achievement_date,author:s.author_name,status:labels[raw]||raw,rawStatus:raw,detailedStory:s.narrative||'',reach:0,evidenceLink:s.evidence_url||''};}
async function account(force=false){
 if(!force&&cachedAccount&&Date.now()<accountExpiry)return cachedAccount;
 if(!force&&accountPromise)return accountPromise;
 accountPromise=(async()=>{await ready;const session=check(await auth.getSession()).session;if(!session)return null;
 const user=check(await auth.getUser()).user;
 const [role,profile]=await Promise.all([rest.rpc('my_role').then(check),rest.from('profiles').select('display_name,department').eq('id',user.id).maybeSingle().then(check)]);
 const value={id:user.id,name:profile?.display_name||user.user_metadata.display_name||'DU Member',email:user.email,role:role==='admin'?'Admin':'Student',institution:profile?.department||'University of Dhaka',isVerified:!!user.email_confirmed_at,isLoggedIn:true};
 cachedAccount=value;accountExpiry=Date.now()+15000;return value;})();
 try{return await accountPromise;}finally{accountPromise=null;}
}
async function page(table,columns,pageNumber=0,owner=false,sector=null,query=''){let q=rest.from(table).select(columns,{count:'exact'}).order(table==='stories'?'published_at':'created_at',{ascending:false}).range(pageNumber*20,pageNumber*20+19);if(sector)q=q.eq('sector',map[sector]||sector);if(query)q=q.ilike('headline','%'+query.replace(/[\\%_]/g,'\\$&')+'%');if(owner){const me=await account();if(!me)throw Error('Sign in to view your submissions.');q=q.eq('owner_id',me.id);}const r=await q;check(r);return {rows:r.data.map(s=>mapped(s,table==='stories')),count:r.count||0,page:pageNumber};}
async function list(){const me=await account();const rs=await Promise.all([page('stories',summaryCols),me?page('submissions',ownCols,0,me.role!=='Admin'):Promise.resolve({rows:[]})]);return [...new Map(rs.flatMap(r=>r.rows).map(s=>[s.id,s])).values()];}
async function api(path,body){const s=check(await auth.getSession()).session;if(!s)throw Error('Sign in first.');const r=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.access_token},body:JSON.stringify(body)});let data;try{data=await r.json();}catch{throw Error('The server returned an unreadable response. Your saved story is safe.');}if(!r.ok)throw Error(data.detail||'The request failed.');return data;}
function payloadOf(p,person){const narrative=String(p.narrative||'').trim();if(narrative.length<80||narrative.length>20000)throw Error('The full story must contain 80 to 20,000 characters.');return {headline:p.headline.trim(),summary:p.summary.trim(),narrative,sector:map[p.category]||p.sector,achievement_date:p.achievementDate||p.achievement_date,evidence_url:normalizeEvidence(p.evidenceLink??p.evidence_url),author_name:person.name,institution:p.institution.trim(),classification:p.subType||p.classification||'',impact:p.impact||'',certified:!!p.certified,syndication_consent:!!p.syndication_consent};}
async function submit(p){const me=await account();if(!me)throw Error('Sign in first.');if(!me.isVerified||(me.role!=='Admin'&&!/@(?:[a-z0-9-]+\.)*du\.ac\.bd$/i.test(me.email)))throw Error('A confirmed DU institutional account is required to submit stories. Please confirm your email before submitting.');if(p.authorEmail&&p.authorEmail.toLowerCase()!==me.email.toLowerCase())throw Error('The author email must match your signed-in account.');const payload=payloadOf(p,me);const requestId=p.request_id||crypto.randomUUID();let sid;
 try{sid=check(await rest.rpc('create_and_submit_story',{request_id:requestId,payload}));}catch(error){if(error.code==='PGRST202')throw Error('The database workflow upgrade is awaiting release. Your form is kept; contact the administrator.');throw error;}
 let accepted;try{accepted=await api('verify',{submission_id:sid});}catch(error){accepted={queue_error:error.message};}
 return {status:'verification_pending',reason:accepted.queue_error||'Saved. Automated checking is running in the background.',claims:[],submission_id:sid,run_id:accepted.run_id,queue_error:accepted.queue_error,stages:[{id:'identity',status:'passed',detail:'Confirmed author account.'},{id:'editorial',status:'held',detail:accepted.queue_error||'Saved for checking and editorial review.'},{id:'routing',status:'held',detail:'Publication approval required. No newsroom email sent.'}]};
}
async function poll(runId,onState,signal){const deadline=Date.now()+90000;while(Date.now()<deadline&&!signal?.aborted){const r=check(await rest.from('verification_runs').select('id,status,completed_at').eq('id',runId).single());onState(r);if(!['queued','running'].includes(r.status))return r;await new Promise(resolve=>{const timer=setTimeout(resolve,3000);signal?.addEventListener('abort',()=>{clearTimeout(timer);resolve();},{once:true});});}if(!signal?.aborted)onState({status:'timeout'});return null;}
const DAIN={ready,entryHash,account,list,labels,
 async login(email,password,token){const captchaToken=token||await getCaptcha('auth-form-login');check(await auth.signInWithPassword({email,password,options:{captchaToken}}));return account(true);},
 async register(name,email,password,token){const captchaToken=token||await getCaptcha('auth-form-register');const d=check(await auth.signUp({email,password,options:{data:{display_name:name},captchaToken}}));return d.session?account(true):null;},
 async verify(email,token){check(await auth.verifyOtp({email,token,type:'signup'}));return account(true);},
 async forgot(email,token){const captchaToken=token||await getCaptcha('recovery-form');check(await auth.resetPasswordForEmail(email,{captchaToken}));},
 async reset(email,token,password){check(await auth.verifyOtp({email,token,type:'recovery'}));check(await auth.updateUser({password}));check(await auth.signOut({scope:'global'}));},
 async logout(){check(await auth.signOut());},
 submit,poll,api,publicPage:(p,sector,query)=>page('stories',summaryCols,p,false,sector,query),myPage:p=>page('submissions',ownCols,p,true),adminPage:p=>page('submissions',ownCols,p),mine:async()=> (await page('submissions',ownCols,0,true)).rows,
 async detail(id,published=false){return mapped(check(await rest.from(published?'stories':'submissions').select(published?summaryCols+',narrative':detailCols).eq('id',id).single()),published);},
 async history(id){return check(await rest.from('reviews').select('decision,note,created_at').eq('submission_id',id).order('created_at'));},
 async adminAI(id){return check(await rest.rpc('admin_verification',{story_id:id}));},
 async review(id,decision,note){return check(await rest.rpc('review_story',{story_id:id,decision,review_note:note}));},
 async publish(id){return DAIN.review(id,'published','Publication confirmed by administrator.');},
 async unpublish(id,note){return check(await rest.rpc('unpublish_story',{story_id:id,review_note:note}));},
 async deleteDraft(id){return check(await rest.rpc('delete_own_draft',{story_id:id}));},
 async resubmit(id,p){const me=await account();check(await rest.rpc('resubmit_story',{story_id:id,payload:payloadOf(p,me)}));try{return await api('verify',{submission_id:id});}catch(error){return {queue_error:error.message};}},
 async distribution(){const me=await account();if(me?.role!=='Admin')return {staff:false,newsrooms:[],jobs:[]};return {staff:true,newsrooms:check(await rest.from('newsrooms').select('id,name,tier,active,approved_at').range(0,19)),jobs:check(await rest.from('distribution_jobs').select('id,story_id,status,attempts,created_at').order('created_at',{ascending:false}).range(0,19))};},
 async queue(id){return check(await rest.rpc('queue_distribution',{story_id:id}));},
};
window.DAIN=DAIN;window.DAIN_API_BASE=location.origin+'/api';window.installDAINUI=hooks=>{installCaptcha();return installUI(DAIN,hooks);};
