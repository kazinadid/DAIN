import {createClient} from '@supabase/supabase-js';
const url='https://hfxlcvigujvyuayhzhax.supabase.co';
const key='sb_publishable_FGN-XtMGVUZairpVWBx36w_LrHZRh6O';
const db=createClient(url,key);
const check=r=>{if(r.error)throw r.error;return r.data;};
const sectorMap={Academic:'Academic & Research',Professional:'Professional & Corporate',Entrepreneurial:'Entrepreneurship & Startups','Social Impact':'Social Impact & Community',Personal:'Personal Milestones'};
const reverse=Object.fromEntries(Object.entries(sectorMap).map(([k,v])=>[v,k]));
let session=null;
const entryHash=location.hash;
window.DAIN_API_BASE=location.origin+'/api';
async function account(){
 session=check(await db.auth.getSession()).session;
 if(!session)return null;
 const user=check(await db.auth.getUser()).user;
 const role=check(await db.rpc('my_role'));
 const profile=check(await db.from('profiles').select('*').eq('id',user.id).maybeSingle());
 return {name:profile?.display_name||user.user_metadata.display_name||user.email.split('@')[0],email:user.email,role:role==='admin'?'Admin':role==='editor'?'Editor':'Student',institution:profile?.department||'University of Dhaka',isVerified:!!user.email_confirmed_at,isLoggedIn:true};
}
const ready=db.auth.getSession().then(r=>{session=check(r).session;});
db.auth.onAuthStateChange((_event,next)=>{session=next;});
function mapped(s,published=false){return {id:s.id,headline:s.headline,summary:s.summary,category:reverse[s.sector]||s.sector,subType:s.classification||'',date:s.achievement_date,author:s.author_name,institution:s.institution,status:published||s.status==='published'?'Approved':s.status==='rejected'?'Rejected':'Pending Review',detailedStory:s.narrative,reach:0,verification:s.verification,evidenceLink:s.evidence_url||'',rawStatus:s.status};}
async function list(){
 const published=check(await db.from('stories').select('*').order('published_at',{ascending:false}));
 const all=published.map(s=>mapped(s,true));
 if(session){const privateRows=check(await db.from('submissions').select('*').order('created_at',{ascending:false}));for(const s of privateRows)if(!all.some(p=>p.id===s.id))all.push(mapped(s));}
 return all;
}
async function api(path,body){
 session=check(await db.auth.getSession()).session;if(!session)throw Error('Sign in with a confirmed account first.');
 const response=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify(body)});
 const data=await response.json();if(!response.ok)throw Error(data.detail||'Request failed.');return data;
}
window.DAIN={ready,entryHash,account,list,
 async login(email,password){check(await db.auth.signInWithPassword({email,password}));return account();},
 async register(name,email,password){const d=check(await db.auth.signUp({email,password,options:{data:{display_name:name},emailRedirectTo:location.origin}}));if(d.session)return account();return null;},
 async verify(email,token){check(await db.auth.verifyOtp({email,token,type:'signup'}));return account();},
 async logout(){check(await db.auth.signOut());session=null;},
 async submit(payload){
  const user=check(await db.auth.getUser()).user;if(!user)throw Error('Sign in first.');
  if(user.email.toLowerCase()!==payload.authorEmail.toLowerCase())throw Error('The author email must match your confirmed account.');
  const person=await account();
  const s=check(await db.from('submissions').insert({headline:payload.headline,summary:payload.summary,narrative:payload.summary,sector:sectorMap[payload.category],achievement_date:payload.achievementDate,evidence_url:payload.evidenceLink,author_name:person.name,institution:payload.institution,classification:payload.subType,impact:payload.impact,syndication_consent:true}).select().single());
  check(await db.rpc('submit_story',{story_id:s.id}));
  let verification;
  try{verification=await api('verify',{submission_id:s.id});}
  catch(err){verification={status:'verification_pending',reason:err.message,claims:[],stages:[{id:'identity',status:'passed',detail:'Confirmed institutional account.'},{id:'editorial',status:'held',detail:err.message},{id:'routing',status:'held',detail:'Editorial approval required.'}]};}
  return {...verification,submission_id:s.id};
 },
 async publish(id){
  const s=check(await db.from('submissions').select('status').eq('id',id).single());
  if(s.status==='submitted')check(await db.rpc('review_story',{story_id:id,decision:'approved',review_note:'Editorially reviewed and approved.'}));
  check(await db.rpc('review_story',{story_id:id,decision:'published',review_note:'Published by the editorial board.'}));
  const queued=check(await db.rpc('queue_distribution',{story_id:id}));return queued;
 },
 async distribution(){
  const me=await account();if(!['Admin','Editor'].includes(me?.role))return {staff:false,newsrooms:[],jobs:[]};
  const newsrooms=check(await db.from('newsrooms').select('id,name,tier,active,approved_at'));
  const jobs=check(await db.from('distribution_jobs').select('id,story_id,newsroom_id,status,provider_id,attempts,last_error,created_at').order('created_at',{ascending:false}));
  return {staff:true,newsrooms,jobs};
 },
 async queue(id){return check(await db.rpc('queue_distribution',{story_id:id}));}
};
