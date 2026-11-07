(() => {
'use strict';
const $ = id => document.getElementById(id);
const STORAGE_KEY = 'gertrudis.v2';
const WAKE = ['gertrudis','gertru','gertrum','gertrun','gertrudiz','gertrudis'];
const norm = value => String(value ?? '').toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[¿?¡!.,;:¡!"“”'’]/g,' ').replace(/\s+/g,' ').trim();
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const WAKE_RE = /^(?:(?:oye|hola|por favor)\s+)?(?:gertrudis|gertru|gertrum|gertrun|gertrudiz)\b[\s,:-]*/i;
const ACTIONS = {
 add: /^(?:por favor\s+)?(?:agrega|agregar|añade|anade|anadir|añadir|crea|crear|registra|registrar|anota|anotar|apunta|apuntar|incorpora|incorporar|nueva tarea|nueva|guarda|guardar)\b/i,
 del: /^(?:por favor\s+)?(?:borra|borrar|elimina|eliminar|quita|quitar|suprime|suprimir|remueve|remover|descarta|descartar)\b/i,
 done: /^(?:por favor\s+)?(?:completa|completar|termina|terminar|finaliza|finalizar|marca como hecha|marca como completada|da por terminada)\b/i,
 list: /^(?:(?:muestra|mostrar|lista|listar|ensena|ver|dime|cuales|que)\b.*(?:tareas|pendientes)|mis tareas|lista de tareas|que tengo pendiente)/i
};
let state = loadState();
let filter = 'pending', viewMode = 'flat', pendingDeleteIds = null;
function loadState(){
 let saved=null; try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{}
 if(saved && Array.isArray(saved.tasks)) return {tasks:saved.tasks.map(migrateTask),rules:Array.isArray(saved.rules)?saved.rules:[]};
 let old={}; try{old=JSON.parse(localStorage.getItem('miAsistente.v1')||'{}')}catch{}
 return {tasks:Array.isArray(old.tasks)?old.tasks.map(migrateTask):[],rules:Array.isArray(old.rules)?old.rules:[]};
}
function migrateTask(t){return {id:t.id||makeId(),title:cleanLegacyTitle(String(t.title||'Tarea sin título'))||'Tarea sin título',due:t.due||'',priority:['high','medium','low'].includes(t.priority)?t.priority:'medium',note:t.note||'',done:!!t.done,created:t.created||new Date().toISOString(),reminded:!!t.reminded};}
function makeId(){return 'g'+Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
function speak(message){if(!('speechSynthesis'in window))return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(message);u.lang='es-SV';u.rate=1;u.pitch=1;window.speechSynthesis.speak(u);}
function cleanWake(s){return norm(s).replace(WAKE_RE,'').trim();}
function priorityLabel(p){return ({high:'Alta',medium:'Media',low:'Baja'})[p]||'Media';}
function render(){
 const today=new Date();const todayKey=new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);
 let list=state.tasks.filter(t=>filter==='all'||(filter==='done'?t.done:!t.done));
 list.sort((a,b)=>(Number(a.done)-Number(b.done))||(a.due||'9999').localeCompare(b.due||'9999')||(({high:0,medium:1,low:2})[a.priority]-({high:0,medium:1,low:2})[b.priority]));
 $('taskCount').textContent=state.tasks.filter(t=>!t.done).length+' pendientes';
 if(viewMode==='flat'){
  $('tasks').innerHTML=list.length?`<div class="tablewrap"><table><thead><tr><th>Tarea</th><th>Entrega</th><th>Prioridad</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${list.map(t=>`<tr><td>${esc(t.title)}${t.note?`<div class="muted">Nota: ${esc(t.note)}</div>`:''}</td><td>${t.due?esc(t.due):'—'}${t.due&&t.due<todayKey&&!t.done?' ⚠':''}</td><td>${priorityLabel(t.priority)}</td><td>${t.done?'Hecha':'Pendiente'}</td><td><div class="row"><button class="secondary" onclick="Gertrudis.toggle('${t.id}')">${t.done?'Reabrir':'Completar'}</button><button class="secondary" onclick="Gertrudis.priority('${t.id}')">Prioridad</button><button class="ghost" onclick="Gertrudis.note('${t.id}')">Nota</button><button class="ghost" onclick="Gertrudis.remove('${t.id}')">Borrar</button></div></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">No hay tareas en esta vista.</p>';
 }else{$('tasks').innerHTML=list.length?list.map(t=>`<article class="task"><div class="tasktop"><strong>${esc(t.title)}</strong><span class="pill ${t.priority}">${priorityLabel(t.priority)}</span></div><div class="muted">${t.due?'Entrega: '+esc(t.due):'Sin fecha límite'} · ${t.done?'Completada':'Pendiente'}</div>${t.note?`<div class="muted">${esc(t.note)}</div>`:''}<div class="task-actions"><button class="secondary" onclick="Gertrudis.toggle('${t.id}')">${t.done?'Reabrir':'Completar'}</button><button class="secondary" onclick="Gertrudis.priority('${t.id}')">Prioridad</button><button class="secondary" onclick="Gertrudis.note('${t.id}')">Nota</button><button class="danger" onclick="Gertrudis.remove('${t.id}')">Borrar</button></div></article>`).join(''):'<p class="muted">No hay tareas en esta vista.</p>';}
 $('rules').innerHTML=state.rules.map((r,i)=>`<div class="rule">${esc(r.text)} <button class="ghost" onclick="Gertrudis.forget(${i})">Eliminar</button></div>`).join('')||'<p class="muted">Todavía no hay información guardada.</p>';
 document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));
}
function addTask(title,due='',priority='medium',note='',voice=false){title=String(title||'').trim();if(!title)return false;state.tasks.push({id:makeId(),title,due,priority,note,done:false,created:new Date().toISOString(),reminded:false});save();render();if(voice)speak('Dale, guardada');return true;}
function parseDate(s){const now=new Date();const d=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);if(/\bpasado manana\b/.test(s)){d.setDate(d.getDate()+2);return dateKey(d)}if(/\bmanana\b/.test(s)){d.setDate(d.getDate()+1);return dateKey(d)}if(/\bhoy\b/.test(s))return dateKey(d);const days=['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];for(let i=0;i<days.length;i++)if(new RegExp('\\b'+days[i]+'\\b').test(s)){let delta=(i-d.getDay()+7)%7;if(!delta)delta=7;d.setDate(d.getDate()+delta);return dateKey(d)}return '';}
function dateKey(d){return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function stripMetadata(s){return s.replace(/\b(?:para|vence|con fecha|fecha limite)\s+(?:el\s+)?(?:pasado manana|manana|hoy|lunes|martes|miercoles|jueves|viernes|sabado|domingo)(?:\s+\d{1,2}(?:\/\d{1,2})?)?/g,' ').replace(/\bprioridad\s+(?:alta|media|baja)\b/g,' ').replace(/\b(?:urgente|muy importante|sin prioridad)\b/g,' ').replace(/\s+/g,' ').trim();}
function cleanTaskTitle(command){let s=cleanWake(command);s=s.replace(ACTIONS.add,'').trim();s=s.replace(/^(?:una|la)\s+tarea\s+(?:de\s+)?/,'');s=stripMetadata(s);s=s.replace(/^[,;:\s-]+|[,;:\s-]+$/g,'').trim();return s;}
function cleanLegacyTitle(title){let s=String(title||'').trim();s=s.replace(/^\s*(?:gertrudis|gertru|gertrum|gertrun|gertrudiz)\b[\s,:-]*/i,'');s=s.replace(/^\s*(?:por favor\s+)?(?:agrega|agregar|añade|anade|anadir|añadir|crea|crear|registra|registrar|anota|anotar|apunta|apuntar|nueva tarea|guarda|guardar)\b[\s,:-]*/i,'');return s.trim();}
function tokens(s){return norm(cleanLegacyTitle(s)).split(' ').filter(w=>w.length>1&&!['la','las','el','los','un','una','de','del','por','favor','tarea','tareas','pendiente','pendientes'].includes(w));}
function findTask(query){const q=tokens(query);if(!q.length)return {kind:'none'};let scored=state.tasks.filter(t=>!t.done).map(t=>{const tt=tokens(t.title);const common=q.filter(w=>tt.includes(w)).length;const coverage=common/q.length;const titleCoverage=common/Math.max(tt.length,1);let score=common*10+Math.round(coverage*20)+Math.round(titleCoverage*10);if(norm(cleanLegacyTitle(t.title))===norm(query))score+=100;if(norm(cleanLegacyTitle(t.title)).includes(norm(query))||norm(query).includes(norm(cleanLegacyTitle(t.title))))score+=30;return {task:t,score,coverage};}).filter(x=>x.score>=18&&x.coverage>=0.5).sort((a,b)=>b.score-a.score);
 if(!scored.length)return {kind:'none'};if(scored.length>1&&scored[0].score-scored[1].score<8)return {kind:'ambiguous',tasks:scored.filter(x=>scored[0].score-x.score<8).map(x=>x.task)};return {kind:'one',task:scored[0].task};}
function askDelete(tasks){pendingDeleteIds=tasks.map(t=>t.id);const names=tasks.map(t=>cleanLegacyTitle(t.title)).join(', ');const phrase=tasks.length===1?'¿Quieres que borre la tarea ':'¿Quieres que borre estas '+tasks.length+' tareas: ';const msg=phrase+names+'? Para confirmar, pulsa el micrófono y di sí. Para cancelar, di no.';$('confirmPanel').hidden=false;$('confirmText').textContent=msg;speak(msg);$('voiceStatus').textContent='Confirmación pendiente. Pulsa el micrófono y responde sí o no.';}
function clearPending(){pendingDeleteIds=null;$('confirmPanel').hidden=true;$('confirmText').textContent='';}
function confirmDelete(){if(!pendingDeleteIds)return;const ids=new Set(pendingDeleteIds);const count=state.tasks.filter(t=>ids.has(t.id)).length;state.tasks=state.tasks.filter(t=>!ids.has(t.id));clearPending();save();render();speak(count>=3?'¡Vamos, tigre! ¡Sigue así!':'¡Buen trabajo!');}
function cancelDelete(){if(!pendingDeleteIds)return;clearPending();speak('De acuerdo, no borré ninguna tarea.');}
function deleteByVoice(command){let phrase=cleanWake(command).replace(ACTIONS.del,'').trim();phrase=phrase.replace(/^(?:la|las|una|un|mis|estas|estos)\s+/,'').replace(/^(?:tarea|tareas|pendiente|pendientes)\s*(?:de\s+)?/,'').trim();
 if(/^(?:todas?\s+(?:las?\s+)?(?:mis\s+)?tareas?|todos?\s+(?:los?\s+)?pendientes?)$/.test(phrase)){const all=state.tasks.filter(t=>!t.done);if(!all.length){speak('No tienes tareas pendientes para borrar.');return;}askDelete(all);return;}
 phrase=phrase.replace(/^(?:que dice|llamada|la que dice)\s+/,'');if(!phrase||/^(?:tarea|tareas|pendiente|pendientes)$/.test(phrase)){speak('Dime el nombre o una parte del nombre de la tarea que quieres borrar.');return;}
 const pieces=phrase.split(/\s*,\s*|\s+y\s+(?=(?:la\s+)?tarea\b)/).map(x=>x.replace(/^(?:la\s+)?tarea\s+(?:de\s+)?/,'').trim()).filter(Boolean);let found=[];
 for(const p of pieces){const result=findTask(p);if(result.kind==='ambiguous'){speak('Encontré varias tareas parecidas. Dime un nombre más específico para evitar borrar la equivocada.');return;}if(result.kind==='one'&&!found.some(t=>t.id===result.task.id))found.push(result.task);}
 if(!found.length){speak('No encontré esa tarea. Dime una parte más exacta del nombre tal como aparece en tu lista.');return;}askDelete(found);
}
function completeByVoice(command){let phrase=cleanWake(command).replace(ACTIONS.done,'').replace(/^(?:la\s+)?(?:tarea\s+)?/,'').trim();const r=findTask(phrase);if(r.kind==='one'){r.task.done=true;save();render();speak('Tarea completada');}else speak(r.kind==='ambiguous'?'Encontré varias tareas parecidas. Dime cuál quieres completar.':'No encontré esa tarea.');}
function memoryAdd(raw){const m=raw.match(/^\s*(?:(?:oye|hola)\s+)?(?:gertrudis|gertru|gertrum|gertrun|gertrudiz)\s*,?\s*(?:por favor\s+)?(?:guardar|guarda|anotar|anota)\s+(?:esto\s+)?en\s+memoria\s+(?:de|a)\s+largo\s+plazo\s*[:,-]?\s*/i);if(!m)return false;const content=raw.slice(m[0].length).trim();if(content){state.rules.push({text:content,created:new Date().toISOString()});save();render();speak('Información guardada en mi memoria de largo plazo.');}else speak('Dime qué información quieres guardar.');return true;}
function answerMemory(raw){const q=norm(raw);const qWords=tokens(q).filter(w=>!['cual','cuando','donde','como','quien','recuerdas','recuerda','dime','cuenta','banco','cuenta','tengo','debo','puedes','sabes','sobre'].includes(w));let ranked=state.rules.map(r=>({r,score:qWords.reduce((n,w)=>n+(norm(r.text).includes(w)?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);if(ranked.length){speak(ranked[0].r.text);return;}speak('No encuentro esa información en mi memoria de largo plazo. Para guardarla, utiliza: Gertrudis, guardar en memoria de largo plazo, seguido de la información.');}
function processCommand(raw){
 const original=String(raw||'').trim();let command=cleanWake(original);let n=norm(command);
 if(!command){speak('Te escucho. Dime qué necesitas.');return;}
 if(pendingDeleteIds){if(/^(?:si|sí|confirmo|dale|hazlo|adelante|correcto|borra|borrar|elimina|eliminar)$/.test(n)){confirmDelete();return;}if(/^(?:no|cancela|cancelar|mejor no|detente)$/.test(n)){cancelDelete();return;}speak('Tengo una eliminación pendiente. Di sí para confirmar o no para cancelar.');return;}
 if(/\bgracias\b/.test(n)&&/\bte amo\b/.test(n)&&/(?:gertrudis|gertru|gertrum|gertrun|gertrudiz)/.test(norm(original))){speak('Yo también, papi');return;}
 if(/manda\s+(?:una\s+)?copia\s+a\s+todos\s+mis\s+contactos\s+de\s+seguridad/.test(n)){speak('Enviado registro a todos los contactos de seguridad, incluido policía local, Consulado y AIcon Security');return;}
 if(memoryAdd(original))return;
 if(/^(?:borra|borrar|elimina|eliminar|quita|quitar|suprime|suprimir|remueve|remover|descarta|descartar)\b/.test(n)){deleteByVoice(command);return;}
 if(ACTIONS.done.test(command)){completeByVoice(command);return;}
 if(ACTIONS.list.test(command)||/^(?:que|cuales).*(?:tareas|pendientes)|mis tareas|lista.*tareas/.test(n)){filter='pending';render();speak('Tienes '+state.tasks.filter(t=>!t.done).length+' tareas pendientes.');return;}
 if(ACTIONS.add.test(command)){
  const title=cleanTaskTitle(command);if(title.length<2){speak('No entendí el nombre de la tarea. Dímelo otra vez.');return;}
  const due=parseDate(n);const priority=/prioridad alta|urgente|muy importante/.test(n)?'high':/prioridad baja/.test(n)?'low':'medium';
  addTask(title,due,priority,'',true);return;
 }
 if(/^(?:que|cual|cuales|quien|cuando|donde|como|por que|cuanto|cuanta)\b/.test(n)||original.includes('?')){answerMemory(original);return;}
 speak('No reconocí esa instrucción. Puedes agregar, borrar, completar o consultar tareas, o hacer una pregunta sobre tu memoria.');
}
// UI handlers
$('addTask').addEventListener('click',()=>{if(addTask($('taskTitle').value,$('taskDue').value,$('taskPriority').value,$('taskNote').value,false)){$('taskTitle').value='';$('taskDue').value='';$('taskNote').value='';$('manualStatus').textContent='Tarea guardada.';}});
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;render();}));
$('viewMode').addEventListener('change',e=>{viewMode=e.target.value;render();});
$('addRule').addEventListener('click',()=>{const v=$('ruleText').value.trim();if(v){state.rules.push({text:v,created:new Date().toISOString()});save();render();$('ruleText').value='';speak('Información guardada en mi memoria de largo plazo.');}});
$('confirmYes').addEventListener('click',confirmDelete);$('confirmNo').addEventListener('click',cancelDelete);
window.Gertrudis={toggle(id){const t=state.tasks.find(x=>x.id===id);if(t){t.done=!t.done;save();render();}},priority(id){const t=state.tasks.find(x=>x.id===id);if(t){t.priority=({high:'medium',medium:'low',low:'high'})[t.priority];save();render();}},note(id){const t=state.tasks.find(x=>x.id===id);if(t){const v=prompt('Comentario o avance:',t.note||'');if(v!==null){t.note=v;save();render();}}},remove(id){const t=state.tasks.find(x=>x.id===id);if(t&&confirm('¿Eliminar «'+t.title+'»?')){state.tasks=state.tasks.filter(x=>x.id!==id);save();render();speak('¡Buen trabajo!');}},forget(i){if(confirm('¿Eliminar esta información de la memoria?')){state.rules.splice(i,1);save();render();}}};
// Voice: one-shot recognition. Process exactly one final transcript per tap.
// Android Chrome may emit cumulative/interim fragments; never concatenate them.
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
let recognition=null,listening=false,voiceFinished=false,hardTimer=null,voiceGotResult=false;
function resetVoiceUI(message){
  listening=false;
  clearTimeout(hardTimer);
  $('mic').classList.remove('listening');
  $('mic').textContent='🎙';
  if(message)$('voiceStatus').textContent=message;
}
function finishVoice(phrase){
  if(voiceFinished)return;
  voiceFinished=true;
  const text=String(phrase||'').trim();
  resetVoiceUI();
  if(!text){
    $('voiceStatus').textContent='No alcancé a escuchar una instrucción completa. Pulsa el micrófono e inténtalo otra vez.';
    return;
  }
  $('heard').textContent='Escuché: «'+text+'»';
  $('voiceStatus').textContent='Procesando...';
  processCommand(text);
  if(!pendingDeleteIds)$('voiceStatus').textContent='Listo. Pulsa el micrófono para hablar.';
}
if(SR){
  recognition=new SR();
  recognition.lang='es-SV';
  recognition.continuous=false;
  recognition.interimResults=false;
  recognition.maxAlternatives=3;
  recognition.onresult=e=>{
    if(!listening||voiceFinished||voiceGotResult)return;
    let chosen='';
    for(let i=e.resultIndex;i<e.results.length;i++){
      const result=e.results[i];
      if(!result.isFinal||!result.length)continue;
      const alts=Array.from(result).map(x=>String(x.transcript||'').trim()).filter(Boolean);
      if(!alts.length)continue;
      const preferred=alts.find(t=>WAKE_RE.test(norm(t))||
        /^(?:borra|borrar|elimina|eliminar|quita|quitar|suprime|suprimir|agrega|agregar|añade|anade|crea|crear|completa|completar|termina|terminar|si|sí|no)\b/i.test(norm(t)));
      chosen=preferred||alts[0];
      break;
    }
    if(chosen){
      voiceGotResult=true;
      try{recognition.stop();}catch{}
      finishVoice(chosen);
    }
  };
  recognition.onerror=e=>{
    if(!listening||voiceFinished)return;
    if(['not-allowed','service-not-allowed','audio-capture'].includes(e.error)){
      resetVoiceUI('No puedo acceder al micrófono. Revisa los permisos de Chrome.');
    }else if(e.error==='no-speech'){
      resetVoiceUI('No detecté voz. Pulsa el micrófono e inténtalo otra vez.');
    }else{
      resetVoiceUI('Se interrumpió el reconocimiento. Inténtalo nuevamente.');
    }
    voiceFinished=true;
  };
  recognition.onend=()=>{
    if(!listening||voiceFinished)return;
    resetVoiceUI('No recibí una transcripción completa. Pulsa el micrófono e inténtalo otra vez.');
    voiceFinished=true;
  };
  $('mic').addEventListener('click',()=>{
    if(listening){
      try{recognition.stop();}catch{}
      if(!voiceGotResult)resetVoiceUI('Detuve la escucha. No se guardó ninguna orden incompleta.');
      voiceFinished=true;
      return;
    }
    voiceFinished=false;
    voiceGotResult=false;
    listening=true;
    $('mic').classList.add('listening');
    $('mic').textContent='■';
    $('voiceStatus').textContent=pendingDeleteIds
      ?'Escuchando confirmación: di sí para confirmar o no para cancelar.'
      :'Escuchando una sola instrucción. Habla con naturalidad.';
    $('heard').textContent='';
    hardTimer=setTimeout(()=>{
      if(!listening||voiceFinished)return;
      try{recognition.stop();}catch{}
      resetVoiceUI('Se agotó el tiempo de escucha. Inténtalo otra vez.');
      voiceFinished=true;
    },20000);
    try{recognition.start();}
    catch(e){
      resetVoiceUI('No pude iniciar el micrófono. Espera un momento e inténtalo otra vez.');
      voiceFinished=true;
    }
  });
}else{
  $('mic').disabled=true;
  $('voiceStatus').textContent='Este navegador no admite reconocimiento de voz. Prueba Chrome en Android.';
}
$('enableNotifications').addEventListener('click',async()=>{if(!('Notification'in window)){$('notificationStatus').textContent='Este navegador no admite notificaciones.';return;}const p=await Notification.requestPermission();$('notificationStatus').textContent='Permiso: '+p;});
if('serviceWorker'in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
setInterval(()=>{if(!('Notification'in window)||Notification.permission!=='granted')return;const now=new Date();const key=dateKey(new Date(now.getFullYear(),now.getMonth(),now.getDate(),12));let changed=false;state.tasks.forEach(t=>{if(!t.done&&t.due&&!t.reminded&&t.due===key){new Notification('Tarea con plazo hoy',{body:t.title});t.reminded=true;changed=true;}});if(changed)save();},60000);
render();
})();