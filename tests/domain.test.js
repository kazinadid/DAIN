import test from 'node:test';
import assert from 'node:assert/strict';
import {institutionalEmail, safeUrl, validateStory, escapeHtml} from '../src/domain.js';
test('DU eligibility accepts departments but rejects lookalike domains',()=>{
 for(const email of ['person@du.ac.bd','person@cs.du.ac.bd','person@mis.du.ac.bd']) assert.equal(institutionalEmail(email),true);
 for(const email of ['person@du.ac.bd.attacker.com','person@notdu.ac.bd','person@gmail.com','@du.ac.bd']) assert.equal(institutionalEmail(email),false);
});
test('evidence links reject executable schemes',()=>{
 assert.equal(safeUrl('javascript:alert(1)'),null);assert.equal(safeUrl('data:text/html,hi'),null);assert.equal(safeUrl('/relative'),null);assert.equal(safeUrl('https://du.ac.bd'),'https://du.ac.bd/');
});
test('story validation prevents incomplete and future submissions',()=>{
 const story={headline:'A new research achievement',summary:'A clear summary of an important and verifiable achievement.',narrative:'A detailed factual narrative. '.repeat(8),sector:'Academic & Research',achievement_date:'2026-01-01',evidence_url:''};
 assert.equal(validateStory(story),null);
 assert.match(validateStory({...story,achievement_date:'2999-01-01'}),/date/);
 assert.match(validateStory({...story,narrative:'short'}),/story/);
 assert.match(validateStory({...story,evidence_url:'javascript:alert(1)'}),/https/);
});
test('user content is escaped before rendering',()=>{assert.equal(escapeHtml('<script>"&\''),'&lt;script&gt;&quot;&amp;&#39;');});
