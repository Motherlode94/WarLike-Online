import assert from 'node:assert/strict';
const base=process.env.ONLINE_TEST_URL;if(!base)throw Error('ONLINE_TEST_URL is required');const origin=new URL(base).origin;
async function req(path,{method='GET',data,cookie,bytes,type,originHeader=origin}={}){let headers={};if(method!=='GET')headers.origin=originHeader;if(cookie)headers.cookie=cookie;if(data!==undefined)headers['content-type']='application/json';if(bytes)headers['content-type']=type;let r=await fetch(origin+path,{method,headers,body:bytes||(data!==undefined?JSON.stringify(data):undefined),redirect:'manual'});let content=r.headers.get('content-type')||'';let body=content.includes('application/json')?await r.json():await r.arrayBuffer();return {r,body,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
assert.equal((await req('/api/health')).r.status,200);
assert.equal((await req('/api/posts')).r.status,401);
assert.equal((await req('/api/auth/register',{method:'POST',data:{}})).r.status,403);
assert.equal((await req('/api/auth/login',{method:'POST',data:{username:'bad',password:'bad'}})).r.status,401);
const a=await req('/api/auth/login',{method:'POST',data:{username:'test-alice',password:'test-only-password'}}),b=await req('/api/auth/login',{method:'POST',data:{username:'test-bob',password:'test-only-password'}});assert.equal(a.r.status,200);assert.equal(b.r.status,200);assert.ok(a.cookie&&b.cookie);assert.notEqual(a.body.user.id,b.body.user.id);
const post=await req('/api/posts',{method:'POST',cookie:a.cookie,data:{body:'Publication de test isolée'}});assert.equal(post.r.status,201);const id=post.body.id;
let feed=await req('/api/posts',{cookie:b.cookie});assert.ok(feed.body.posts.some(x=>x.id===id));
assert.equal((await req(`/api/posts/${id}/like`,{method:'POST',cookie:b.cookie})).r.status,200);
assert.equal((await req(`/api/posts/${id}/comments`,{method:'POST',cookie:b.cookie,data:{body:'Réponse de test'}})).r.status,201);
let comments=await req(`/api/posts/${id}/comments`,{cookie:a.cookie});assert.ok(comments.body.comments.some(x=>x.body==='Réponse de test'));
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL9sAAAAASUVORK5CYII=','base64'));
assert.equal((await req(`/api/posts/${id}/media`,{method:'PUT',cookie:a.cookie,bytes:png,type:'image/png'})).r.status,200);
assert.equal((await req(`/media/${id}`)).r.status,401);const media=await req(`/media/${id}`,{cookie:b.cookie});assert.equal(media.r.status,200);assert.equal(media.r.headers.get('content-type'),'image/png');
assert.equal((await req(`/api/posts`,{method:'POST',cookie:a.cookie,originHeader:'https://example.invalid',data:{body:'bad'}})).r.status,403);
assert.equal((await req('/api/auth/logout',{method:'POST',cookie:a.cookie})).r.status,200);
console.log('PASS: comptes distincts, publication, réception, réaction, commentaire, média privé et origine.');
