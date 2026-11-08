// WarLike Transcribe — standalone Cloudflare Worker / Workers AI
// No audio or transcript is retained by this application.
const MODEL='@cf/openai/whisper-large-v3-turbo';
const LIMIT=8*1024*1024;
const MAX_CALLS=5;
function json(obj,status=200){return new Response(JSON.stringify(obj),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}})}
const reject=(message,status=400)=>json({error:message},status);
async function bytesLimited(req){
  const size=Number(req.headers.get('content-length')||0);
  if(size>LIMIT)return null;
  if(!req.body)return new Uint8Array();
  const reader=req.body.getReader(),pieces=[];let total=0;
  while(true){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>LIMIT){await reader.cancel();return null}pieces.push(value)}
  const data=new Uint8Array(total);let at=0;for(const piece of pieces){data.set(piece,at);at+=piece.byteLength}return data
}
function base64(bytes){
 let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));
 return btoa(s)
}
function supported(data,type){
 if(data.length<12)return false;
 const ascii=(a,b)=>String.fromCharCode(...data.subarray(a,b));
 if(type==='audio/wav'||type==='audio/x-wav')return ascii(0,4)==='RIFF'&&ascii(8,12)==='WAVE';
 if(type==='audio/mpeg'||type==='audio/mp3')return ascii(0,3)==='ID3'||(data[0]===255&&(data[1]&224)===224);
 if(type==='audio/ogg')return ascii(0,4)==='OggS';
 if(type==='audio/webm')return data[0]===26&&data[1]===69&&data[2]===223&&data[3]===163;
 if(type==='audio/mp4'||type==='audio/x-m4a'||type==='audio/m4a'||type==='video/mp4')return ascii(4,8)==='ftyp';
 return false
}
async function reserve(env,req){
 if(!env.DB)return {error:'Limitation de trafic non configurée',status:503};
 const ip=req.headers.get('CF-Connecting-IP')||'unknown';
 const hour=Math.floor(Date.now()/3600000);
 const token=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(hour+':'+ip));
 const id=Array.from(new Uint8Array(token),x=>x.toString(16).padStart(2,'0')).join('');
 // Atomic per-hour quota. The hashed source is never returned or logged.
 const row=await env.DB.prepare('INSERT INTO limits (id,hour,used) VALUES (?,?,1) ON CONFLICT(id) DO UPDATE SET used=used+1 WHERE used < ? RETURNING used').bind(id,hour,MAX_CALLS).first();
 if(!row)return {error:'Quota atteint : 5 transcriptions par heure pour cette connexion.',status:429};
 return {ok:true,remaining:MAX_CALLS-row.used}
}
export default {
 async fetch(req,env){
  const url=new URL(req.url);
  if(req.method==='GET'&&url.pathname==='/api/health')return json({ok:true,service:'warlike-transcribe',model:MODEL});
  if(req.method==='POST'&&url.pathname==='/api/transcribe'){
   if(req.headers.get('Origin')!==url.origin)return reject('Origine refusée',403);
   if(!env.AI)return reject('Moteur de transcription non configuré',503);
   const type=(req.headers.get('content-type')||'').split(';')[0].toLowerCase();
   if(!['audio/wav','audio/x-wav','audio/mpeg','audio/mp3','audio/ogg','audio/webm','audio/mp4','audio/x-m4a','audio/m4a','video/mp4'].includes(type))return reject('Format non accepté. Choisissez WAV, MP3, OGG, WEBM ou M4A.',415);
   const data=await bytesLimited(req);
   if(data===null)return reject('Fichier trop volumineux (8 Mo maximum).',413);
   if(!supported(data,type))return reject('Fichier audio vide ou signature non reconnue.',415);
   const rate=await reserve(env,req);if(rate.error)return reject(rate.error,rate.status);
   try{
     const language=(url.searchParams.get('lang')||'').toLowerCase();
     if(language&&!/^[a-z]{2}$/.test(language))return reject('Code langue invalide',400);
     const payload={audio:base64(data),task:'transcribe'};
     if(language)payload.language=language;
     const out=await env.AI.run(MODEL,payload);
     if(!out||typeof out.text!=='string')return reject('Le moteur n’a pas retourné de transcription.',502);
     return json({text:out.text,vtt:typeof out.vtt==='string'?out.vtt:null,language:out.language||language||null,remaining:rate.remaining});
   }catch(e){console.error('Workers AI transcription failed',String(e));return reject('Transcription indisponible. Réessayez avec un fichier WAV ou MP3 plus court.',502)}
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return reject('Méthode non autorisée',405);
  if(url.pathname!=='/'&&url.pathname!=='/index.html')return reject('Introuvable',404);
  return env.ASSETS?env.ASSETS.fetch(req):new Response('Site indisponible',{status:503});
 }
};
