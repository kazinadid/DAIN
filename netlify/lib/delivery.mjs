export function releaseText(story,origin){return `FOR IMMEDIATE RELEASE\n\n${story.headline}\n\n${story.summary}\n\n${story.narrative}\n\n${story.author_name}\n${story.institution}\nAchievement date: ${story.achievement_date}\n\nDAIN source: ${origin}/#stories\nStory ID: ${story.id}\n\nThis is an editorially approved DAIN release. Private evidence and account contact details are excluded.`;}
export async function sendRelease({job,newsroom,story,apiKey,from,origin,fetcher=fetch}){
 const r=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`dain-${job.id}`},body:JSON.stringify({from,to:[newsroom.email],subject:`DAIN: ${story.headline}`,text:releaseText(story,origin)})});
 if(!r.ok)throw Error('Email provider did not accept the request.');const data=await r.json();if(typeof data.id!=='string'||!data.id)throw Error('Email provider returned no receipt.');return data.id;
}
