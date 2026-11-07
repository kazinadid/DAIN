import {env,json} from '../lib/server.mjs';
export default ()=>{const worker=env('VERIFICATION_WORKER_SECRET').length>=32;const ready=!!(env('GROQ_API_KEY')&&env('TAVILY_API_KEY')&&env('SUPABASE_SECRET_KEY')&&worker);return json({status:ready?'ready':'configuration_required',ai_configured:!!(env('GROQ_API_KEY')&&env('TAVILY_API_KEY')),database_configured:!!env('SUPABASE_SECRET_KEY'),worker_configured:worker,distribution_enabled:false},ready?200:503);};
export const config={path:'/api/health'};
