// Run: node tests/smoke.mjs https://warlike-online.warlikeofficiel.workers.dev
// Read-only HTTP smoke tests. No production records are created.
import assert from 'node:assert/strict';
const origin = (process.argv[2] || 'https://warlike-online.warlikeofficiel.workers.dev').replace(/\/$/,'');
let failures=0;
async function check(label,fn){try{await fn();console.log('PASS',label)}catch(e){failures++;console.error('FAIL',label,e.message)}}
await check('Homepage returns HTML',async()=>{const r=await fetch(origin+'/');assert.equal(r.status,200);assert.match(r.headers.get('content-type')||'',/text\/html/);assert.match(await r.text(),/WarLike Online/)});
await check('Frontend JavaScript served',async()=>{const r=await fetch(origin+'/app.js');assert.equal(r.status,200);assert.match(r.headers.get('content-type')||'',/javascript/);assert.match(await r.text(),/api\/auth/)});
await check('Health endpoint',async()=>{const r=await fetch(origin+'/api/health');assert.equal(r.status,200);const j=await r.json();assert.equal(j.ok,true)});
await check('No session -> null user',async()=>{const r=await fetch(origin+'/api/auth/me');assert.equal(r.status,200);const j=await r.json();assert.equal(j.user,null)});
await check('Anonymous posts forbidden',async()=>{const r=await fetch(origin+'/api/posts');assert.equal(r.status,401)});
await check('Anonymous post creation forbidden',async()=>{const r=await fetch(origin+'/api/posts',{method:'POST',headers:{origin, 'content-type':'application/json'},body:JSON.stringify({body:'test'})});assert.equal(r.status,401)});
await check('Invalid login denied',async()=>{const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({username:'warlike_nonexistent_smoke',password:'invalid-test-password'})});assert.equal(r.status,401)});
await check('Unknown API route is 404',async()=>{const r=await fetch(origin+'/api/warlike-smoke-not-found');assert.equal(r.status,401) /* authenticated-only unknown routes currently return 401 */});
console.log(failures?'Smoke tests failed: '+failures:'All HTTP smoke tests passed');
process.exitCode=failures?1:0;
