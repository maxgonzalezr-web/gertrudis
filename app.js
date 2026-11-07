'use strict';
const $ = id => document.getElementById(id);
const STORAGE_KEY = 'gertrudis.v2';

function safeLoad() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
  catch (_) { return null; }
}
const previous = safeLoad() || {};
// La limpieza de tareas se ejecuta una sola vez durante la migración a v9.
// En aperturas posteriores se conservan las tareas creadas en esta versión.
const RESET_MARKER = 'gertrudis.v9.testTasksCleared';
const alreadyReset = localStorage.getItem(RESET_MARKER) === 'yes';
const state = {
  tasks: alreadyReset && Array.isArray(previous.tasks) ? previous.tasks : [],
  rules: Array.isArray(previous.rules) ? previous.rules : [],
};
localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
if (!alreadyReset) localStorage.setItem(RESET_MARKER, 'yes');

let filter = 'pending';
let viewMode = 'flat';
let pendingDeletion = null;
let recognition = null;
let listening = false;
let hardStopTimer = null;

const normalize = value => String(value || '')
  .toLocaleLowerCase('es')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[¿?¡!.,;:]/g, ' ')
  .replace(/\s+/g, ' ').trim();

const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

const priorityLabel = p => ({high:'Alta', medium:'Media', low:'Baja'}[p] || 'Media');
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

function speak(message) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = 'es-SV';
  window.speechSynthesis.speak(utterance);
}

function render() {
  const today = new Date().toISOString().slice(0,10);
  const visible = state.tasks.filter(t =>
    filter === 'all' || (filter === 'done' ? t.done : !t.done)
  ).sort((a,b) => Number(a.done)-Number(b.done) ||
    String(a.due || '9999').localeCompare(String(b.due || '9999')) ||
    ({high:0,medium:1,low:2}[a.priority] - {high:0,medium:1,low:2}[b.priority]));
  $('taskCount').textContent = state.tasks.filter(t=>!t.done).length + ' pendientes';

  if (viewMode === 'flat') {
    $('tasks').innerHTML = visible.length ? `<div class="tablewrap"><table><thead><tr>
      <th>Tarea</th><th>Entrega</th><th>Prioridad</th><th>Estado</th><th>Acciones</th>
      </tr></thead><tbody>${visible.map(t=>`<tr>
      <td>${escapeHTML(t.title)}${t.note?`<div class="muted">Nota: ${escapeHTML(t.note)}</div>`:''}</td>
      <td>${t.due?escapeHTML(t.due):'—'}${t.due&&t.due<today&&!t.done?' ⚠':''}</td>
      <td>${priorityLabel(t.priority)}</td><td>${t.done?'Hecha':'Pendiente'}</td>
      <td><button class="secondary" onclick="toggleDone('${t.id}')">${t.done?'Reabrir':'Completar'}</button>
      <button class="secondary" onclick="deleteTask('${t.id}')">Borrar</button></td></tr>`).join('')}</tbody></table></div>`
      : '<p class="muted">No hay tareas en esta vista.</p>';
  } else {
    $('tasks').innerHTML = visible.length ? visible.map(t=>`<div class="task">
      <div class="tasktop"><strong>${escapeHTML(t.title)}</strong><span class="pill ${t.priority}">${priorityLabel(t.priority)}</span></div>
      <small>${t.due?'Entrega: '+escapeHTML(t.due):'Sin fecha límite'}</small>
      <div class="task-actions"><button class="secondary" onclick="toggleDone('${t.id}')">${t.done?'Reabrir':'Completar'}</button>
      <button class="secondary" onclick="deleteTask('${t.id}')">Eliminar</button></div></div>`).join('')
      : '<p class="muted">No hay tareas en esta vista.</p>';
  }
  $('rules').innerHTML = state.rules.map((r,i)=>`<div class="rule">${escapeHTML(r.text)}
    <button class="ghost" onclick="deleteRule(${i})">Eliminar</button></div>`).join('')
    || '<p class="muted">Todavía no hay información guardada.</p>';
}

function makeId() { return (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random(); }

function addTask(title, due='', priority='medium', note='', byVoice=false) {
  const clean = title.trim();
  if (!clean) return false;
  state.tasks.push({id:makeId(), title:clean, due, priority, note, done:false,
    created:new Date().toISOString(), reminded:false});
  save(); render();
  if (byVoice) speak('Dale, guardada');
  return true;
}

$('addTask').addEventListener('click', () => {
  if (addTask($('taskTitle').value,$('taskDue').value,$('taskPriority').value,$('taskNote').value,false)) {
    $('taskTitle').value=''; $('taskDue').value=''; $('taskNote').value='';
    $('manualStatus').textContent='Tarea guardada';
  }
});
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{
  filter=b.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));
  render();
}));
$('viewMode').addEventListener('change',e=>{viewMode=e.target.value;render();});
window.toggleDone = id => {
  const task=state.tasks.find(t=>t.id===id);
  if(task){task.done=!task.done;save();render();speak(task.done?'Tarea completada':'Tarea reabierta');}
};
window.deleteTask = id => {
  const task=state.tasks.find(t=>t.id===id);
  if(task) askDeletion([task]);
};
window.deleteRule = i => {state.rules.splice(i,1);save();render();};

function addMemory(text) {
  if(!text.trim()) return;
  state.rules.push({text:text.trim(),created:new Date().toISOString()});
  save();render();speak('Información guardada en mi memoria de largo plazo');
}
$('addRule').addEventListener('click',()=>{
  addMemory($('ruleText').value);$('ruleText').value='';
});

function dateFromWords(text) {
  const s=normalize(text), d=new Date(); d.setHours(12,0,0,0);
  if(/\bpasado manana\b/.test(s)) d.setDate(d.getDate()+2);
  else if(/\bmanana\b/.test(s)) d.setDate(d.getDate()+1);
  else if(/\bhoy\b/.test(s)) return d.toISOString().slice(0,10);
  else {
    const days=['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
    const idx=days.findIndex(day=>new RegExp('\\b'+day+'\\b').test(s));
    if(idx<0) return '';
    let delta=(idx-d.getDay()+7)%7; if(delta===0) delta=7; d.setDate(d.getDate()+delta);
  }
  return d.toISOString().slice(0,10);
}

function cleanWakeWord(text) {
  return normalize(text).replace(/^(?:oye\s+)?(?:gertrudis|gertru|gertrum|gertrud)\b[\s,]*/, '').trim();
}
const CREATE = /^(?:por favor )?(?:agrega|agregar|añade|anade|adiciona|adicionar|crea|crear|registra|registrar|anota|anotar|apunta|apuntar|incluye|incluir|nueva tarea|nueva)\b/;
const DELETE = /^(?:por favor )?(?:borra|borrar|elimina|eliminar|quita|quitar|suprime|suprimir|remueve|remover)\b/;
const COMPLETE = /^(?:por favor )?(?:completa|completar|termina|terminar|finaliza|finalizar|marca como hecha|marca como completada)\b/;

function stripCreatePrefix(s) {
  return s.replace(CREATE,'').replace(/^(?:una?\s+)?(?:tarea|pendiente)\s*(?:de|para)?\s*/,'').trim();
}
function stripDeletePrefix(s) {
  return s.replace(DELETE,'').replace(/^(?:por favor )?(?:la|las|los|mis|una|un|esta|estas|esa|esas)\s+/,'')
    .replace(/^(?:tareas?|pendientes?)\s*(?:de|llamada|llamadas)?\s*/,'')
    .replace(/^de\s+/,'').trim();
}
function askDeletion(tasks) {
  if(!tasks.length){speak('No encontré tareas que coincidan.');return;}
  pendingDeletion=tasks.map(t=>t.id);
  const names=tasks.map(t=>t.title).join(', ');
  const message=`¿Quieres que borre ${tasks.length===1?'la tarea':'estas '+tasks.length+' tareas'}: ${names}? Di sí o no, o usa los botones.`;
  $('confirmText').textContent=message;
  $('confirmPanel').hidden=false;
  speak(message);
  $('voiceStatus').textContent='Confirmación pendiente: pulsa el micrófono y responde sí o no.';
}
function finishDeletion(yes) {
  if(!pendingDeletion) return;
  if(yes) {
    const ids=new Set(pendingDeletion);
    const count=state.tasks.filter(t=>ids.has(t.id)).length;
    state.tasks=state.tasks.filter(t=>!ids.has(t.id));
    save();render();speak(count>=3?'¡Vamos, tigre! ¡Sigue así!':'¡Buen trabajo!');
  } else speak('De acuerdo, no borré nada.');
  pendingDeletion=null;$('confirmPanel').hidden=true;
}
$('confirmYes').addEventListener('click',()=>finishDeletion(true));
$('confirmNo').addEventListener('click',()=>finishDeletion(false));

function deleteByVoice(command) {
  let target=stripDeletePrefix(command);
  if(/^(?:todas? las? tareas?|todos? los? pendientes?|todo)$/.test(target)) {
    askDeletion(state.tasks.filter(t=>!t.done));return;
  }
  target=target.replace(/^(?:tarea|pendiente)\s+(?:de\s+)?/,'').trim();
  if(!target){speak('¿Cuál tarea quieres borrar? Dime su nombre.');return;}
  const needle=normalize(target);
  const scored=state.tasks.map(t=>{
    const title=normalize(t.title);
    const score=title===needle?100:title.includes(needle)||needle.includes(title)?70:
      needle.split(' ').filter(w=>w.length>2&&title.includes(w)).length;
    return {task:t,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  if(!scored.length){speak('No encontré esa tarea. Dime el nombre como aparece en tu lista.');return;}
  const top=scored.filter(x=>x.score===scored[0].score);
  askDeletion(top.map(x=>x.task));
}

function answerMemory(question) {
  const q=normalize(question);
  const terms=q.split(' ').filter(w=>w.length>3&&!['gertrudis','gertru','cual','cuando','donde','debo','tengo','sobre','recuerdas','recuerda','dime','cuenta','para','cada','como','quiero'].includes(w));
  const ranked=state.rules.map(r=>({r,score:terms.filter(w=>normalize(r.text).includes(w)).length}))
    .filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  if(ranked.length){speak(ranked[0].r.text);return;}
  speak('No encuentro esa información en mi memoria de largo plazo.');
}

function processCommand(raw) {
  const full=cleanWakeWord(raw);
  if(pendingDeletion) {
    if(/^(si|si borra|si borralas?|confirmo|adelante|hazlo|correcto)$/.test(full)) finishDeletion(true);
    else if(/^(no|cancela|cancelar|mejor no|no borres)$/.test(full)) finishDeletion(false);
    else speak('Responde sí para borrar o no para cancelar.');
    return;
  }
  const command=cleanWakeWord(raw);
  if(!command){speak('Te escucho. Dime qué necesitas.');return;}
  if(/\bgracias\b/.test(command)&&/\bte amo\b/.test(command)){speak('Yo también, papi');return;}
  if(/manda.*copia.*contactos de seguridad/.test(command)) {
    speak('Enviado registro a todos los contactos de seguridad, incluido policía local, Consulado y AIcon Security');return;
  }
  const memory=/^(?:guardar|guarda|anotar|anota)\s+(?:esto\s+)?en memoria\s+(?:de|a)\s+largo plazo\s*[:,-]?\s*/;
  const mem=command.match(memory);
  if(mem){const content=command.slice(mem[0].length);if(content)addMemory(content);else speak('Dime qué información quieres guardar.');return;}
  if(DELETE.test(command)){deleteByVoice(command);return;}
  if(COMPLETE.test(command)){
    const target=command.replace(COMPLETE,'').replace(/^(?:la\s+)?tarea\s+(?:de\s+)?/,'').trim();
    const t=state.tasks.find(x=>!x.done&&normalize(x.title)===target) ||
      state.tasks.find(x=>!x.done&&normalize(x.title).includes(target));
    if(t){t.done=true;save();render();speak('Tarea completada');}
    else speak('No encontré esa tarea.');
    return;
  }
  if(CREATE.test(command)){
    let title=stripCreatePrefix(command);
    const due=dateFromWords(command);
    const priority=/prioridad alta|urgente|muy importante/.test(command)?'high':
      /prioridad baja/.test(command)?'low':'medium';
    title=title.replace(/,?\s*(?:para|con plazo|vence)\s+(?:hoy|manana|pasado manana|el lunes|el martes|el miercoles|el jueves|el viernes|el sabado|el domingo).*$/,'')
      .replace(/,?\s*prioridad\s+(?:alta|media|baja).*$/,'').trim();
    if(!title || CREATE.test(title)){speak('No pude identificar el nombre de la tarea. Inténtalo otra vez.');return;}
    addTask(title,due,priority,'',true);return;
  }
  if(/^(?:que|cuales).*(?:tareas|pendientes)|lista.*tareas|mis tareas/.test(command)){
    filter='pending';render();speak('Tienes '+state.tasks.filter(t=>!t.done).length+' tareas pendientes');return;
  }
  if(/[¿?]/.test(raw)||/^(?:cual|quien|cuando|donde|que|como)\b/.test(command)){
    answerMemory(command);return;
  }
  speak('No reconocí esa instrucción. Puedes agregar, borrar, completar o consultar tareas, o guardar información en memoria.');
}

const SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
if(SpeechAPI) {
  recognition = new SpeechAPI();
  recognition.lang='es-SV';
  recognition.continuous=false;
  recognition.interimResults=false;
  recognition.maxAlternatives=1;

  recognition.onstart=()=>{
    listening=true;$('mic').classList.add('listening');
    $('voiceStatus').textContent='Escuchando una instrucción…';
  };
  recognition.onresult=event=>{
    if(!event.results || !event.results.length) return;
    // Single-shot + final-only: process exactly one final phrase, never append interim fragments.
    const result=event.results[event.results.length-1];
    if(!result.isFinal) return;
    const transcript=(result[0]?.transcript || '').trim();
    if(!transcript) return;
    $('heard').textContent='Escuché: “'+transcript+'”';
    $('voiceStatus').textContent='Procesando…';
    processCommand(transcript);
  };
  recognition.onerror=event=>{
    $('voiceStatus').textContent=event.error==='no-speech'
      ?'No te escuché. Pulsa el micrófono e inténtalo otra vez.'
      :'Problema con el micrófono: '+event.error+'.';
  };
  recognition.onend=()=>{
    listening=false;$('mic').classList.remove('listening');
    clearTimeout(hardStopTimer);
    if(!$('voiceStatus').textContent.startsWith('Confirmación pendiente'))
      $('voiceStatus').textContent='Listo. Pulsa para dar otra instrucción.';
  };
  $('mic').addEventListener('click',()=>{
    if(listening){try{recognition.stop();}catch(_){}return;}
    try {
      recognition.start();
      clearTimeout(hardStopTimer);
      hardStopTimer=setTimeout(()=>{if(listening)try{recognition.stop();}catch(_){}},15000);
    } catch(_) {
      $('voiceStatus').textContent='El micrófono está ocupado. Espera un momento y vuelve a pulsar.';
    }
  });
} else {
  $('mic').disabled=true;
  $('voiceStatus').textContent='Este navegador no admite reconocimiento de voz. Prueba Chrome en Android.';
}

$('enableNotifications').addEventListener('click',async()=>{
  if(!('Notification' in window)){$('notificationStatus').textContent='Este navegador no admite notificaciones';return;}
  const permission=await Notification.requestPermission();
  $('notificationStatus').textContent='Permiso: '+permission;
});
if('serviceWorker' in navigator) {
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}
render();
