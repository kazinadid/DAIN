import test from 'node:test';import assert from 'node:assert/strict';
import {publicURL,normalizeAssessment,verifyStory} from '../netlify/lib/verification.mjs';
import {sendRelease} from '../netlify/lib/delivery.mjs';
test('evidence URL excludes credentials, local targets and IP addresses',()=>{for(const s of ['javascript:alert(1)','http://127.0.0.1','http://[::1]','https://user:pass@example.org','http://localhost/a'])assert.equal(publicURL(s),null);assert.equal(publicURL('https://du.ac.bd/news'),'https://du.ac.bd/news');});
test('AI cannot invent citations or verify only against the submitted domain',()=>{
 const s=[{url:'https://du.ac.bd/news'}];
 assert.equal(normalizeAssessment('Claim',{verdict:'verified',confidence:.95,sources:['https://fake.org/news']},s).verdict,'unverified');
 assert.equal(normalizeAssessment('Claim',{verdict:'verified',confidence:.95,sources:['https://du.ac.bd/news']},s,'https://du.ac.bd/proof').verdict,'unverified');
 assert.equal(normalizeAssessment('Claim',{verdict:'contradicted',confidence:.9,sources:[]},s).verdict,'unverified');
});
const story={headline:'University researchers receive a national award',summary:'A research team at Dhaka University received an award for its contribution to sustainable energy.',institution:'University of Dhaka',achievement_date:'2026-01-01',evidence_url:''};
test('verification uses search evidence and always holds distribution',async()=>{
 let groqCalls=0;
 const fetcher=async(url,opts)=>{
  if(url.includes('groq'))return Response.json({choices:[{message:{content:JSON.stringify(++groqCalls===1?{coherent:true,claims:['The team received a national award.']}:{verdict:'verified',confidence:.9,sources:['https://du.ac.bd/news']})}}]});
  return Response.json({results:[{url:'https://du.ac.bd/news',content:'The university team received the national award.'}]});
 };
 const r=await verifyStory(story,{groqKey:'test',tavilyKey:'test',fetcher});assert.equal(r.status,'verified');assert.equal(r.stages[2].status,'held');assert.equal(r.claims[0].sources[0],'https://du.ac.bd/news');
});
test('missing keys, provider errors and gibberish never grant approval',async()=>{
 assert.equal((await verifyStory(story)).status,'verification_pending');
 assert.equal((await verifyStory(story,{groqKey:'x',tavilyKey:'x',fetcher:async()=>{throw Error('provider down');}})).status,'verification_pending');
 assert.equal((await verifyStory({...story,headline:'CCCCCCCCCCCC',summary:'CCCCCCCCCCCC CCCCCCCCCCCC'})).status,'rejected');
});
test('delivery uses recipient isolation, stable idempotency key and actual provider receipt',async()=>{
 let seen;
 const id=await sendRelease({job:{id:'job-1'},newsroom:{email:'desk@example.org'},story:{...story,id:'story-1',narrative:'Story',author_name:'Author'},origin:'https://dain-platform.netlify.app',apiKey:'test',from:'DAIN <press@example.org>',fetcher:async(url,opts)=>{seen={url,opts};return Response.json({id:'provider-1'});}});
 assert.equal(id,'provider-1');assert.equal(seen.opts.headers['Idempotency-Key'],'dain-job-1');assert.deepEqual(JSON.parse(seen.opts.body).to,['desk@example.org']);
 await assert.rejects(()=>sendRelease({job:{id:'job-1'},newsroom:{email:'desk@example.org'},story,origin:'https://example.org',apiKey:'x',from:'x',fetcher:async()=>new Response('failure',{status:500})}));
});
