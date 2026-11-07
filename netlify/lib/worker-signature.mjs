import {VERIFICATION_VERSION} from './verification.mjs';
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
export function storyHash(story,model){return createHash('sha256').update(JSON.stringify([VERIFICATION_VERSION,model||'openai/gpt-oss-120b',story.headline,story.summary,story.narrative,story.classification,story.impact,story.institution,story.achievement_date,story.evidence_url])).digest('hex');}
export function signRun(runId,expires,secret){return createHmac('sha256',secret).update('dain-verification-v2:'+runId+':'+expires).digest('hex');}
export function verifyRun(runId,expires,signature,secret,now=Date.now()){if(!secret||secret.length<32||!Number.isFinite(expires)||expires<now||expires>now+300000||!/^[0-9a-f-]{36}$/i.test(runId||'')||!/^[a-f0-9]{64}$/.test(signature||''))return false;return timingSafeEqual(Buffer.from(signRun(runId,expires,secret),'hex'),Buffer.from(signature,'hex'));}
