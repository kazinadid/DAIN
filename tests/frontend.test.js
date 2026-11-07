import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import crypto from 'node:crypto';
test('retained original frontend HTML and CSS match the source reference',async()=>{
 const original=await fs.readFile('frontend/original.html','utf8');
 assert.equal(await fs.readFile('index.html','utf8'),original);
 assert.ok(original.includes('id="story-form"') && original.includes('id="view-admin"'),'reference contains the core DAIN screens');
 const built=await fs.readFile('dist/index.html','utf8');
 for(const id of ['story-form','view-admin','view-stories','auth-form-login','auth-form-register'])assert.ok(built.includes(`id="${id}"`));
 assert.ok(!built.includes('auth-form-demo'));assert.ok(!built.includes('tab-auth-demo'));
 assert.ok(!/\son[a-z]+\s*=/.test(built));assert.ok(!/<script(?![^>]*src=)[^>]*>/.test(built));
 const app=await fs.readFile('dist/'+built.match(/src="(assets\/app-[^"]+)"/)[1],'utf8');
 assert.ok(!app.includes('const seedStories'));assert.ok(!app.includes('localStorage.setItem("dain_user"'));
 assert.ok(!/\son(?:click|submit|error)\s*=/.test(app));
 assert.ok(!(await fs.readdir('dist/assets')).some(p=>p.endsWith('.png')));
});
