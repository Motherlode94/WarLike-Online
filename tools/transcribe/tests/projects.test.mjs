import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {projectsRouter} from '../projects/api.js';
function fixture(){
 const raw=new DatabaseSync(':memory:');
 raw.exec(readFileSync(new URL('../migrations/0001_projects.sql',import.meta.url),'utf8'));
 const db={prepare(sql){const stmt=raw.prepare(sql);let args=[];return {bind(...params){args=params;return this},async first(){return stmt.get(...args)||null},async all(){return {results:stmt.all(...args)}},async run(){return {meta:{changes:Number(stmt.run(...args).changes)}}}}}};
 const files=new Map();
 const bucket={async put(key,bytes){files.set(key,bytes)},async get(key){const v=files.get(key);return v?{body:new Blob([v]).stream()}:null},async delete(key){files.delete(key)}};
 let principalId='WL-ONE',active=true;
 const session='A'.repeat(43);
 const env={TRANSCRIBE_DB:db,TRANSCRIBE_BUCKET:bucket,WARLIKE_SERVER:{async fetch(request){
 const path=new URL(request.url).pathname;
 if(path.endsWith('/login'))return Response.json({mustChange:false},{headers:{'set-cookie':'__Host-warlike_session='+session+'; Path=/; HttpOnly; Secure'}});
 if(path.endsWith('/session'))return Response.json({user:active?{id:principalId,name:'Membre test',role:'member'}:null,mustChange:false});
 return Response.json({ok:true});
 }}};
 const origin='https://transcribe.example',cookie='__Host-warlike_transcribe='+session;
 const call=(path,method='GET',body,token=cookie)=>{
 const headers={};if(token)headers.cookie=token;
 if(method!=='GET')headers.origin=origin;
 if(body!==undefined)headers['content-type']='application/json';
 return projectsRouter(new Request(origin+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env);
 };
 return {raw,env,call,cookie,files,changeId:x=>principalId=x,deactivate:()=>active=false};
}
test('anonymous access rejected and authenticated D1 project CRUD',async()=>{
 const f=fixture();try{
  assert.equal((await f.call('/api/projects','GET',undefined,'')).status,401);
  const login=await f.call('/api/auth/login','POST',{username:'demo',password:'long-password'});
  assert.equal(login.status,200);
  assert.match(login.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
  let r=await f.call('/api/projects','POST',{title:'Projet 1',language:'fr',transcript:'Bonjour',subtitles:[]});
  assert.equal(r.status,201);const {id}=await r.json();
  r=await f.call('/api/projects/'+id);assert.equal((await r.json()).project.transcript,'Bonjour');
  r=await f.call('/api/projects/'+id,'PUT',{title:'Corrigé',language:'fr',transcript:'Bonsoir',subtitles:[],revision:1});
  assert.equal(r.status,200);
  assert.equal((await f.call('/api/projects/'+id,'PUT',{title:'Ancien',language:'fr',transcript:'x',subtitles:[],revision:1})).status,409);
  f.changeId('WL-TWO');
  assert.equal((await f.call('/api/projects/'+id)).status,404);
  assert.equal((await(await f.call('/api/projects')).json()).projects.length,0);
  f.changeId('WL-ONE');
  assert.equal((await f.call('/api/projects/'+id,'DELETE',{revision:2})).status,200);
  assert.equal((await f.call('/api/projects/'+id)).status,404);
  f.deactivate();
  assert.equal((await f.call('/api/projects')).status,401);
 }finally{f.raw.close()}
});
test('R2 optional and revision-protected; audio never uploaded by normal save',async()=>{
 const f=fixture();try{
  const r=await f.call('/api/projects','POST',{title:'Voix',language:'fr',transcript:'Test',subtitles:[]}),{id}=await r.json();
  assert.equal(f.files.size,0);
  const bytes=new Uint8Array(44);new TextEncoder().encode('RIFF').forEach((v,i)=>bytes[i]=v);new TextEncoder().encode('WAVE').forEach((v,i)=>bytes[i+8]=v);
  const url='https://transcribe.example/api/projects/'+id+'/audio';
  const put=async revision=>projectsRouter(new Request(url,{method:'PUT',headers:{origin:'https://transcribe.example',cookie:f.cookie,'content-type':'audio/wav','if-match':String(revision)},body:bytes}),f.env);
  assert.equal((await put(1)).status,200);assert.equal(f.files.size,1);
  assert.equal((await put(1)).status,409);assert.equal(f.files.size,1);
  assert.equal((await f.call('/api/projects/'+id+'/audio')).status,200);
  assert.equal((await f.call('/api/projects/'+id,'DELETE',{revision:2})).status,200);
  assert.equal(f.files.size,0);
 }finally{f.raw.close()}
});
