(()=>{'use strict';
const $=s=>document.querySelector(s),content=$('#content');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;':'&quot;',"'":'&#39;'}[c]));
let user=null,posts=[],view='feed',mode='login';
async function api(path,{method='GET',data,blob}={}){
 const r=await fetch(path,{method,credentials:'same-origin',headers:blob?{'content-type':blob.type}:data?{'content-type':'application/json'}:{},body:blob|| (data?JSON.stringify(data):undefined)});
 let obj=null;try{obj=await r.json()}catch{}
 if(!r.ok)throw Error(obj?.error||'Erreur HTTP '+r.status);
 return obj;
}
const name=p=>p.display_name||p.username||'Utilisateur';
function heading(k,h,s){return '<div class="eyebrow">'+k+'</div><h1 class="heading">'+h+'</h1><p class="sub">'+s+'</p>'}
function notify(s){$('#status').textContent=s}
function authForm(){
 content.innerHTML=heading('Compte WarLike Online','Votre <em>identité</em>','Connectez-vous pour publier et découvrir les autres membres.')+
 '<div class="tile" style="max-width:480px"><div class="tabs"><button class="tab '+(mode==='login'?'active':'')+'" data-authmode="login">Connexion</button><button class="tab '+(mode==='register'?'active':'')+'" data-authmode="register">Inscription</button></div><form id="authForm">'+(mode==='register'?'<div class="field"><label for="displayName">Nom affiché</label><input id="displayName" required minlength="2" maxlength="60" autocomplete="name"></div>':'')+
 '<div class="field"><label for="username">Identifiant</label><input id="username" required minlength="3" maxlength="25" pattern="[a-zA-Z0-9_]+" autocomplete="username"></div>'+
 '<div class="field"><label for="password">Mot de passe</label><input id="password" type="password" minlength="12" maxlength="128" required autocomplete="'+(mode==='register'?'new-password':'current-password')+'"></div><button class="btn" type="submit">'+(mode==='register'?"Créer mon compte":"Se connecter")+'</button></form><p class="note">Ces comptes appartiennent à une version pilote de WarLike Online et ne sont pas encore reliés à WarLike Keys / Server.</p></div>';
}
function card(p){return '<article class="post"><div class="post-head"><div class="avatar">'+esc(name(p)[0]?.toUpperCase())+'</div><div><strong>'+esc(name(p))+'</strong><div class="handle">@'+esc(p.username)+' · '+new Date(p.created_at+'Z').toLocaleString('fr-FR')+'</div></div></div>'+
 (p.media_url?(p.media_type?.startsWith('video/')?'<video class="post-media" controls playsinline preload="metadata" src="'+esc(p.media_url)+'"></video>':'<img class="post-media" loading="lazy" alt="Média partagé par '+esc(name(p))+'" src="'+esc(p.media_url)+'">'):'')+
 '<p class="post-text">'+esc(p.body)+'</p><div class="post-actions"><button class="'+(p.liked?'liked':'')+'" data-like="'+esc(p.id)+'" aria-label="J’aime">♥ '+p.likes+'</button><button data-comments="'+esc(p.id)+'">♧ Commentaires</button><button data-follow="'+esc(p.author_id)+'">＋ Suivre</button></div><div id="comments-'+esc(p.id)+'"></div></article>'}
async function render(){document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
if(!user){authForm();return}
if(view==='feed'){content.innerHTML=heading('Réseau social en ligne','Le fil <em>vivant</em>','Les dernières publications des membres WarLike.')+(posts.length?posts.map(card).join(''):'<div class="empty">Aucune publication. Soyez le premier à partager quelque chose !</div>')}
else if(view==='reels'){const videos=posts.filter(p=>p.media_type?.startsWith('video/'));content.innerHTML=heading('Vidéos','WarLike <em>Clips</em>','Regardez les vidéos partagées.')+(videos.length?'<div class="reels">'+videos.map(p=>'<article class="reel"><video playsinline controls preload="metadata" src="'+esc(p.media_url)+'"></video><strong>'+esc(name(p))+'</strong><p>'+esc(p.body)+'</p></article>').join('')+'</div>':'<div class="empty">Pas de clips pour le moment.</div>')}
else if(view==='periscope'){content.innerHTML=heading('Découverte','WarLike <em>Périscope</em>','Un espace pour les futurs directs WarLike.')+'<div class="notice">Le direct vidéo et le chat temps réel ne sont pas encore déployés. Les vidéos publiées restent consultables dans Clips.</div>'}
else content.innerHTML=heading('Compte','Mon <em>profil</em>','Votre identité dans ce réseau social.')+'<div class="tile"><h2>'+esc(user.display_name)+'</h2><p>@'+esc(user.username)+'</p><button class="ghost" id="logout">Déconnexion</button></div>';
}
async function refresh(){const r=await api('/api/posts');posts=r.posts;await render()}
function navigate(v){view=v;render();scrollTo({top:0,behavior:'smooth'})}
$('#newPost').onclick=()=>{if(!user){authForm();return}$('#modal').classList.remove('hide');$('#postText').focus()};
$('#closeModal').onclick=()=>$('#modal').classList.add('hide');
$('#modal').onclick=e=>{if(e.target.id==='modal')$('#modal').classList.add('hide')};
$('#discover').onclick=()=>navigate('periscope');
document.addEventListener('click',async e=>{
 const nav=e.target.closest('[data-view]');if(nav){navigate(nav.dataset.view);return}
 const modeEl=e.target.closest('[data-authmode]');if(modeEl){mode=modeEl.dataset.authmode;authForm();return}
 if(e.target.id==='logout'){try{await api('/api/auth/logout',{method:'POST'});user=null;posts=[];authForm()}catch(x){notify(x.message)}return}
 const like=e.target.closest('[data-like]');if(like){try{const id=like.dataset.like,p=posts.find(p=>p.id===id);await api('/api/posts/'+id+'/like',{method:p.liked?'DELETE':'POST'});await refresh()}catch(x){notify(x.message)}return}
 const follow=e.target.closest('[data-follow]');if(follow){try{await api('/api/users/'+follow.dataset.follow+'/follow',{method:'POST'});notify('Compte suivi.')}catch(x){notify(x.message)}return}
 const comments=e.target.closest('[data-comments]');if(comments){try{const id=comments.dataset.comments,el=document.getElementById('comments-'+id);const r=await api('/api/posts/'+id+'/comments');el.innerHTML='<div class="comment-list">'+r.comments.map(c=>'<p class="comment"><strong>'+esc(name(c))+'</strong> '+esc(c.body)+'</p>').join('')+'</div><form class="comment-form" data-comment="'+esc(id)+'"><input required maxlength="350" placeholder="Votre commentaire" aria-label="Commentaire"><button class="ghost" type="submit">Envoyer</button></form>'}catch(x){notify(x.message)}}});
document.addEventListener('submit',async e=>{
 if(e.target.id==='authForm'){e.preventDefault();const b={username:$('#username').value,password:$('#password').value};if(mode==='register')b.display_name=$('#displayName').value;try{const r=await api('/api/auth/'+(mode==='register'?'register':'login'),{method:'POST',data:b});user=r.user;notify('Connecté : '+user.username);await refresh()}catch(x){notify('Connexion impossible : '+x.message)}}
 const c=e.target.closest('[data-comment]');if(c){e.preventDefault();const inp=c.querySelector('input');try{await api('/api/posts/'+c.dataset.comment+'/comments',{method:'POST',data:{body:inp.value.trim()}});await refresh()}catch(x){notify(x.message)}}
});
$('#postForm').onsubmit=async e=>{e.preventDefault();const body=$('#postText').value.trim(),file=$('#postMedia').files[0];if(!body&&!file){notify('Ajoutez du texte ou un média.');return}if(file&&file.size>20*1024*1024){notify('Limite de 20 Mo par média.');return}const submit=e.target.querySelector('[type=submit]');submit.disabled=true;try{const r=await api('/api/posts',{method:'POST',data:{body}});if(file)await api('/api/posts/'+r.id+'/media',{method:'PUT',blob:file});$('#postForm').reset();$('#modal').classList.add('hide');notify('Publication enregistrée sur WarLike Server Online.');await refresh()}catch(x){notify('Publication incomplète : '+x.message)}finally{submit.disabled=false}};
(async()=>{try{const me=await api('/api/auth/me');user=me.user;if(user)await refresh();else authForm()}catch(x){notify('API non disponible : '+x.message);authForm()}})();
})();
