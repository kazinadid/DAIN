import {authenticate,privileged,checked,json,readBody,env} from '../lib/server.mjs';
import {verifyStory,result} from '../lib/verification.mjs';
export default async req=>{
 if(req.method!=='POST')return json({detail:'POST required.'},405);
 let admin,runId,story;
 try{
  const {client,user}=await authenticate(req);
  if(!user.email_confirmed_at||!/@(?:[a-z0-9-]+\.)*du\.ac\.bd$/i.test(user.email))return json({detail:'A confirmed DU institutional email is required.'},403);
  const {submission_id}=await readBody(req);if(!/^[0-9a-f-]{36}$/i.test(submission_id||''))return json({detail:'A valid submission ID is required.'},422);
  const r=await client.from('submissions').select('*').eq('id',submission_id).eq('owner_id',user.id).single();
  if(r.error||!r.data)return json({detail:'Submission not found.'},404);story=r.data;
  if(story.status!=='submitted')return json({detail:'Submit the story for review before verifying.'},409);
  admin=privileged();const reservation=await admin.rpc('reserve_verification',{member_id:user.id,story_id:story.id});
  if(reservation.error)return json({detail:'Verification is already running or the rate limit was reached. Try again in a minute.'},429);
  runId=reservation.data;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),28000);
  let verification;try{verification=await verifyStory(story,{groqKey:env('GROQ_API_KEY'),tavilyKey:env('TAVILY_API_KEY'),model:env('GROQ_MODEL')||'openai/gpt-oss-120b',signal:controller.signal});}finally{clearTimeout(timer);}
  checked(await admin.from('verification_runs').update({status:verification.status,result:verification,completed_at:new Date().toISOString()}).eq('id',runId));
  checked(await admin.from('submissions').update({verification}).eq('id',story.id));
  return json(verification);
 }catch(error){if(admin&&runId)await admin.from('verification_runs').update({status:'verification_pending',result:result('verification_pending','A server error interrupted verification.'),completed_at:new Date().toISOString()}).eq('id',runId);return json({detail:error.status?error.message:'Verification could not be completed. The saved submission remains in editorial review.'},error.status||503);}
};
export const config={path:'/api/verify',rateLimit:{action:'rate_limit',aggregateBy:['ip','domain'],windowSize:60,windowLimit:10}};
