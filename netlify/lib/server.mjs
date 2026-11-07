import {createClient} from '@supabase/supabase-js';
import {projectConfig} from '../../shared/config.mjs';
export const env=name=>globalThis.Netlify?.env?.get(name)||process.env[name]||'';
const url=env('VITE_SUPABASE_URL')||projectConfig.url;
const key=env('VITE_SUPABASE_PUBLISHABLE_KEY')||projectConfig.key;
export const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function checked(r){if(r.error)throw Error('Database operation failed.');return r.data;}
export async function timed(stage,operation){const started=performance.now();try{return await operation();}finally{console.info(JSON.stringify({stage,duration_ms:Math.round(performance.now()-started)}));}}
export async function authenticate(req){
 const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];if(!token)throw Object.assign(Error('Sign in first.'),{status:401});
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});
 const r=await client.auth.getUser(token);if(r.error||!r.data.user)throw Object.assign(Error('Session is invalid or expired.'),{status:401});
 return {client,user:r.data.user};
}
export function privileged(){const secret=env('SUPABASE_SECRET_KEY');if(!secret)throw Object.assign(Error('Server database credentials are not configured.'),{status:503});return createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});}
export async function readBody(req){if(Number(req.headers.get('content-length')||0)>16000)throw Object.assign(Error('Request too large.'),{status:413});const text=await req.text();if(text.length>16000)throw Object.assign(Error('Request too large.'),{status:413});try{return JSON.parse(text);}catch{throw Object.assign(Error('Invalid JSON.'),{status:400});}}
