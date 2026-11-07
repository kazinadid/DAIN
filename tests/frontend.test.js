import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import crypto from 'node:crypto';
test('retained original frontend HTML and CSS match the source reference',async()=>{
 const original=await fs.readFile('frontend/original.html','utf8');
 assert.equal(await fs.readFile('index.html','utf8'),original);
 assert.equal(crypto.createHash('sha256').update(original).digest('hex'),'2c7f099d7216d61050d04647757d36ace8ffb0c2f4c4a9b9137a020ad73add7f');
 const built=await fs.readFile('dist/index.html','utf8');const marker=original.lastIndexOf('<script>');
 const normalize=s=>s.replace(/<link rel="stylesheet" href="assets\/ui-[a-f0-9]+\.css">/,'').replace('<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>','').replace(/<script>\s*tailwind.config[\s\S]*?<\/script>/,'').replaceAll('assets/dunite-logo.webp','assets/dunite-logo.png');
 assert.equal(normalize(built.slice(0,built.lastIndexOf('<script>'))).replace('<link rel="preload" href="assets/fonts/ProductSans-Regular.woff2" as="font" type="font/woff2" crossorigin>','<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/mortezaom/google-sans-cdn@master/fonts.css" />'),normalize(original.slice(0,marker)));
 assert.equal(built.slice(built.lastIndexOf('</script>')),original.slice(original.lastIndexOf('</script>')));
 assert.ok(!built.includes('Math.floor(Math.random() * 20000)'));
 assert.ok(!built.includes('localStorage.setItem("dain_stories"'));
});
