import {projectConfig} from '../shared/config.mjs';
export const config={url:import.meta.env.VITE_SUPABASE_URL||projectConfig.url,key:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||projectConfig.key};
