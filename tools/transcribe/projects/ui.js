// Served by /projects.js through the themed Worker, no external dependencies.
export const PROJECTS_CLIENT = String.raw`(()=>{'use strict';
const $=id=>document.getElementById(id),message=s=>$('cloud-status').textContent=s;
let current=null,projects=[];
async function request(path,{method='GET',body,bytes,type,revision}={}){
 const opts={method,credentials:'same-origin',headers:{}};
 if(method!=='GET')opts.headers.origin=location.origin;
 if(bytes){opts.body=bytes;opts.headers['content-type']=type;opts.headers['if-match']=String(revision)}
 else if(body!==undefined){opts.body=JSON.stringify(body);opts.headers['content-type']='application/json'}
 const r=await fetch(path,opts),v=await r.json().catch(()=>({error:'Réponse invalide'}));
 if(!r.ok)throw Error(v.error||('Erreur HTTP '+r.status));
 return v;
}
async function session(){
 try{const {user}=await request('/api/auth/me');$('cloud-login').hidden=!!user;$('cloud-projects').hidden=!user;
 $('cloud-user').textContent=user?'Connecté : '+user.name:'Connexion WarLike requise pour sauvegarder en ligne.';
 if(user)await refresh()}catch(e){message(e.message)}
}
async function refresh(){
 const out=await request('/api/projects');projects=out.projects||[];
 const sel=$('cloud-list');sel.replaceChildren();
 const blank=document.createElement('option');blank.value='';blank.textContent='Sélectionner un projet';sel.append(blank);
 for(const p of projects){const opt=document.createElement('option');opt.value=p.id;opt.textContent=p.title+' · '+p.updated_at;sel.append(opt)}
 if(current)sel.value=current.id;
}
const payload=()=>({title:$('cloud-title').value.trim()||'Sans titre',language:$('language').value,transcript:$('text').value,subtitles:[]});
$('cloud-login-form').onsubmit=async e=>{
 e.preventDefault();const f=new FormData(e.target);
 try{await request('/api/auth/login',{method:'POST',body:{username:f.get('username'),password:f.get('password')}});
 e.target.reset();message('Connexion effectuée.');await session()}catch(x){message(x.message)}
};
$('cloud-logout').onclick=async()=>{try{await request('/api/auth/logout',{method:'POST',body:{}});current=null;await session();message('Déconnecté.')}catch(e){message(e.message)}};
$('cloud-new').onclick=()=>{current=null;$('cloud-list').value='';$('cloud-title').value='';message('Prêt pour un nouveau projet.');};
$('cloud-save').onclick=async()=>{
 try{const body=payload();let result;
 if(current){result=await request('/api/projects/'+current.id,{method:'PUT',body:{...body,revision:current.revision}});current.revision=result.revision}
 else{result=await request('/api/projects',{method:'POST',body});current={id:result.id,revision:result.revision}}
 await refresh();message('Texte sauvegardé dans D1. Audio non envoyé.')}catch(e){message(e.message)}
};
$('cloud-open').onclick=async()=>{
 const id=$('cloud-list').value;if(!id)return;
 try{const {project:p}=await request('/api/projects/'+id);current={id:p.id,revision:p.revision};
 $('cloud-title').value=p.title;$('text').value=p.transcript;
 $('language').value=p.language;message('Projet chargé. Audio sauvegardé : '+(p.audioBytes>0?'oui':'non')+'.');}catch(e){message(e.message)}
};
$('cloud-delete').onclick=async()=>{
 if(!current||!confirm('Supprimer définitivement ce projet et son audio éventuel ?'))return;
 try{await request('/api/projects/'+current.id,{method:'DELETE',body:{revision:current.revision}});
 current=null;$('cloud-title').value='';await refresh();message('Projet supprimé.')}catch(e){message(e.message)}
};
$('cloud-upload').onclick=async()=>{
 if(!current){message('Enregistrez d’abord le projet.');return}
 const file=$('file').files[0];if(!file){message('Sélectionnez un fichier audio.');return}
 if(file.size>20*1024*1024){message('Audio limité à 20 Mo.');return}
 const mime=({'mp3':'audio/mpeg','wav':'audio/wav','ogg':'audio/ogg','webm':'audio/webm','m4a':'audio/mp4','mp4':'audio/mp4'})[file.name.split('.').pop().toLowerCase()]||file.type.split(';')[0];
 try{const out=await request('/api/projects/'+current.id+'/audio',{method:'PUT',bytes:file,type:mime,revision:current.revision});
 current.revision=out.revision;message('Audio sauvegardé dans R2.');await refresh()}catch(e){message(e.message)}
};
$('cloud-download').onclick=()=>{
 if(!current){message('Ouvrez un projet.');return}
 window.open('/api/projects/'+current.id+'/audio','_blank','noopener');
};
session();
})();`;
export const PROJECTS_PANEL = `<section class="panel" id="cloud-panel" style="margin-top:24px">
<h2>3. Mes projets privés · Cloudflare</h2>
<p class="notice">Connexion WarLike Server nécessaire. Le texte est sauvegardé dans D1 uniquement sur action explicite. L'envoi de l'audio vers R2 est facultatif.</p>
<p id="cloud-user" class="notice">Vérification de la session…</p>
<form id="cloud-login-form"><div id="cloud-login"><label>Identifiant WarLike<input name="username" autocomplete="username" required style="width:100%;padding:10px"></label><label>Mot de passe<input name="password" type="password" autocomplete="current-password" required style="width:100%;padding:10px"></label><button class="primary" type="submit">Connexion</button></div></form>
<div id="cloud-projects" hidden>
<label for="cloud-title">Nom du projet</label><input id="cloud-title" maxlength="150" placeholder="Mon enregistrement" style="width:100%;padding:10px">
<div class="row"><button id="cloud-new">Nouveau</button><button id="cloud-save" class="primary">Sauvegarder le texte</button><button id="cloud-logout">Déconnexion</button></div>
<label for="cloud-list">Projets sauvegardés</label><select id="cloud-list"></select>
<div class="row"><button id="cloud-open">Ouvrir</button><button id="cloud-delete">Supprimer</button></div>
<div class="row"><button id="cloud-upload">Conserver cet audio dans R2 (20 Mo max.)</button><button id="cloud-download">Récupérer l'audio</button></div>
</div><p id="cloud-status" class="status" role="status"></p></section>`;
