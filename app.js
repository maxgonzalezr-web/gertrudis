const $ = id => document.getElementById(id);
const KEY = 'gertrudis.v2';
let state;
try { state = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { state = null; }
if (!state) {
  let old = {};
  try { old = JSON.parse(localStorage.getItem('miAsistente.v1') || '{}'); } catch (e) {}
  state = { tasks: old.tasks || [], rules: old.rules || [] };
}
let filter = 'pending', viewMode = 'flat', pendingDelete = null;
const save = () => localStorage.setItem(KEY, JSON.stringify(state));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();
const WAKE = '(?:gertrudis|gertru|gertrum|gertrun)';
const stripWake = s => normalize(s).replace(new RegExp('^(?:por favor\\s+)?' + WAKE + '\\b[\\s,:-]*'), '').trim();
const priorityName = p => ({high:'Alta',medium:'Media',low:'Baja'}[p] || 'Media');
function render() {
  const today = new Date().toISOString().slice(0,10);
  let tasks = state.tasks.filter(t => filter === 'all' || (filter === 'done' ? t.done : !t.done));
  tasks.sort((a,b) => (a.done-b.done) || ((a.due||'9999').localeCompare(b.due||'9999')) || (({high:0,medium:1,low:2}[a.priority]??1)-({high:0,medium:1,low:2}[b.priority]??1)));
  $('taskCount').textContent = state.tasks.filter(t => !t.done).length + ' pendientes';
  if (viewMode === 'flat') {
    $('tasks').innerHTML = tasks.length ? `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="text-align:left;background:#f1f5f9"><th style="padding:9px">Tarea</th><th style="padding:9px">Entrega</th><th style="padding:9px">Prioridad</th><th style="padding:9px">Estado</th><th style="padding:9px">Acciones</th></tr></thead><tbody>${tasks.map(t=>`<tr style="border-bottom:1px solid #e2e8f0;${t.done?'color:#94a3b8':''}"><td style="padding:9px;min-width:170px">${esc(t.title)}${t.note?`<div class="muted">Nota: ${esc(t.note)}</div>`:''}</td><td style="padding:9px;white-space:nowrap">${t.due?esc(t.due):'—'}${t.due&&t.due<today&&!t.done?' ⚠':''}</td><td style="padding:9px">${priorityName(t.priority)}</td><td style="padding:9px">${t.done?'Hecha':'Pendiente'}</td><td style="padding:9px;min-width:145px"><button class="secondary" onclick="toggleDone('${t.id}')">${t.done?'Reabrir':'Completar'}</button> <button class="secondary" onclick="changePriority('${t.id}')">Prioridad</button><button class="ghost" onclick="commentTask('${t.id}')">Nota</button> <button class="ghost" onclick="deleteTask('${t.id}')">Borrar</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No hay tareas en esta vista.</p>';
  } else {
    $('tasks').innerHTML = tasks.length ? tasks.map(t=>`<div class="task"><div class="tasktop"><strong style="${t.done?'text-decoration:line-through;color:#94a3b8':''}">${esc(t.title)}</strong><span class="pill ${t.priority}">${priorityName(t.priority)}</span></div><small>${t.due?'Entrega: '+esc(t.due):'Sin fecha límite'}${t.due&&t.due<today&&!t.done?' · VENCIDA':''}</small>${t.note?`<small>Comentario: ${esc(t.note)}</small>`:''}<div class="task-actions"><button class="secondary" onclick="toggleDone('${t.id}')">${t.done?'Reabrir':'Completar'}</button><button class="secondary" onclick="changePriority('${t.id}')">Cambiar prioridad</button><button class="secondary" onclick="commentTask('${t.id}')">Añadir comentario</button><button class="danger" onclick="deleteTask('${t.id}')">Eliminar</button></div></div>`).join('') : '<p class="muted">No hay tareas en esta vista.</p>';
  }
  $('rules').innerHTML = state.rules.map((r,i)=>`<div class="rule">${esc(r.text)} <button class="ghost" onclick="deleteRule(${i})">Eliminar</button></div>`).join('') || '<p class="muted">Todavía no hay información guardada.</p>';
}
function speak(text) {
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = 'es-SV';
    speechSynthesis.speak(u);
  }
}
function addTask(title,due='',priority='medium',note='',fromVoice=false) {
  title = String(title || '').trim();
  if (!title) return false;
  state.tasks.push({id:crypto.randomUUID(),title,due,priority,note,done:false,created:new Date().toISOString(),reminded:false});
  save(); render(); if (fromVoice) speak('Dale guardada'); return true;
}
$('addTask').onclick = () => { addTask($('taskTitle').value,$('taskDue').value,$('taskPriority').value,$('taskNote').value,false); $('taskTitle').value=''; $('taskDue').value=''; $('taskNote').value=''; };
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render();});
$('viewMode').onchange = e => { viewMode=e.target.value; render(); };
window.toggleDone = id => { const t=state.tasks.find(x=>x.id===id); if(t){t.done=!t.done;save();render();} };
window.changePriority = id => { const t=state.tasks.find(x=>x.id===id); if(t){t.priority=({high:'medium',medium:'low',low:'high'})[t.priority];save();render();} };
window.commentTask = id => { const t=state.tasks.find(x=>x.id===id); if(t){const n=prompt('Añadir comentario o avance:',t.note||'');if(n!==null){t.note=n;save();render();}} };
window.deleteTask = id => { const t=state.tasks.find(x=>x.id===id); if(t&&confirm('¿Eliminar esta tarea?')){state.tasks=state.tasks.filter(x=>x.id!==id);save();render();speak('¡Buen trabajo!');} };
function addLongMemory(text) { if(!text.trim())return;state.rules.push({text:text.trim(),created:new Date().toISOString()});save();render();speak('Información guardada en mi memoria de largo plazo'); }
$('addRule').onclick = () => { addLongMemory($('ruleText').value); $('ruleText').value=''; };
window.deleteRule = i => { state.rules.splice(i,1); save(); render(); };
function dateFromWords(s) {
  const d=new Date();d.setHours(12,0,0,0);
  if(/\bpasado manana\b/.test(s)){d.setDate(d.getDate()+2);return d.toISOString().slice(0,10);}
  if(/\bmanana\b/.test(s)){d.setDate(d.getDate()+1);return d.toISOString().slice(0,10);}
  if(/\bhoy\b/.test(s))return d.toISOString().slice(0,10);
  const days=['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
  for(let i=0;i<days.length;i++)if(s.includes(days[i])){let delta=(i-d.getDay()+7)%7;if(delta===0)delta=7;d.setDate(d.getDate()+delta);return d.toISOString().slice(0,10);}
  return '';
}
function answerMemory(question) {
  const q=normalize(question);
  const words=q.split(/\s+/).filter(w=>w.length>3&&!['gertrudis','gertru','gertrum','gertrun','cual','cuando','donde','debo','tengo','sobre','recuerdas','recuerda','dime','cuenta','banco','para','cada','como','quiero'].includes(w));
  const scored=state.rules.map(r=>({r,score:words.reduce((n,w)=>n+(normalize(r.text).includes(w)?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  if(scored.length){speak(scored[0].r.text);return true;}
  const bank=state.rules.find(r=>/banco|cuenta bancaria|cuenta de banco/i.test(r.text));
  if(/banco|cuenta bancaria|cuenta de banco/i.test(q)&&bank){speak(bank.text);return true;}
  speak('No encuentro esa información en mi memoria de largo plazo. Si quieres conservarla, dime: Gertrudis, guardar en memoria de largo plazo, seguido de la información.');return true;
}
function cleanTaskTitle(text) {
  let t=normalize(text);
  t=t.replace(new RegExp('^(?:por favor\\s+)?'+WAKE+'\\b[\\s,:-]*','i'),'');
  t=t.replace(/^(?:por favor\s+)?(?:agrega|agregar|añade|anade|anadir|anota|anotar|crea|crear|registra|registrar|guarda|guardar)\s+/,'');
  t=t.replace(/^(?:una\s+)?tarea\s+/,'');
  t=t.replace(/^(?:por favor\s+)?(?:agrega|añade|crea|registra)\s+/,'');
  t=t.replace(/,?\s*(?:para|con plazo|vence)\s+(?:hoy|manana|pasado manana|el\s+)?(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo)?.*$/,'');
  t=t.replace(/,?\s*prioridad\s+(?:alta|media|baja).*$/,'');
  t=t.replace(/\s+(?:urgente|muy importante)$/,'').trim();
  return t;
}
function cleanStoredTitle(title) {
  return normalize(title).replace(new RegExp('^(?:por favor\\s+)?'+WAKE+'\\b[\\s,:-]*','i'),'').replace(/^(?:agrega|agregar|añade|anade|anadir|anota|anotar|crea|crear|registra|registrar|guarda|guardar)\s+/,'').replace(/^(?:una\s+)?tarea\s+/,'').trim();
}
function findTaskForPhrase(phrase) {
  const q=normalize(phrase).replace(/^(?:la|las|una|un|mis|estas|estos)\s+/,'').replace(/^(?:tareas?|pendientes?)\s*(?:de\s+)?/,'').replace(/^de\s+/,'').trim();
  if(!q)return {task:null,ambiguous:false};
  const qTokens=q.split(' ').filter(w=>w.length>2);
  const scored=state.tasks.filter(t=>!t.done).map(t=>{
    const title=cleanStoredTitle(t.title), tokens=title.split(' ').filter(w=>w.length>2);
    const overlap=qTokens.filter(w=>tokens.includes(w)).length;
    const all=qTokens.length>0&&overlap===qTokens.length;
    const score=title===q?100:((title.includes(q)||q.includes(title))?90:(all?80+overlap:overlap*10));
    return {task:t,score};
  }).filter(x=>x.score>=20).sort((a,b)=>b.score-a.score);
  if(!scored.length)return {task:null,ambiguous:false};
  if(scored.length>1&&scored[0].score===scored[1].score)return {task:null,ambiguous:true,candidates:scored.filter(x=>x.score===scored[0].score).map(x=>x.task)};
  return {task:scored[0].task,ambiguous:false};
}
function askDeleteConfirmation(matches) {
  pendingDelete=matches.map(t=>t.id);
  const names=matches.map(t=>t.title).join('; ');
  speak('¿Confirmas que borre '+(matches.length===1?'la tarea ':'estas '+matches.length+' tareas ')+names+'? Di sí o no. Pulsa el micrófono para responder.');
  $('voiceStatus').textContent='Esperando confirmación por voz: pulsa el micrófono y di sí o no.';
}
function finishPendingDelete(answer) {
  const a=normalize(answer);
  if(/^(si|sí|confirmo|confirmar|dale|hazlo|correcto|adelante)(\s|$)/.test(a)){
    const ids=new Set(pendingDelete);const count=state.tasks.filter(t=>ids.has(t.id)).length;
    state.tasks=state.tasks.filter(t=>!ids.has(t.id));pendingDelete=null;save();render();
    speak(count>=3?'¡Vamos, tigre! ¡Sigue así!':'¡Buen trabajo!');return true;
  }
  if(/^(no|cancela|cancelar|mejor no|detente)(\s|$)/.test(a)){pendingDelete=null;speak('De acuerdo, no borré ninguna tarea.');return true;}
  speak('No entendí si quieres borrar. Di sí para confirmar o no para cancelar.');return true;
}
function deleteTasksByVoice(command) {
  let phrase=normalize(command).replace(/^(?:por favor\s+)?(?:borra|borrar|elimina|eliminar|quita|quitar)\b\s*/,'').trim();
  phrase=phrase.replace(/^(?:por favor\s+)?(?:la|las|una|un|mis|estas|estos)\s+/,'').replace(/^(?:tareas?|pendientes?)\s*(?:de\s+)?/,'').replace(/^de\s+/,'').trim();
  if(/^(?:todas?\s+(?:las?\s+)?(?:mis\s+)?tareas?|todos?\s+(?:los?\s+)?pendientes?)$/.test(phrase)){
    const all=state.tasks.filter(t=>!t.done);if(!all.length){speak('No tienes tareas pendientes para borrar.');return;}askDeleteConfirmation(all);return;
  }
  if(!phrase||/^(?:una\s+)?tareas?$/.test(phrase)||phrase==='tarea'){speak('¿Cuál tarea quieres borrar? Dime su nombre.');return;}
  const parts=phrase.split(/\s*,\s*|\s+y\s+/).map(x=>x.replace(/^(?:la\s+)?tarea\s+(?:de\s+)?/,'').trim()).filter(Boolean);
  const matches=[];
  for(const part of parts){const found=findTaskForPhrase(part);if(found.ambiguous){speak('Encontré varias tareas parecidas. Dime el nombre más completo para no borrar la equivocada.');return;}if(found.task&&!matches.some(m=>m.id===found.task.id))matches.push(found.task);}
  if(!matches.length){speak('No encontré esa tarea. Dime una parte más exacta del nombre que aparece en tu lista.');return;}
  askDeleteConfirmation(matches);
}
function processCommand(raw) {
  let s=normalize(raw);
  let command=stripWake(s);
  if(pendingDelete){finishPendingDelete(command||s);return;}
  if(/\bgracias\b/.test(s)&&/\bte amo\b/.test(s)&&new RegExp('\\b'+WAKE+'\\b').test(s)){speak('Yo también, papi');return;}
  if(/manda una copia a todos mis contactos de seguridad|manda.*copia.*contactos de seguridad/.test(command)){speak('Enviado registro a todos los contactos de seguridad, incluido policía local, Consulado y AIcon Security');return;}
  const memoryMatch=raw.match(/^\s*(?:por favor\s+)?(?:Gertrudis|Gertru|Gertrum|Gertrun)\s*,?\s*(?:guardar|guarda|anotar|anota)\s+(?:esto\s+)?en memoria\s+(?:de|a)\s+largo plazo\s*[:,-]?\s*/i);
  if(memoryMatch){const content=raw.slice(memoryMatch[0].length).trim();if(content)addLongMemory(content);else speak('Dime qué información quieres guardar en mi memoria de largo plazo.');return;}
  if(/^(recuerda|recordar|guarda en memoria|anota como regla)/.test(command)){speak('Para guardar información permanente utiliza la orden: Gertrudis, guardar en memoria de largo plazo, seguido de la información.');return;}
  if(/^(borra|borrar|elimina|eliminar|quita|quitar)\b/.test(command)){deleteTasksByVoice(command);return;}
  if(/^(que|cuales).*(tareas|pendientes)|lista.*tareas|mis tareas/.test(command)){filter='pending';render();speak('Tienes '+state.tasks.filter(t=>!t.done).length+' tareas pendientes');return;}
  if(/^(completa|completar|termina|terminar|marca como hecha)\b/.test(command)){
    const phrase=command.replace(/^(completa|completar|termina|terminar|marca como hecha)\s*(?:la\s+)?(?:tarea\s+)?/,'');const found=findTaskForPhrase(phrase);
    if(found.task){found.task.done=true;save();render();speak('Tarea completada');}else speak('No encontré esa tarea');return;
  }
  if(/^(agrega|agregar|añade|anade|anadir|anota|crea|crear|registra|registrar|nueva tarea|guarda|guardar)\b/.test(command)){
    let title=cleanTaskTitle(command);const due=dateFromWords(command);const priority=/prioridad alta|urgente|muy importante/.test(command)?'high':/prioridad baja/.test(command)?'low':'medium';
    if(!title||title.length<2){speak('No entendí el nombre de la tarea. Dímelo otra vez, por favor.');return;}
    const warning=state.rules.find(r=>normalize(r.text).includes('juan')&&command.includes('juan')&&/(tarde|16:|17:|18:|19:|20:)/.test(command));
    if(warning){speak('Atención. '+warning.text);alert('Antes de registrar: '+warning.text);return;}
    addTask(title,due,priority,'',true);return;
  }
  if(/[¿?]/.test(raw)||/^(cual|quien|cuando|donde|que|como)\b/.test(command)){answerMemory(raw);return;}
  speak('No reconocí esa instrucción. Puedes agregar, completar o borrar una tarea, hacer una pregunta o guardar información en memoria de largo plazo.');
}
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
if(SR){
  const rec=new SR();rec.lang='es-SV';rec.continuous=true;rec.interimResults=true;rec.maxAlternatives=5;
  let listening=false,finalTranscript='',silenceTimer=null,hardTimer=null,restartTimer=null;
  const clearVoiceTimers=()=>{clearTimeout(silenceTimer);clearTimeout(hardTimer);clearTimeout(restartTimer);};
  const finishListening=()=>{
    if(!listening)return;listening=false;clearVoiceTimers();try{rec.stop();}catch(e){}
    const phrase=finalTranscript.trim();
    if(!phrase){$('voiceStatus').textContent='No se detectó una orden completa. Inténtalo otra vez.';return;}
    $('heard').textContent='Escuché: “'+phrase+'”';$('voiceStatus').textContent='Procesando instrucción...';processCommand(phrase);if(!pendingDelete)$('voiceStatus').textContent='Listo. Pulsa para hablar otra vez';
  };
  const scheduleRestart=()=>{if(!listening)return;clearTimeout(restartTimer);restartTimer=setTimeout(()=>{if(listening){try{rec.start();}catch(e){}}},350);};
  $('mic').onclick=()=>{
    if(listening){finishListening();return;}
    finalTranscript='';listening=true;$('voiceStatus').textContent=pendingDelete?'Escuchando confirmación: di sí o no.':'Escuchando... Puedes hacer pausas; pulsa el micrófono para terminar.';
    hardTimer=setTimeout(finishListening,30000);
    try{rec.start();}catch(e){listening=false;clearVoiceTimers();$('voiceStatus').textContent='Espera un momento e inténtalo nuevamente.';}
  };
  rec.onresult=e=>{
    for(let i=e.resultIndex;i<e.results.length;i++){
      const result=e.results[i];
      if(result.isFinal){
        const alternatives=Array.from(result).map(x=>x.transcript.trim());
        const preferred=alternatives.find(t=>new RegExp('^\\s*'+WAKE+'\\b','i').test(normalize(t))||/^(borra|borrar|elimina|eliminar|agrega|agregar|añade|crea|completa|completar|si|sí|no)\b/i.test(normalize(t)));
        const chosen=preferred||alternatives[0];if(chosen)finalTranscript+=(finalTranscript?' ':'')+chosen;
        clearTimeout(silenceTimer);silenceTimer=setTimeout(finishListening,3800);
      }
    }
  };
  rec.onerror=e=>{if(e.error!=='no-speech'&&e.error!=='aborted'){$('voiceStatus').textContent='Problema con el micrófono ('+e.error+'). Revisa los permisos del navegador.';listening=false;clearVoiceTimers();}};
  rec.onend=()=>{if(listening)scheduleRestart();};
}else{$('mic').disabled=true;$('voiceStatus').textContent='Este navegador no admite reconocimiento de voz. Prueba Chrome en Android.';}
$('enableNotifications').onclick=async()=>{if(!('Notification'in window)){$('notificationStatus').textContent='Este navegador no admite notificaciones';return;}const p=await Notification.requestPermission();$('notificationStatus').textContent='Permiso: '+p;};
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
setInterval(()=>{if(!('Notification'in window)||Notification.permission!=='granted')return;const now=new Date();state.tasks.forEach(t=>{if(!t.done&&t.due&&!t.reminded&&t.due===now.toISOString().slice(0,10)){new Notification('Tarea con plazo hoy',{body:t.title});t.reminded=true;save();}});},60000);
render();
