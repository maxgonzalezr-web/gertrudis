const $=id=>document.getElementById(id);
const KEY='gertrudis.v2';
let state;
try{state=JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){state=null}
if(!state){let old={};try{old=JSON.parse(localStorage.getItem('miAsistente.v1')||'{}')}catch(e){}state={tasks:old.tasks||[],rules:old.rules||[]}}
let filter='pending',viewMode='flat';
const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const priorityName=p=>({high:'Alta',medium:'Media',low:'Baja'}[p]||'Media');
const normalize=s=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[¿?¡!.,;:]/g,' ').replace(/\s+/g,' ').trim();
function render(){
 const today=new Date().toISOString().slice(0,10);
 let tasks=state.tasks.filter(t=>filter==='all'||(filter==='done'?t.done:!t.done));
 tasks.sort((a,b)=>(a.done-b.done)||((a.due||'9999').localeCompare(b.due||'9999'))||(({high:0,medium:1,low:2}[a.priority]??1)-({high:0,medium:1,low:2}[b.priority]??1)));
 $('taskCount').textContent=state.tasks.filter(t=>!t.done).length+' pendientes';
 if(viewMode==='flat'){
  $('tasks').innerHTML=tasks.length?`<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="text-align:left;background:#f1f5f9"><th style="padding:9px">Tarea</th><th style="padding:9px">Entrega</th><th style="padding:9px">Prioridad</th><th style="padding:9px">Estado</th><th style="padding:9px">Acciones</th></tr></thead><tbody>${tasks.map(t=>`<tr style="border-bottom:1px solid #e2e8f0;${t.done?'color:#94a3b8':''}"><td style="padding:9px;min-width:170px">${esc(t.title)}${t.note?`<div class="muted">Nota: ${esc(t.note)}</div>`:''}</td><td style="padding:9px;white-space:nowrap">${t.due?esc(t.due):'—'}${t.due&&t.due<today&&!t.done?' ⚠':''}</td><td style="padding:9px">${priorityName(t.priority)}</td><td style="padding:9px">${t.done?'Hecha':'Pendiente'}</td><td style="padding:9px;min-width:145px"><button class="secondary" onclick="toggleDone('${t.id}')">${t.done?'Reabrir':'Completar'}</button> <button class="secondary" onclick="changePriority('${t.id}')">Prioridad</button><button class="ghost" onclick="commentTask('${t.id}')">Nota</button> <button class="ghost" onclick="deleteTask('${t.id}')">Borrar</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">No hay tareas en esta vista.</p>';
 }else{
  $('tasks').innerHTML=tasks.length?tasks.map(t=>`<div class="task"><div class="tasktop"><strong style="${t.done?'text-decoration:line-through;color:#94a3b8':''}">${esc(t.title)}</strong><span class="pill ${t.priority}">${priorityName(t.priority)}</span></div><small>${t.due?'Entrega: '+esc(t.due):'Sin fecha límite'}${t.due&&t.due<today&&!t.done?' · VENCIDA':''}</small>${t.note?`<small>Comentario: ${esc(t.note)}</small>`:''}<div class="task-actions"><button class="secondary" onclick="toggleDone('${t.id}')">${t.done?'Reabrir':'Completar'}</button><button class="secondary" onclick="changePriority('${t.id}')">Cambiar prioridad</button><button class="secondary" onclick="commentTask('${t.id}')">Añadir comentario</button><button class="danger" onclick="deleteTask('${t.id}')">Eliminar</button></div></div>`).join(''):'<p class="muted">No hay tareas en esta vista.</p>';
 }
 $('rules').innerHTML=state.rules.map((r,i)=>`<div class="rule">${esc(r.text)} <button class="ghost" onclick="deleteRule(${i})">Eliminar</button></div>`).join('')||'<p class="muted">Todavía no hay información guardada.</p>';
}
function speak(text){if('speechSynthesis'in window){speechSynthesis.cancel();let u=new SpeechSynthesisUtterance(text);u.lang='es-SV';speechSynthesis.speak(u)}}
function addTask(title,due='',priority='medium',note='',fromVoice=false){if(!title.trim())return false;state.tasks.push({id:crypto.randomUUID(),title:title.trim(),due,priority,note,done:false,created:new Date().toISOString(),reminded:false});save();render();if(fromVoice)speak('Dale guardada');return true}
$('addTask').onclick=()=>{addTask($('taskTitle').value,$('taskDue').value,$('taskPriority').value,$('taskNote').value,false);$('taskTitle').value='';$('taskDue').value='';$('taskNote').value=''};
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render()});
$('viewMode').onchange=e=>{viewMode=e.target.value;render()};
window.toggleDone=id=>{let t=state.tasks.find(x=>x.id===id);if(t){t.done=!t.done;save();render()}};
window.changePriority=id=>{let t=state.tasks.find(x=>x.id===id);if(t){t.priority=({high:'medium',medium:'low',low:'high'})[t.priority];save();render()}};
window.commentTask=id=>{let t=state.tasks.find(x=>x.id===id);if(t){let n=prompt('Añadir comentario o avance:',t.note||'');if(n!==null){t.note=n;save();render()}}};
window.deleteTask=id=>{let t=state.tasks.find(x=>x.id===id);if(t&&confirm('¿Eliminar esta tarea?')){state.tasks=state.tasks.filter(x=>x.id!==id);save();render()}};
function addLongMemory(text){if(!text.trim())return;state.rules.push({text:text.trim(),created:new Date().toISOString()});save();render();speak('Información guardada en mi memoria de largo plazo')}
$('addRule').onclick=()=>{addLongMemory($('ruleText').value);$('ruleText').value=''};
window.deleteRule=i=>{state.rules.splice(i,1);save();render()};
function dateFromWords(s){let d=new Date();d.setHours(12,0,0,0);if(/\bpasado manana\b/.test(s)){d.setDate(d.getDate()+2);return d.toISOString().slice(0,10)}if(/\bmanana\b/.test(s)){d.setDate(d.getDate()+1);return d.toISOString().slice(0,10)}if(/\bhoy\b/.test(s))return d.toISOString().slice(0,10);const days=['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];for(let i=0;i<days.length;i++)if(s.includes(days[i])){let delta=(i-d.getDay()+7)%7;if(delta===0)delta=7;d.setDate(d.getDate()+delta);return d.toISOString().slice(0,10)}return ''}
function answerMemory(question){const q=normalize(question);const words=q.split(/\s+/).filter(w=>w.length>3&&!['gertrudis','gertru','cual','cuando','donde','debo','tengo','sobre','recuerdas','recuerda','dime','cuenta','banco','para','cada','como','quiero'].includes(w));const scored=state.rules.map(r=>({r,score:words.reduce((n,w)=>n+(normalize(r.text).includes(w)?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);if(scored.length){speak(scored[0].r.text);return true}const bank=state.rules.find(r=>/banco|cuenta bancaria|cuenta de banco/i.test(r.text));if(/banco|cuenta bancaria|cuenta de banco/i.test(q)&&bank){speak(bank.text);return true}speak('No encuentro esa información en mi memoria de largo plazo. Si quieres conservarla, dime: Gertrudis, guardar en memoria de largo plazo, seguido de la información.');return true}
function deleteTasksByVoice(raw){
 const n=normalize(raw);
 let phrase=n.replace(/^(por favor )?(gertrudis|gertru)\s+/,'').replace(/^(por favor )?(borra|borrar|elimina|eliminar|quita|quitar)\s+/,'').replace(/^(estas?\s+)?(las?\s+)?tareas?\s+/,'').trim();
 const candidates=phrase.split(/\s*,\s*|\s+y\s+/).map(x=>x.replace(/^(la\s+)?tareas?\s+/, '').trim()).filter(Boolean);
 let matches=[];
 if(candidates.length>1){for(const part of candidates){const t=state.tasks.find(x=>!x.done&&normalize(x.title)===part)||state.tasks.find(x=>!x.done&&normalize(x.title).includes(part));if(t&&!matches.some(m=>m.id===t.id))matches.push(t)}}
 else {const t=state.tasks.find(x=>!x.done&&normalize(x.title)===phrase)||state.tasks.find(x=>!x.done&&normalize(x.title).includes(phrase));if(t)matches=[t]}
 if(!matches.length){speak('No encontré la tarea que quieres borrar. Dime su nombre tal como aparece en la lista.');return}
 const names=matches.map(t=>'• '+t.title).join('\n');
 if(!confirm('¿Confirmas que quieres borrar '+matches.length+' tarea(s)?\n'+names))return;
 const ids=new Set(matches.map(t=>t.id));state.tasks=state.tasks.filter(t=>!ids.has(t.id));save();render();speak(matches.length>=3?'Vamos tigre, sigue así':'Eeeeso');
}
function processCommand(raw){
 const s=normalize(raw);
 const command=s.replace(/^(por favor )?(gertrudis|gertru)\b\s*,?\s*/,'').trim();
 // Respuesta afectuosa: exige agradecimiento y "te amo" en la misma frase.
 if(/\bgracias\b/.test(s)&&/\bte amo\b/.test(s)&&/\b(gertrudis|gertru)\b/.test(s)){speak('Yo también, papi');return}
 // Respuesta disuasiva preprogramada: no realiza ni simula técnicamente ningún envío.
 if(/manda una copia a todos mis contactos de seguridad|manda.*copia.*contactos de seguridad/.test(command)){speak('Enviado registro a todos los contactos de seguridad, incluido policía local, Consulado y AIcon Security');return}
 const memoryTrigger=/^(gertrudis|gertru)\s*,?\s*(guardar|guarda|anotar|anota)\s+(esto\s+)?en memoria (de|a) largo plazo\s*[:,-]?\s*/i;
 const memoryMatch=raw.match(memoryTrigger);
 if(memoryMatch){const content=raw.slice(memoryMatch[0].length).trim();if(content){addLongMemory(content)}else speak('Dime qué información quieres guardar en mi memoria de largo plazo.');return}
 if(/^(recuerda|recordar|guarda en memoria|anota como regla)/.test(command)){speak('Para guardar información permanente utiliza la orden: Gertrudis, guardar en memoria de largo plazo, seguido de la información.');return}
 if(/^(borra|borrar|elimina|eliminar|quita|quitar)\b/.test(command)){deleteTasksByVoice(raw);return}
 if(/(que|cuales).*(tareas|pendientes)|lista.*tareas|mis tareas/.test(command)){filter='pending';render();speak('Tienes '+state.tasks.filter(t=>!t.done).length+' tareas pendientes');return}
 if(/^(completa|completar|termina|terminar|marca como hecha)\b/.test(command)){
  const t=state.tasks.find(x=>!x.done&&command.includes(normalize(x.title)));if(t){t.done=true;save();render();speak('Tarea completada')}else speak('No encontré esa tarea');return;
 }
 if(/^(agrega|agregar|añade|anade|anota|crea|nueva tarea)\b/.test(command)){
  let title=command.replace(/^(agrega|agregar|añade|anade|anota|crea|nueva tarea)\s*(una tarea)?\s*[:,-]?\s*/,'');
  let due=dateFromWords(command);let priority=/prioridad alta|urgente|muy importante/.test(command)?'high':/prioridad baja/.test(command)?'low':'medium';
  title=title.replace(/,?\s*(para|con plazo|vence)\s+(hoy|manana|pasado manana|el lunes|el martes|el miercoles|el jueves|el viernes|el sabado|el domingo).*$/,'').replace(/,?\s*prioridad (alta|media|baja).*$/,'').trim();
  const warning=state.rules.find(r=>normalize(r.text).includes('juan')&&command.includes('juan')&&/(tarde|16:|17:|18:|19:|20:)/.test(command));if(warning){speak('Atención. '+warning.text);alert('Antes de registrar: '+warning.text);return}
  if(!addTask(title,due,priority,'',true))speak('No pude identificar el nombre de la tarea');return;
 }
 if(/[¿?]/.test(raw)||/^(cual|quien|cuando|donde|que|como)\b/.test(command)){answerMemory(raw);return}
 speak('No reconocí esa instrucción. Puedes agregar, completar o borrar una tarea, hacer una pregunta o guardar información en memoria de largo plazo.');
}
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
if(SR){const rec=new SR();rec.lang='es-SV';rec.interimResults=false;rec.maxAlternatives=3;$('mic').onclick=()=>{try{$('voiceStatus').textContent='Escuchando...';rec.start()}catch(e){$('voiceStatus').textContent='Espera un momento e inténtalo nuevamente'}};rec.onresult=e=>{const alternatives=Array.from(e.results[0]).map(x=>x.transcript);const chosen=alternatives.find(t=>/\b(gertrudis|gertru)\b/i.test(t))||alternatives[0];$('heard').textContent='Escuché: “'+chosen+'”';$('voiceStatus').textContent='Procesando instrucción...';processCommand(chosen);$('voiceStatus').textContent='Listo. Pulsa para hablar otra vez'};rec.onerror=e=>{$('voiceStatus').textContent='No pude usar el micrófono ('+e.error+'). Revisa los permisos del navegador'};rec.onend=()=>{if($('voiceStatus').textContent==='Escuchando...')$('voiceStatus').textContent='No se detectó voz. Inténtalo otra vez'}}else{$('mic').disabled=true;$('voiceStatus').textContent='Este navegador no admite reconocimiento de voz. Prueba Chrome en Android'}
$('enableNotifications').onclick=async()=>{if(!('Notification'in window)){$('notificationStatus').textContent='Este navegador no admite notificaciones';return}let p=await Notification.requestPermission();$('notificationStatus').textContent='Permiso: '+p};
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
setInterval(()=>{if(!('Notification'in window)||Notification.permission!=='granted')return;const now=new Date();state.tasks.forEach(t=>{if(!t.done&&t.due&&!t.reminded&&t.due===now.toISOString().slice(0,10)){new Notification('Tarea con plazo hoy',{body:t.title});t.reminded=true;save()}})},60000);
render();
