export function normalizeEvidence(value='') {
 const text=value.trim();if(!text)return '';
 let url;try{url=new URL(text);}catch{throw Error('Enter a valid evidence link, including https://.');}
 if(!['https:','http:'].includes(url.protocol)||!url.hostname||url.username||url.password)throw Error('Use an http or https evidence link without login credentials.');
 if(url.href.length>2048)throw Error('The evidence link is too long (maximum 2048 characters).');
 return url.href;
}
export function submissionMessage(error){
 const detail=String(error?.message||'');
 if(detail.includes('evidence_url'))return 'The evidence link was not accepted. Use a complete http or https URL, without spaces or line breaks.';
 if(error?.code==='42501'||/row.level security/i.test(detail))return 'This action is not permitted for your account. Submission requires a confirmed DU account or an administrator; editorial access requires an administrator account. Sign in again if your access recently changed.';
 if(/institutional email/i.test(detail))return 'A confirmed DU institutional email or administrator account is required to submit. Please verify your email and sign in again.';
 if(/narrative/.test(detail))return 'The full story must contain 80 to 20,000 characters.';
 if(/achievement_date/.test(detail))return 'Select a valid achievement date that is not in the future.';
 if(/author_name/.test(detail))return 'Your author name must contain 2 to 100 characters.';
 if(/summary/.test(detail))return 'Your summary must contain 30 to 600 characters.';
 if(/headline/.test(detail))return 'Your headline must contain 10 to 120 characters.';
 if(/fetch|network/i.test(detail))return 'Could not reach the server. Your form is kept; check your connection and try again.';
 return detail && !/constraint|permission denied|relation|schema/i.test(detail)?detail:'The submission could not be saved. Your form is kept. Please contact the administrator if this continues.';
}
