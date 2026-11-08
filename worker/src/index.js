// WarLike Online verifies sessions against WarLike Server via a private binding.
const encoder = new TextEncoder();
const json = (value, status=200, headers={}) => new Response(JSON.stringify(value), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
const fail=(message,status=400)=>json({error:message},status);
const bytes=(n)=>crypto.getRandomValues(new Uint8Array(n));
const hex=(buffer)=>Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');
const b64=(a)=>btoa(String.fromCharCode(...a));
const unb64=(str)=>Uint8Array.from(atob(str),c=>c.charCodeAt(0));
async function digest(s){return hex(await crypto.subtle.digest('SHA-256',encoder.encode(s)))}
async function passwordHash(password,salt){const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:unb64(salt),iterations:310000,hash:'SHA-256'},key,256))}
function equal(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff |= a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
const SERVER='https://warlike-server.pages.dev',COOKIE='__Host-warlike_online',SESSION=/^[A-Za-z0-9_-]{43}$/;
function cookie(request){const parts=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(COOKIE+'='));if(parts.length!==1)return null;const token=parts[0].slice(COOKIE.length+1);return SESSION.test(token)?token:null}
function sessionCookie(request,token,age){return `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${age}`}
async function central(request,env,path,{method='GET',token,body}={}){if(!env.WARLIKE_SERVER)throw Error('Serveur WarLike non configuré');const headers={Origin:SERVER};let ip=request.headers.get('cf-connecting-ip');if(ip)headers['CF-Connecting-IP']=ip;if(token)headers.Cookie='__Host-warlike_session='+token;if(body)headers['Content-Type']='application/json';return env.WARLIKE_SERVER.fetch(new Request(SERVER+path,{method,headers,body,redirect:'manual'}));}
async function userFromSession(request,env,token=cookie(request)){
 if(!token)return null;let r=await central(request,env,'/api/warlike-auth/session',{token});if(!r.ok)return null;let data=await r.json(),u=data.user;if(!u||data.mustChange||typeof u.id!=='string'||!/^[-A-Za-z0-9_]{1,100}$/.test(u.id))return null;
 let linked=await env.DB.prepare('SELECT u.id,u.username,u.display_name FROM online_identities i JOIN online_users u ON u.id=i.user_id WHERE i.provider=? AND i.subject=?').bind('warlike-server',u.id).first();
 if(!linked){const id=crypto.randomUUID(),username='wl_'+id.replaceAll('-','').slice(0,25),name=String(u.name||'Membre WarLike').slice(0,60);await env.DB.prepare('INSERT INTO online_users(id,username,display_name,password_salt,password_hash) VALUES(?,?,?,?,?)').bind(id,username,name,'disabled','disabled').run();await env.DB.prepare('INSERT OR IGNORE INTO online_identities(provider,subject,user_id) VALUES(?,?,?)').bind('warlike-server',u.id,id).run();linked=await env.DB.prepare('SELECT u.id,u.username,u.display_name FROM online_identities i JOIN online_users u ON u.id=i.user_id WHERE i.provider=? AND i.subject=?').bind('warlike-server',u.id).first();}
 return linked?{...linked,role:u.role}:null;
}
const publicUser=u=>({id:u.id,username:u.username,display_name:u.display_name});
async function bodyJSON(request){if(request.headers.get('content-type')?.split(';')[0]!=='application/json')throw Error('JSON requis');const reader=request.body?.getReader();if(!reader)throw Error('JSON requis');let chunks=[],length=0;for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>10000){await reader.cancel();throw Error('Requête trop grande')}chunks.push(value)}const bytes=new Uint8Array(length);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length}return JSON.parse(new TextDecoder().decode(bytes))}
async function readLimited(request,limit){if(Number(request.headers.get('content-length')||0)>limit)throw Error('Média trop volumineux');const reader=request.body?.getReader();if(!reader)throw Error('Média vide');let chunks=[],size=0;for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('Média trop volumineux')}chunks.push(value)}const out=new Uint8Array(size);let off=0;for(const c of chunks){out.set(c,off);off+=c.length}return out.buffer}
function validateText(s,max){return typeof s==='string'&&s.length<=max}
const headers={'x-content-type-options':'nosniff','referrer-policy':'no-referrer'};

async function verifyWarLikeAssertion(assertion,secret){
 if(!secret||typeof assertion!=='string'||assertion.length>4096)return null;
 const parts=assertion.split('.');if(parts.length!==2)return null;
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const decode=x=>Uint8Array.from(atob(x.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-x.length%4)%4)),c=>c.charCodeAt(0));
 let payload,signature;
 try{payload=JSON.parse(new TextDecoder().decode(decode(parts[0])));signature=decode(parts[1])}catch{return null}
 if(!await crypto.subtle.verify('HMAC',key,signature,encoder.encode(parts[0])))return null;
 const now=Math.floor(Date.now()/1000);
 if(payload.iss!=='warlike-server'||payload.aud!=='warlike-online'||typeof payload.sub!=='string'||payload.sub.length<1||payload.sub.length>150||typeof payload.nonce!=='string'||!/^[-_a-zA-Z0-9]{16,120}$/.test(payload.nonce)||!Number.isInteger(payload.iat)||!Number.isInteger(payload.exp)||payload.exp<now||payload.iat>now+30||payload.exp-payload.iat>120||now-payload.iat>120)return null;
 return payload;
}

async function route(req,env){
 const url=new URL(req.url), path=url.pathname, method=req.method;
 if(!env.DB||!env.BUCKET||!env.WARLIKE_SERVER)return fail('Service Online en cours de configuration',503);
 if(!['GET','HEAD','OPTIONS'].includes(method)){const origin=req.headers.get('origin');if(origin!==url.origin)return fail('Origine non autorisée',403)}
 if(path==='/api/health'&&method==='GET')return json({ok:true,service:'warlike-online'});

 if((path==='/api/auth/register'||path==='/api/auth/warlike')&&method==='POST')return fail('Utilise ton compte WarLike existant.',403);
 if(path==='/api/auth/login'&&method==='POST'){
  const b=await bodyJSON(req);if(typeof b.username!=='string'||b.username.length>254||typeof b.password!=='string'||b.password.length>256)return fail('Identifiants invalides');
  const r=await central(req,env,'/api/warlike-auth/login',{method:'POST',body:JSON.stringify({login:b.username,password:b.password})});
  if(!r.ok)return fail(r.status===429?'Trop de tentatives. Réessaie plus tard.':r.status>=500?'Serveur WarLike indisponible.':'Identifiants invalides',r.status===429?429:r.status>=500?503:401);
  const result=await r.json(),m=/^__Host-warlike_session=([A-Za-z0-9_-]{43});/.exec(r.headers.get('set-cookie')||'');if(!m)return fail('Session serveur invalide',502);
  if(result.mustChange){await central(req,env,'/api/warlike-auth/logout',{method:'POST',token:m[1]}).catch(()=>{});return fail('Personnalise d’abord ton compte sur WarLike Server.',403)}
  const u=await userFromSession(req,env,m[1]);if(!u)return fail('Compte WarLike indisponible',403);
  return json({user:publicUser(u)},200,{'set-cookie':sessionCookie(req,m[1],28800)});
 }
 if(path==='/api/auth/logout'&&method==='POST'){
  const token=cookie(req);if(token)await central(req,env,'/api/warlike-auth/logout',{method:'POST',token}).catch(()=>{});
  return json({ok:true},200,{'set-cookie':sessionCookie(req,'',0)});
 }
 const user=await userFromSession(req,env);
 if(path==='/api/auth/me'&&method==='GET')return json({user:user?publicUser(user):null});
 if(path==='/api/posts'&&method==='GET'){
  if(!user)return fail('Connexion nécessaire',401);
  const rows=await env.DB.prepare(`SELECT p.id,p.body,p.media_key,p.media_type,p.created_at,u.id AS author_id,u.username,u.display_name, (SELECT COUNT(*) FROM online_likes l WHERE l.post_id=p.id) AS likes, EXISTS(SELECT 1 FROM online_likes l WHERE l.post_id=p.id AND l.user_id=?) AS liked FROM online_posts p JOIN online_users u ON u.id=p.author_id ORDER BY p.created_at DESC,p.id DESC LIMIT 50`).bind(user.id).all();
  return json({posts:rows.results.map(p=>({...p,media_url:p.media_key?'/media/'+p.id:null,media_key:undefined}))});
 }
 if(!user)return fail('Connexion nécessaire',401);
 if(path==='/api/posts'&&method==='POST'){
  const b=await bodyJSON(req);if(!validateText(b.body,2000))return fail('Message invalide');
  const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO online_posts(id,author_id,body) VALUES(?,?,?)').bind(id,user.id,b.body).run();return json({id},201);
 }
 const mediaMatch=path.match(/^\/api\/posts\/([a-f0-9-]{36})\/media$/);
 if(mediaMatch&&method==='PUT'){
  const post=await env.DB.prepare('SELECT author_id,media_key FROM online_posts WHERE id=?').bind(mediaMatch[1]).first();
  if(!post)return fail('Introuvable',404);if(post.author_id!==user.id)return fail('Accès refusé',403);
  const type=req.headers.get('content-type')||'',limit=20*1024*1024;
  if(!/^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm))$/.test(type))return fail('Type média non pris en charge',415);
  let data;try{data=await readLimited(req,limit)}catch{return fail('Média limité à 20 Mo',413)}if(!data.byteLength||data.byteLength>limit)return fail('Média limité à 20 Mo',413);
  const signature=new Uint8Array(data.slice(0,16));
  const is=(...a)=>a.every((v,i)=>signature[i]===v);
  const safe=type==='image/png'?is(137,80,78,71,13,10,26,10):type==='image/jpeg'?is(255,216,255):type==='image/gif'?is(71,73,70,56):type==='image/webp'?is(82,73,70,70)&&String.fromCharCode(...signature.slice(8,12))==='WEBP':type==='video/mp4'?String.fromCharCode(...signature.slice(4,8))==='ftyp':type==='video/webm'?is(26,69,223,163):false;
  if(!safe)return fail('Signature du fichier incompatible',415);
  const key='posts/'+user.id+'/'+post.id+'/'+crypto.randomUUID();
  await env.BUCKET.put(key,data,{httpMetadata:{contentType:type}});
  await env.DB.prepare('UPDATE online_posts SET media_key=?,media_type=? WHERE id=?').bind(key,type,post.id).run();
  if(post.media_key)await env.BUCKET.delete(post.media_key);
  return json({media_url:'/media/'+post.id});
 }
 const publicMedia=path.match(/^\/media\/([a-f0-9-]{36})$/);
 if(publicMedia&&method==='GET'){
  const p=await env.DB.prepare('SELECT media_key,media_type FROM online_posts WHERE id=?').bind(publicMedia[1]).first();
  if(!p?.media_key)return fail('Média introuvable',404);
  const object=await env.BUCKET.get(p.media_key);if(!object)return fail('Média introuvable',404);
  return new Response(object.body,{headers:{'content-type':p.media_type,'content-disposition':'inline','cache-control':'private, max-age=120','x-content-type-options':'nosniff'}});
 }
 const like=path.match(/^\/api\/posts\/([a-f0-9-]{36})\/like$/);
 if(like&&method==='POST'){
  const exists=await env.DB.prepare('SELECT id FROM online_posts WHERE id=?').bind(like[1]).first();if(!exists)return fail('Publication introuvable',404);
  await env.DB.prepare('INSERT OR IGNORE INTO online_likes(post_id,user_id) VALUES(?,?)').bind(like[1],user.id).run();return json({ok:true});
 }
 if(like&&method==='DELETE'){await env.DB.prepare('DELETE FROM online_likes WHERE post_id=? AND user_id=?').bind(like[1],user.id).run();return json({ok:true})}
 const comment=path.match(/^\/api\/posts\/([a-f0-9-]{36})\/comments$/);
 if(comment&&method==='GET'){
  const rows=await env.DB.prepare('SELECT c.id,c.body,c.created_at,u.username,u.display_name FROM online_comments c JOIN online_users u ON u.id=c.user_id WHERE post_id=? ORDER BY c.created_at ASC LIMIT 100').bind(comment[1]).all();return json({comments:rows.results});
 }
 if(comment&&method==='POST'){
  const b=await bodyJSON(req);if(typeof b.body!=='string'||!b.body.trim()||b.body.length>350)return fail('Commentaire invalide');
  const exists=await env.DB.prepare('SELECT id FROM online_posts WHERE id=?').bind(comment[1]).first();if(!exists)return fail('Publication introuvable',404);
  const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO online_comments(id,post_id,user_id,body) VALUES(?,?,?,?)').bind(id,comment[1],user.id,b.body.trim()).run();return json({id},201);
 }
 const follow=path.match(/^\/api\/users\/([a-f0-9-]{36})\/follow$/);
 if(follow&&method==='POST'){
  if(follow[1]===user.id)return fail('Abonnement à soi-même interdit');
  const target=await env.DB.prepare('SELECT id FROM online_users WHERE id=?').bind(follow[1]).first();if(!target)return fail('Profil introuvable',404);
  await env.DB.prepare('INSERT OR IGNORE INTO online_follows(follower_id,followed_id) VALUES(?,?)').bind(user.id,follow[1]).run();return json({ok:true});
 }
 if(follow&&method==='DELETE'){await env.DB.prepare('DELETE FROM online_follows WHERE follower_id=? AND followed_id=?').bind(user.id,follow[1]).run();return json({ok:true})}
 return fail('Route introuvable',404);
}
export default {async fetch(req,env){
 const url=new URL(req.url);
 if(!url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/media/'))return env.ASSETS.fetch(req);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{allow:'GET,POST,PUT,DELETE,OPTIONS'}});
 try{return await route(req,env)}catch(err){console.error('WarLike Online API error',err);return fail('Erreur du serveur',500)}
}};

