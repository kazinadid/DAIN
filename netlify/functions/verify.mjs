import {authenticate,privileged,checked,json,readBody,env,timed} from '../lib/server.mjs';
import {createHash} from 'node:crypto';
import {signRun} from '../lib/worker-signature.mjs';
export default async req=>{
 if(req.method!=='POST')return json({detail:'POST required.'},405);
 let admin,runId;
 try{
  const {client,user}=await timed('auth',()=>authenticate(req));
  const role=checked(await client.rpc('my_role'));
  if(!user.email_confirmed_at||(role!=='admin'&&!/@(?:[a-z0-9-]+\.)*du\.ac\.bd$/i.test(user.email)))return json({detail:'A confirmed DU institutional email is required.'},403);
  const {submission_id}=await readBody(req);if(!/^[0-9a-f-]{36}$/i.test(submission_id||''))return json({detail:'A valid submission ID is required.'},422);
  const owner=await client.from('submissions').select('id,owner_id,status').eq('id',submission_id).eq('owner_id',user.id).single();
  if(owner.error||!owner.data)return json({detail:'Submission not found.'},404);
  if(owner.data.status!=='submitted')return json({detail:'Only submitted stories can be checked.'},409);
  const secret=env('VERIFICATION_WORKER_SECRET');if(secret.length<32)return json({detail:'Background checking is awaiting configuration. Your story remains saved for editorial review.'},503);
  admin=privileged();const story=checked(await admin.from('submissions').select('headline,summary,narrative,classification,impact,institution,achievement_date,evidence_url,verification').eq('id',submission_id).single());
  const fingerprint=createHash('sha256').update(JSON.stringify(['evidence-v2',env('GROQ_MODEL')||'openai/gpt-oss-120b',story.headline,story.summary,story.narrative,story.classification,story.impact,story.institution,story.achievement_date,story.evidence_url])).digest('hex');
  if(story.verification?.input_hash===fingerprint&&Date.now()-Date.parse(story.verification.checked_at)<900000){const previous=await admin.from('verification_runs').select('id,status').eq('submission_id',submission_id).not('completed_at','is',null).order('created_at',{ascending:false}).limit(1);if(previous.data?.length)return json({run_id:previous.data[0].id,cached:true},202);}
  const reserved=await timed('db_reserve_run',()=>admin.rpc('reserve_verification',{member_id:user.id,story_id:submission_id}));
  if(reserved.error)return json({detail:'Checking is already running or its retry/usage limit was reached. Your saved story is available to the editorial team.'},429);
  runId=reserved.data;const expires=Date.now()+300000;
  const worker=await fetch('https://dain-platform.netlify.app/api/verify-worker',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({run_id:runId,expires,signature:signRun(runId,expires,secret),input_hash:fingerprint}),signal:AbortSignal.timeout(10000)});
  if(worker.status!==202)throw Error('Worker queue unavailable.');
  return json({run_id:runId,status:'queued'},202);
 }catch(error){if(admin&&runId)await admin.from('verification_runs').update({status:'verification_pending',completed_at:new Date().toISOString()}).eq('id',runId);return json({detail:error.status?error.message:'Your story is saved, but automated checking could not be queued. Contact the editorial team.'},error.status||503);}
};
export const config={path:'/api/verify',rateLimit:{action:'rate_limit',aggregateBy:['ip','domain'],windowSize:60,windowLimit:10}};
