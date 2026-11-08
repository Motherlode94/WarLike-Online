(()=>{'use strict';
const $=id=>document.getElementById(id);
const CHUNK_SEC=25, MAX_CHUNKS=30, RATE=16000;
let file=null, objectUrl=null, stream=null, recorder=null, recorded=[], vtt='', cues=[], controller=null, busy=false, lastMode='auto', metadata={};
const status=s=>{$('status').textContent=s};
const format=n=>{const h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=Math.floor(n%60);return [h,m,s].map(x=>String(x).padStart(2,'0')).join(':')};
const save=(filename,contents,type='text/plain;charset=utf-8')=>{const u=URL.createObjectURL(new Blob([contents],{type})),a=document.createElement('a');a.href=u;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(u),5000)};
function setFile(f){
 if(busy)return;
 if(!f)return;
 if(!f.type.startsWith('audio/')&&!f.type.startsWith('video/')&&!/\.(mp3|wav|ogg|webm|m4a|mp4)$/i.test(f.name)){status('Sélectionnez un audio compatible.');return}
 file=f;vtt='';cues=[];metadata={name:f.name};
 $('vtt').disabled=true;$('srt').disabled=true;$('vttBlock').classList.add('hidden');
 $('filename').textContent=f.name+' — '+(f.size/1048576).toFixed(2)+' Mo';
 $('transcribe').disabled=false;
 if(objectUrl)URL.revokeObjectURL(objectUrl);
 objectUrl=URL.createObjectURL(f);$('player').src=objectUrl;$('player').classList.remove('hidden');
 status('Prêt. Les fichiers longs seront divisés en segments de 25 secondes directement sur cet appareil.')
}
const drop=$('drop');
$('file').onchange=e=>setFile(e.target.files[0]);
drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('drag')});
drop.addEventListener('dragleave',()=>drop.classList.remove('drag'));
drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('drag');setFile(e.dataTransfer.files[0])});
$('record').onclick=async()=>{if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){status('Microphone non disponible ici.');return}
 try{
  stream=await navigator.mediaDevices.getUserMedia({audio:true});recorded=[];
  let options={};for(const t of ['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4']){if(MediaRecorder.isTypeSupported(t)){options={mimeType:t};break}}
  recorder=new MediaRecorder(stream,options);
  recorder.ondataavailable=e=>{if(e.data.size)recorded.push(e.data)};
  recorder.onstop=()=>{const b=new Blob(recorded,{type:recorder.mimeType||'audio/webm'});setFile(new File([b],'memo-'+Date.now()+'.'+(b.type.includes('ogg')?'ogg':b.type.includes('mp4')?'m4a':'webm'),{type:b.type}));stream?.getTracks().forEach(t=>t.stop());stream=null;$('record').disabled=false;$('stop').disabled=true};
  recorder.start();$('record').disabled=true;$('stop').disabled=false;status('Enregistrement en cours…');
 }catch{status('Microphone indisponible ou autorisation refusée.')}
};
$('stop').onclick=()=>{if(recorder?.state==='recording')recorder.stop()};
function wavChunk(samples,start,end,sampleRate=RATE){
 const out=new ArrayBuffer(44+(end-start)*2),dv=new DataView(out),u=new Uint8Array(out);
 const str=(pos,s)=>{for(let i=0;i<s.length;i++)u[pos+i]=s.charCodeAt(i)};
 str(0,'RIFF');dv.setUint32(4,out.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');dv.setUint32(16,16,true);
 dv.setUint16(20,1,true);dv.setUint16(22,1,true);dv.setUint32(24,sampleRate,true);
 dv.setUint32(28,sampleRate*2,true);dv.setUint16(32,2,true);dv.setUint16(34,16,true);
 str(36,'data');dv.setUint32(40,(end-start)*2,true);
 for(let j=start;j<end;j++){const x=Math.max(-1,Math.min(1,samples[j]));dv.setInt16(44+(j-start)*2,Math.round(x<0?x*32768:x*32767),true)}
 return new Blob([out],{type:'audio/wav'})
}
async function prepare(f){
 // Decode compressed audio locally so uploads are bounded and private until inference.
 const ac=new (window.AudioContext||window.webkitAudioContext)();
 try{
  const buf=await f.arrayBuffer(),decoded=await ac.decodeAudioData(buf.slice(0));
  const n=Math.ceil(decoded.duration/CHUNK_SEC);
  if(n>MAX_CHUNKS)throw Error('Limite actuelle : 12 min 30 s par tâche. Coupez le fichier en plusieurs projets.');
  if(!decoded.length)throw Error('Enregistrement vide.');
  // OfflineAudioContext resamples with the browser's audio codec.
  const frames=Math.ceil(decoded.duration*RATE);
  const offline=new OfflineAudioContext(1,frames,RATE);
  const source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();
  const rendered=await offline.startRendering();
  const samples=rendered.getChannelData(0);
  return {samples,duration:decoded.duration,parts:n};
 }finally{await ac.close().catch(()=>{})}
}
const parseTime=s=>{const p=s.trim().replace(',','.').split(':').map(Number);return p.length===3?p[0]*3600+p[1]*60+p[2]:p[0]*60+p[1]};
const time=s=>{const ms=Math.max(0,Math.round(s*1000));return String(Math.floor(ms/3600000)).padStart(2,'0')+':'+String(Math.floor(ms%3600000/60000)).padStart(2,'0')+':'+String(Math.floor(ms%60000/1000)).padStart(2,'0')+'.'+String(ms%1000).padStart(3,'0')};
function parseVTT(raw,offset){
 if(typeof raw!=='string')return[];
 const groups=raw.replace(/\r/g,'').split(/\n\s*\n/),out=[];
 for(const group of groups){
  const lines=group.split('\n').map(s=>s.trim()).filter(Boolean);
  const i=lines.findIndex(s=>/\d{1,2}:\d\d(?:[:.]\d\d)?[.,]\d\d\d\s*-->/.test(s));
  if(i<0)continue;
  const m=lines[i].match(/(\d{1,2}:\d\d(?::\d\d)?[.,]\d\d\d)\s*-->\s*(\d{1,2}:\d\d(?::\d\d)?[.,]\d\d\d)/);
  if(!m)continue;
  const start=parseTime(m[1]),end=parseTime(m[2]);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)continue;
  const text=lines.slice(i+1).join(' ').replace(/<[^>]+>/g,'').trim();
  if(text)out.push({start:start+offset,end:end+offset,text});
 }
 return out
}
function makeVTT(cues){return 'WEBVTT\n\n'+cues.map(c=>time(c.start)+' --> '+time(c.end)+'\n'+c.text).join('\n\n')}
function makeSRT(cues){return cues.map((c,i)=>i+1+'\n'+time(c.start).replace('.',',')+' --> '+time(c.end).replace('.',',')+'\n'+c.text).join('\n\n')}
function renderCues(){
 vtt=cues.length?makeVTT(cues):'';
 $('vtt').disabled=!vtt;$('srt').disabled=!vtt;
 $('vttBlock').classList.toggle('hidden',!vtt);$('subtitles').textContent=vtt;
}
async function transcribe(){
 if(!file||busy)return;
 busy=true;controller=new AbortController();$('transcribe').disabled=true;$('cancel').disabled=false;
 let processed=0;const previousText=$('text').value;
 try{
  status('Préparation locale de l’audio…');
  const {samples,duration,parts}=await prepare(file);
  metadata={filename:file.name,duration,language:$('language').value,created_at:new Date().toISOString()};
  const transcript=[];
  cues=[];renderCues();
  for(let i=0;i<parts;i++){
   if(controller.signal.aborted)throw Error('Transcription interrompue.');
   const start=i*CHUNK_SEC,end=Math.min(samples.length,(i+1)*CHUNK_SEC*RATE);
   const chunk=wavChunk(samples,start,end);
   status('Transcription '+(i+1)+' / '+parts+' · '+format(start/RATE)+' à '+format(end/RATE)+'.');
   const endpoint='/api/transcribe?lang='+encodeURIComponent($('language').value);
   const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'audio/wav'},body:chunk,signal:controller.signal});
   let out;try{out=await r.json()}catch{throw Error('Réponse serveur invalide ('+r.status+').')}
   if(!r.ok)throw Error(out.error||'Erreur '+r.status);
   if(out.text?.trim())transcript.push(out.text.trim());
   const sub=parseVTT(out.vtt||'',start/RATE);
   if(sub.length)cues.push(...sub);
   processed++;
   $('text').value=transcript.join('\n\n');
   renderCues();
  }
  status('Terminé : '+parts+' segment(s), '+format(duration)+'. Corrigez et exportez le résultat.');
 }catch(e){
  if(processed)status('Traitement partiel : '+processed+' segment(s) terminés. '+(e.name==='AbortError'?'Interrompu.':e.message));
  else{$('text').value=previousText;status(e.name==='AbortError'?'Opération annulée.':'Échec : '+e.message)}
 }finally{busy=false;controller=null;$('transcribe').disabled=!file;$('cancel').disabled=true}
}
$('transcribe').onclick=transcribe;
$('cancel').onclick=()=>controller?.abort();
$('txt').onclick=()=>save('warlike-transcription.txt',$('text').value);
$('vtt').onclick=()=>{if(vtt)save('warlike-sous-titres.vtt',vtt,'text/vtt;charset=utf-8')};
$('srt').onclick=()=>{if(cues.length)save('warlike-sous-titres.srt',makeSRT(cues),'application/x-subrip;charset=utf-8')};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('text').value);status('Transcription copiée.')}catch{status('Copie indisponible : sélectionnez le texte.')}}
$('project').onclick=()=>{save('warlike-transcription.json',JSON.stringify({format:'warlike-transcribe-v1',...metadata,text:$('text').value,subtitles:cues},null,2),'application/json')};
$('seek').onclick=()=>{const t=Math.max(0,Number($('seektime').value)||0);$('player').currentTime=t;$('player').play().catch(()=>{});};
})();