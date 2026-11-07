import {privileged,checked,readBody,env,timed,json} from '../lib/server.mjs';
import {verifyRun,storyHash} from '../lib/worker-signature.mjs';
import {verifyStory,result} from '../lib/verification.mjs';
export default async req=>{
 if(req.method!=='POST')return json({detail:'POST required.'},405);
 let admin,run;
 try{
  const body=await readBody(req);if(!verifyRun(body.run_id,body.expires,body.signature,env('VERIFICATION_WORKER_SECRET')))return json({detail:'Invalid worker authorization.'},403);
  admin=privileged();const claimed=checked(await timed('db_claim_run',()=>admin.from('verification_runs').update({status:'running'}).eq('id',body.run_id).eq('status','queued').select('id,user_id,submission_id')));
  if(claimed.length!==1)return json({detail:'Run already claimed or missing.'},409);run=claimed[0];
  const story=checked(await timed('db_worker_story',()=>admin.from('submissions').select('*').eq('id',run.submission_id).eq('owner_id',run.user_id).single()));
  if(story.status!=='submitted')throw Error('Submission state changed before verification.');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),28000);let verification;
  try{verification=await verifyStory(story,{groqKey:env('GROQ_API_KEY'),tavilyKey:env('TAVILY_API_KEY'),model:env('GROQ_MODEL')||'openai/gpt-oss-120b',signal:controller.signal});}finally{clearTimeout(timer);}
  verification.checked_at=new Date().toISOString();verification.input_hash=storyHash(story,env('GROQ_MODEL'));
  checked(await timed('db_complete_run',()=>admin.from('verification_runs').update({status:verification.status,result:verification,completed_at:new Date().toISOString()}).eq('id',run.id)));
  // Do not overwrite a story that left the submitted state during the paid request.
  checked(await timed('db_complete_story',()=>admin.from('submissions').update({verification}).eq('id',story.id).eq('status','submitted')));
  return json({completed:true});
 }catch(error){if(admin&&run)await admin.from('verification_runs').update({status:'verification_pending',result:result('verification_pending','Checking was interrupted. An administrator can review the saved story.'),completed_at:new Date().toISOString()}).eq('id',run.id);return json({detail:'Worker could not complete.'},503);}
};
export const config={path:'/api/verify-worker',background:true};
