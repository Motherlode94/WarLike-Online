// Cloudflare Worker sub-router. Uses WarLike Server PRIVATE service binding;
// do not trust client-supplied user IDs or expose session tokens to JavaScript.
const COOKIE='__Host-warlike_transcribe',SERVER='https://warlike-server.pages.dev';
const tokenPattern=/^[A-Za-z0-9_-]{43}$/;
const J=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
const error=(status,message)=>J({error:message},status);
function readCookie(req){const found=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(COOKIE+'='));const token=found.length===1?found[0].slice(COOKIE.length+1):null;return tokenPattern.test(token||'')?token:null}
const sessionCookie=(token,age)=>COOKIE+'='+token+'; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age='+age;
async function central(env,path,{method='GET',token,body}={}){
 if(!env.WARLIKE_SERVER)throw Error('WARLIKE_SERVER binding absent');
 const headers={Origin:SERVER};if(token)headers.Cookie='__Host-warlike_session='+token;
 if(body!==undefined)headers['content-type']='application/json';
 return env.WARLIKE_SERVER.fetch(new Request(SERVER+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'}));
}
async function principal(req,env,token=readCookie(req)){
 if(!token)return null;
 const r=await central(env,'/api/warlike-auth/session',{token});
 if(!r.ok)return null;
 const data=await r.json(),u=data.user;
 if(data.mustChange||!u||typeof u.id!=='string'||!/^[-A-Za-z0-9_]{1,100}$/.test(u.id))return null;
 return {id:u.id,name:String(u.name||'').slice(0,100),role:u.role};
}
async function jsonBody(req,max=270000){
 if(req.headers.get('content-type')?.split(';')[0]!=='application/json')return null;
 if(Number(req.headers.get('content-length')||0)>max)return null;
 const reader=req.body?.getReader();if(!reader)return null;
 let size=0,parts=[];
 for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();return null}parts.push(value)}
 const raw=new Uint8Array(size);let at=0;for(const p of parts){raw.set(p,at);at+=p.length}
 try{return JSON.parse(new TextDecoder().decode(raw))}catch{return null}
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safeInput=b=>b&&typeof b.title==='string'&&b.title.trim().length>0&&b.title.trim().length<=150&&typeof b.transcript==='string'&&b.transcript.length<=250000&&typeof b.language==='string'&&b.language.length<=8&&Array.isArray(b.subtitles)&&JSON.stringify(b.subtitles).length<=120000;
async function limited(req,max){
 if(Number(req.headers.get('content-length')||0)>max)return null;
 const reader=req.body?.getReader();if(!reader)return null;
 let size=0,parts=[];for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();return null}parts.push(value)}
 const out=new Uint8Array(size);let at=0;for(const p of parts){out.set(p,at);at+=p.length}return out;
}
function signature(bytes,type){const ascii=(a,b)=>String.fromCharCode(...bytes.subarray(a,b));return bytes.length>=12&&(
 (type==='audio/wav'&&ascii(0,4)==='RIFF'&&ascii(8,12)==='WAVE')||
 (type==='audio/mpeg'&&(ascii(0,3)==='ID3'||(bytes[0]===255&&(bytes[1]&224)===224)))||
 (type==='audio/ogg'&&ascii(0,4)==='OggS')||
 (type==='audio/webm'&&bytes[0]===26&&bytes[1]===69&&bytes[2]===223&&bytes[3]===163)||
 (type==='audio/mp4'&&ascii(4,8)==='ftyp'));
}
export async function projectsRouter(req,env){
 const url=new URL(req.url),path=url.pathname,method=req.method;
 if(!path.startsWith('/api/projects')&&!path.startsWith('/api/auth/'))return null;
 if(!env.WARLIKE_SERVER)return error(503,'Connexion WarLike Server non configurée');
 if(method!=='GET'&&method!=='HEAD'&&req.headers.get('origin')!==url.origin)return error(403,'Origine refusée');
 if(path==='/api/auth/login'&&method==='POST'){
  const body=await jsonBody(req,2048);
  if(!body||typeof body.username!=='string'||body.username.length>254||typeof body.password!=='string'||body.password.length>256)return error(400,'Identifiants invalides');
  const r=await central(env,'/api/warlike-auth/login',{method:'POST',body:{login:body.username,password:body.password}});
  if(!r.ok)return error(r.status===429?429:r.status>=500?503:401,'Connexion refusée');
  const result=await r.json(),cookie=/^__Host-warlike_session=([A-Za-z0-9_-]{43});/.exec(r.headers.get('set-cookie')||'');
  if(!cookie)return error(502,'Session centrale invalide');
  if(result.mustChange){await central(env,'/api/warlike-auth/logout',{method:'POST',token:cookie[1]}).catch(()=>{});return error(403,'Modifiez votre mot de passe sur WarLike Server');}
  if(!await principal(req,env,cookie[1]))return error(403,'Compte désactivé ou accès refusé');
  return J({ok:true},200,{'set-cookie':sessionCookie(cookie[1],28800)});
 }
 if(path==='/api/auth/logout'&&method==='POST'){
  const token=readCookie(req);if(token)await central(env,'/api/warlike-auth/logout',{method:'POST',token}).catch(()=>{});
  return J({ok:true},200,{'set-cookie':sessionCookie('',0)});
 }
 const user=await principal(req,env);
 if(path==='/api/auth/me'&&method==='GET')return J({user:user?{name:user.name,role:user.role}:null});
 if(!user)return error(401,'Connexion WarLike requise');
 if(!env.TRANSCRIBE_DB)return error(503,'Base des projets non configurée');
 const db=env.TRANSCRIBE_DB;
 if(path==='/api/projects'&&method==='GET'){
  const rows=await db.prepare('SELECT id,title,language,revision,audio_bytes,created_at,updated_at FROM transcribe_projects WHERE owner_member_id=? ORDER BY updated_at DESC,id DESC LIMIT 100').bind(user.id).all();
  return J({projects:rows.results});
 }
 if(path==='/api/projects'&&method==='POST'){
  const b=await jsonBody(req);if(!safeInput(b))return error(400,'Projet invalide ou trop volumineux');
  const id=crypto.randomUUID();
  await db.prepare('INSERT INTO transcribe_projects(id,owner_member_id,title,language,transcript,subtitles_json) VALUES(?,?,?,?,?,?)').bind(id,user.id,b.title.trim(),b.language,b.transcript,JSON.stringify(b.subtitles)).run();
  return J({id,revision:1},201);
 }
 const m=path.match(/^\/api\/projects\/([a-f0-9-]{36})(?:\/audio)?$/i);
 if(!m||!uuid.test(m[1]))return error(404,'Projet introuvable');
 const id=m[1],audio=path.endsWith('/audio');
 const project=await db.prepare('SELECT * FROM transcribe_projects WHERE id=? AND owner_member_id=?').bind(id,user.id).first();
 if(!project)return error(404,'Projet introuvable');
 if(audio&&method==='GET'){
  if(!project.audio_key||!env.TRANSCRIBE_BUCKET)return error(404,'Audio non conservé');
  const object=await env.TRANSCRIBE_BUCKET.get(project.audio_key);
  if(!object)return error(404,'Audio indisponible');
  return new Response(object.body,{headers:{'content-type':project.audio_type,'content-disposition':'attachment; filename="warlike-audio"','cache-control':'private,no-store','x-content-type-options':'nosniff'}});
 }
 if(audio&&method==='PUT'){
  if(!env.TRANSCRIBE_BUCKET)return error(503,'Stockage audio optionnel indisponible');
  const revision=Number(req.headers.get('if-match'));
  if(!Number.isSafeInteger(revision)||revision!==project.revision)return error(409,'Projet modifié : rechargez');
  const type=req.headers.get('content-type')?.split(';')[0]?.toLowerCase();
  if(!['audio/wav','audio/mpeg','audio/ogg','audio/webm','audio/mp4'].includes(type))return error(415,'Format audio refusé');
  const bytes=await limited(req,20*1024*1024);
  if(!bytes||!signature(bytes,type))return error(415,'Audio invalide ou plus de 20 Mo');
  const key='transcribe/'+user.id+'/'+id+'/'+crypto.randomUUID();
  await env.TRANSCRIBE_BUCKET.put(key,bytes,{httpMetadata:{contentType:type}});
  let changed;
  try{changed=await db.prepare("UPDATE transcribe_projects SET audio_key=?,audio_type=?,audio_bytes=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_member_id=? AND revision=?").bind(key,type,bytes.byteLength,id,user.id,revision).run()}
  catch(e){await env.TRANSCRIBE_BUCKET.delete(key).catch(()=>{});throw e}
  if(!changed.meta.changes){await env.TRANSCRIBE_BUCKET.delete(key).catch(()=>{});return error(409,'Conflit de modification');}
  if(project.audio_key)await env.TRANSCRIBE_BUCKET.delete(project.audio_key).catch(()=>{});
  return J({ok:true,revision:revision+1,audioBytes:bytes.byteLength});
 }
 if(audio&&method==='DELETE'){
  if(!env.TRANSCRIBE_BUCKET)return error(503,'Stockage indisponible');
  const b=await jsonBody(req,1000);
  if(!b||b.revision!==project.revision)return error(409,'Conflit de modification');
  const r=await db.prepare("UPDATE transcribe_projects SET audio_key=NULL,audio_type=NULL,audio_bytes=0,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_member_id=? AND revision=?").bind(id,user.id,b.revision).run();
  if(!r.meta.changes)return error(409,'Conflit de modification');
  if(project.audio_key)await env.TRANSCRIBE_BUCKET.delete(project.audio_key).catch(()=>{});
  return J({ok:true,revision:b.revision+1});
 }
 if(audio)return error(405,'Méthode refusée');
 if(method==='GET')return J({project:{id:project.id,title:project.title,language:project.language,transcript:project.transcript,subtitles:JSON.parse(project.subtitles_json),revision:project.revision,audioBytes:project.audio_bytes,createdAt:project.created_at,updatedAt:project.updated_at}});
 if(method==='PUT'){
  const b=await jsonBody(req);if(!safeInput(b)||!Number.isSafeInteger(b.revision)||b.revision<1)return error(400,'Projet invalide');
  const r=await db.prepare("UPDATE transcribe_projects SET title=?,language=?,transcript=?,subtitles_json=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_member_id=? AND revision=?").bind(b.title.trim(),b.language,b.transcript,JSON.stringify(b.subtitles),id,user.id,b.revision).run();
  if(!r.meta.changes)return error(409,'Projet modifié ailleurs : rechargez');
  return J({ok:true,revision:b.revision+1});
 }
 if(method==='DELETE'){
  const b=await jsonBody(req,1000);if(!b||b.revision!==project.revision)return error(409,'Conflit de modification');
  const r=await db.prepare('DELETE FROM transcribe_projects WHERE id=? AND owner_member_id=? AND revision=?').bind(id,user.id,b.revision).run();
  if(!r.meta.changes)return error(409,'Conflit de modification');
  if(project.audio_key&&env.TRANSCRIBE_BUCKET)await env.TRANSCRIBE_BUCKET.delete(project.audio_key).catch(()=>{});
  return J({ok:true});
 }
 return error(405,'Méthode non autorisée');
}
