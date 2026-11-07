import {authenticate,privileged,checked,json,readBody,env} from '../lib/server.mjs';
import {sendRelease} from '../lib/delivery.mjs';
// Owner explicitly requested that newsroom sends remain disabled. This cannot be enabled by a browser request or environment variable.
const SENDS_ENABLED=false;
export default async req=>{
 if(req.method!=='POST')return json({detail:'POST required.'},405);
 try{
  const {client}=await authenticate(req);if(!checked(await client.rpc('admin_session')))return json({detail:'Administrator access is required.'},403);
  if(!SENDS_ENABLED)return json({detail:'Newsroom sending is disabled. Queue preparation is available; no email was sent.',enabled:false},409);
  const {job_id}=await readBody(req);const admin=privileged();
  const job=checked(await admin.from('distribution_jobs').select('*').eq('id',job_id).single());
  const newsroom=checked(await admin.from('newsrooms').select('*').eq('id',job.newsroom_id).single());
  const story=checked(await admin.from('stories').select('*').eq('id',job.story_id).single());
  const source=checked(await admin.from('submissions').select('syndication_consent').eq('id',story.id).single());
  if(!source.syndication_consent||!newsroom.active||!newsroom.approved_at)return json({detail:'Recipient approval and author consent are required.'},403);
  if(!env('RESEND_API_KEY')||!env('NEWSROOM_FROM_EMAIL'))return json({detail:'Verified email sender is not configured.'},503);
  if(!checked(await admin.rpc('claim_distribution',{job_id:job.id})))return json({detail:'Job already claimed or retry limit reached.'},409);
  try{const providerId=await sendRelease({job,newsroom,story,apiKey:env('RESEND_API_KEY'),from:env('NEWSROOM_FROM_EMAIL'),origin:'https://dain-platform.netlify.app'});
   checked(await admin.from('distribution_jobs').update({status:'accepted',provider_id:providerId,last_error:null,updated_at:new Date().toISOString()}).eq('id',job.id));return json({status:'accepted',provider_id:providerId});
  }catch{await admin.from('distribution_jobs').update({status:'failed',last_error:'Provider request failed; inspect provider status before retrying.',updated_at:new Date().toISOString()}).eq('id',job.id);return json({detail:'Email provider did not confirm acceptance.'},502);}
 }catch(error){return json({detail:error.status?error.message:'Distribution request failed.'},error.status||503);}
};
export const config={path:'/api/distribute'};
