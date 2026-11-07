import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';
const db=new PGlite();
try{
 const baseline=['test-stubs.sql','schema.sql','harden_rpc.sql','verification_distribution.sql','admin_only.sql'];
 for(const path of baseline){console.log('Apply',path);await db.exec(await fs.readFile('supabase/'+path,'utf8'));}
 const migrations=(await fs.readdir('supabase/migrations')).filter(p=>p.endsWith('.sql')).sort();
 for(let pass=1;pass<=2;pass++)for(const path of migrations){console.log('Migration pass',pass,path);await db.exec(await fs.readFile('supabase/migrations/'+path,'utf8'));}
 for(const path of (await fs.readdir('supabase')).filter(p=>/^verify.*\.sql$/.test(p)).sort()){console.log('Assertions',path);await db.exec(await fs.readFile('supabase/'+path,'utf8'));console.log('PASS',path);}
}finally{await db.close();}
