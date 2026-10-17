import {setupNativeReminderUI,sendNativeTestNotification} from './native-reminder-ui.mjs';
import {nativePlatform} from './local-notifications.mjs';
import {resolveLocale} from './locale.mjs';
document.documentElement.lang = resolveLocale(typeof navigator !== 'undefined' ? navigator.languages : [] ).slice(0,2);
import {premiumPriceSummary} from './pricing.mjs';
import {formatISO,parseDate,addDays,diffDays,normalizePeriods,cycleStatus,cyclePhase,calendarMarks,fertilityEstimate,moonPhase,zodiac} from './cycle.mjs';
import {morningMessage,wellness,safety} from './content.mjs';
import {dailyHoroscope} from './horoscope.mjs';
import {cycleHistory,symptomOverview,dailyGuidance} from './insights.mjs';
import {createEncryptedBackup,readEncryptedBackup,describeBackupState} from './backup.mjs';
import {reminderCalendar} from './reminder.mjs';
import {notificationStatus,browserNotificationEnvironment} from './notification-status.mjs';
import {sendNotificationPreview} from './notification-preview.mjs';
import {LunaVault,VAULT_KEY} from './vault.mjs';
import {PrivacyLock} from './privacy-lock.mjs';
import {demoState,demoSave} from './demo-mode.mjs';
import {inspectStorageProtection,requestStorageProtection} from './storage-resilience.mjs';
import {loadLegacy} from './legacy-migration.mjs';
const DEMO_MODE=globalThis.__LUNA_DEMO__===true;
const TEST_NO_LOGIN=true; // Only fictional test data; local storage is not encrypted.
const KEY='luna-v2-private-local'; // legacy V4 key; removed after verified encrypted migration
const $=id=>document.getElementById(id);
const todayISO=()=>{const n=new Date();return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;};
let dayToday=todayISO();
const readable=d=>parseDate(d)?new Date(`${d}T12:00:00`).toLocaleDateString('de-DE',{day:'numeric',month:'long',year:'numeric'}):'–';
const shortReadable=d=>parseDate(d)?new Date(`${d}T12:00:00`).toLocaleDateString('de-DE',{day:'numeric',month:'short'}):'–';
const defaults=()=>({version:2,profile:{name:'',birthday:'',cycleLength:28,duration:5,time:'06:30'},periods:[],symptoms:[],moods:{},appointment:{date:'',notes:''}});
const TEST_KEY='luna-v39-fictional-test-only';
const testVault={
 get unlocked(){return true;}, get current(){return null;},
 exists(){return localStorage.getItem(TEST_KEY)!==null;}, legacyPresent(){return false;},
 lock(){},cleanupLegacy(){return true;},
 clear(){localStorage.removeItem(TEST_KEY);},
 async save(data){localStorage.setItem(TEST_KEY,JSON.stringify(data));},
 read(){const raw=localStorage.getItem(TEST_KEY);if(!raw)return null;try{const obj=JSON.parse(raw);return obj&&typeof obj==='object'&&obj.profile&&Array.isArray(obj.periods)&&Array.isArray(obj.symptoms)?obj:null;}catch{return null;}}
};
const vault=TEST_NO_LOGIN?testVault:DEMO_MODE?{get unlocked(){return true;},lock(){},exists(){return false;},legacyPresent(){return false;}}:new LunaVault();
let state=defaults();let monthView=new Date();monthView.setDate(1);let active='home';
let saveQueue=Promise.resolve(),pendingWrites=0,storageFailed=false,saveGeneration=0;
const privacyLock=new PrivacyLock({
 onShield:()=>document.body.classList.add('privacy-shielded'),
 onUnshield:()=>document.body.classList.remove('privacy-shielded'),
 onLock:async()=>{
  // Keep the privacy curtain in place while any encrypted write finishes.
  await saveQueue;
  vault.lock();state=defaults();
  showGate('Luna wurde zu deinem Schutz automatisch gesperrt.');
 }
});
for(const eventName of ['pointerdown','keydown','touchstart','scroll']){
 document.addEventListener(eventName,()=>privacyLock.activity(),{passive:true});
}
function showGate(message=''){
 privacyLock.stop();
 document.querySelector('.app-shell').hidden=true;$('vault-gate').hidden=false;
 const exists=vault.exists();
 $('vault-title').textContent=exists?'Willkommen zurück ♡':'Deine Daten. Dein Schlüssel. ♡';
 $('vault-intro').textContent=exists?'Entsperre Luna mit deinem Passwort. Deine Einträge werden erst danach angezeigt.':vault.legacyPresent()?'Deine bisherigen Einträge werden nach dem Festlegen eines Passworts verschlüsselt übernommen.':'Lege ein Passwort fest, um deine persönlichen Einträge verschlüsselt zu speichern.';
 $('vault-confirm-label').hidden=exists;$('vault-confirm').required=!exists;
 $('vault-password').autocomplete=exists?'current-password':'new-password';
 $('vault-submit').textContent=exists?'Luna entsperren':'Luna schützen';
 $('vault-reset').hidden=!exists;
 $('vault-status').textContent=message;
}
function showApp(legacyCleared=true){
 $('vault-gate').hidden=true;document.querySelector('.app-shell').hidden=false;
 $('legacy-warning').hidden=legacyCleared;
 $('vault-password').value='';$('vault-confirm').value='';
 resetPeriodForm();resetSymptomForm();render();updateSaveStatus();if(!DEMO_MODE&&!TEST_NO_LOGIN)privacyLock.start();
}
function updateSaveStatus(){if($('save-status'))$('save-status').textContent=DEMO_MODE?'🌷 Nur Demo':TEST_NO_LOGIN?(pendingWrites?'⏳ Speichere …':'🌷 Testdaten lokal'):pendingWrites?'⏳ Speichere …':'🔒 Geschützt';}
function storageFailure(err){
 if(storageFailed)return;
 if(TEST_NO_LOGIN){alert('Speichern nicht möglich. Bitte prüfe, ob dein Browser lokalen Speicher erlaubt.');return;}
 storageFailed=true;saveGeneration++;vault.lock();state=defaults();
 showGate('Speichern fehlgeschlagen: '+(err?.message||'Unbekannter Fehler')+' Nicht gespeicherte Änderungen können verloren sein. Bitte Luna erneut entsperren.');
}
async function save(){
 if(DEMO_MODE)return demoSave(); // Demo edits live only in memory; never write health data.
 if(storageFailed||!vault.unlocked)return false;
 const snapshot=structuredClone(state),generation=saveGeneration;
 pendingWrites++;updateSaveStatus();
 const job=saveQueue.then(()=>{if(generation!==saveGeneration||storageFailed)throw Error('Diese Speichersitzung ist nicht mehr gültig.');return vault.save(snapshot);});
 saveQueue=job.catch(()=>{});
 try{await job;return true;}
 catch(err){storageFailure(err);return false;}
 finally{pendingWrites--;updateSaveStatus();}
}
function toast(message){const t=$('toast');t.textContent=message;t.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.hidden=true,2900)}
function navigate(name){if(!vault.unlocked||!['home','cycle','wellbeing','moon','profile'].includes(name))return;active=name;document.querySelectorAll('.screen').forEach(s=>s.hidden=s.id!==`screen-${name}`);document.querySelectorAll('[data-screen]').forEach(b=>{b.classList.toggle('selected',b.dataset.screen===name);if(b.dataset.screen===name)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});render();const scrollArea=$('main');if(scrollArea)scrollArea.scrollTop=0;}
function element(tag,classes,text){const el=document.createElement(tag);if(classes)el.className=classes;if(text!==undefined)el.textContent=text;return el;}
function currentMood(){return state.moods[dayToday]||'';}
function renderHome(){const now=new Date();$('home-date').textContent=now.toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'});$('greeting-name').textContent=state.profile.name?.trim()||'du Liebe';const phase=cyclePhase(state.periods,state.profile,dayToday);const quote=morningMessage(dayToday,phase,currentMood());$('morning-quote').textContent=quote;
 const status=cycleStatus(state.periods,state.profile,dayToday);let summary='Noch nicht erfasst',sub='Deine Periode eintragen';if(status.kind==='late'){summary=`${status.lateDays} Tag${status.lateDays===1?'':'e'} später`;sub=`Erwartet am ${shortReadable(status.next)} · nur Schätzung`;}else if(status.kind==='current'){summary=`Tag ${status.day}`;sub=`Nächste Periode ca. ${shortReadable(status.next)}`;}else if(status.kind==='future'){summary='Noch nicht gestartet';sub=`Beginn erfasst: ${shortReadable(status.actual.at(-1).start)}`;}$('cycle-summary').textContent=summary;$('cycle-sub').textContent=sub;
 const moon=moonPhase(dayToday);$('moon-summary').textContent=moon.label;
 const mood=currentMood();document.querySelectorAll('[data-mood]').forEach(b=>b.classList.toggle('active',b.dataset.mood===mood));
 const tips={gut:'Wie schön! Halte einen kleinen Moment fest, auf den du dich freust.',sensibel:'Deine Gefühle dürfen heute da sein. Gönne dir Ruhe, wenn du sie brauchst.',erschöpft:'Du darfst einen Gang zurückschalten. Vielleicht tut dir etwas Wärme gut.',gestresst:'Ein tiefer Atemzug und eine kleine Pause können den Tag leichter machen.'};$('home-tip').textContent=tips[mood]||'Ein paar Minuten Pause gehören auch zu einem guten Tag.';
 const guidance=dailyGuidance(state.symptoms.find(e=>e.date===dayToday),mood);const panel=$('daily-guidance');panel.textContent=guidance.text;panel.className='daily-guidance '+guidance.level;
}
const FERTILITY_OPT_IN='luna-test-fertility-v40-opt-in';
function fertilityEnabled(){try{return localStorage.getItem(FERTILITY_OPT_IN)==='yes';}catch{return false;}}
function renderFertility(){
 const toggle=$('fertility-toggle');toggle.checked=fertilityEnabled();
 const info=$('fertility-info');
 if(!toggle.checked){info.textContent='Optional: Schalte die Schätzung ein, wenn du sie sehen möchtest. Keine Verhütungs- oder Kinderwunschberatung.';return;}
 const est=fertilityEstimate(state.periods,state.profile,dayToday);
 info.textContent=est.available
 ?`Rechnerisches Zeitfenster: ${readable(est.start)} bis ${readable(est.end)}; rechnerischer Eisprung etwa ${readable(est.ovulation)}. Sehr unsicher: Ein Kalender kann Eisprung und fruchtbare Tage nicht zuverlässig bestimmen. Nicht zur Verhütung oder zur sicheren Bestimmung fruchtbarer Tage verwenden.`
 :est.reason+' Kalendermethoden sind nicht zur Verhütung oder zur sicheren Bestimmung fruchtbarer Tage geeignet.';
}
function renderCalendar(){let y=monthView.getFullYear(),m=monthView.getMonth();$('month-title').textContent=monthView.toLocaleDateString('de-DE',{month:'long',year:'numeric'});const grid=$('calendar');grid.replaceChildren();const fertility=fertilityEnabled()?fertilityEstimate(state.periods,state.profile,dayToday):{available:false};for(const name of ['Mo','Di','Mi','Do','Fr','Sa','So'])grid.append(element('span','day header',name));for(let i=0;i<(new Date(y,m,1).getDay()+6)%7;i++)grid.append(element('span'));
 for(let i=1,n=new Date(y,m+1,0).getDate();i<=n;i++){
  const day=`${y}-${String(m+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
  const b=element('button','day',String(i));b.type='button';b.setAttribute('aria-label',readable(day));const marker=calendarMarks(state.periods,state.profile,day,dayToday);if(marker)b.classList.add(marker);if(fertility.available&&diffDays(fertility.start,day)>=0&&diffDays(day,fertility.end)>=0){b.classList.add('fertile-estimate');if(day===fertility.ovulation)b.classList.add('ovulation-estimate');b.setAttribute('aria-label',readable(day)+(day===fertility.ovulation?' – rechnerisch geschätzter Eisprung':' – rechnerisch geschätztes fruchtbares Zeitfenster'));}if(day===dayToday)b.classList.add('today');
  b.addEventListener('click',()=>{$('period-start').value=day;$('period-original').value='';$('period-submit').textContent='Periode speichern';$('period-cancel').hidden=true;toast('Datum ausgewählt: '+shortReadable(day));});grid.append(b);
 }
}
function resetPeriodForm(){const form=$('period-form');form.reset();$('period-start').value=dayToday;$('period-duration').value=state.profile.duration||5;$('period-original').value='';$('period-submit').textContent='Periode speichern';$('period-cancel').hidden=true;}
function renderPeriods(){const target=$('period-list');target.replaceChildren();const sorted=normalizePeriods(state.periods).reverse();$('period-count').textContent=`${sorted.length} erfasst`;if(!sorted.length)target.append(element('div','empty','Noch keine Perioden erfasst.'));
 for(const p of sorted){const row=element('div','history-item');row.append(element('b','',readable(p.start)));row.append(element('p','',`${p.duration} Tage Blutung`));const buttons=element('div','row');const edit=element('button','', 'Bearbeiten');edit.type='button';edit.addEventListener('click',()=>{$('period-start').value=p.start;$('period-duration').value=p.duration;$('period-original').value=p.start;$('period-submit').textContent='Änderung speichern';$('period-cancel').hidden=false;$('period-form').scrollIntoView({behavior:'smooth',block:'center'});});const del=element('button','','Löschen');del.type='button';del.addEventListener('click',async()=>{if(!confirm(`Periode vom ${readable(p.start)} löschen?`))return;state.periods=state.periods.filter(x=>x.start!==p.start);if(!await save())return;render();toast('Eintrag gelöscht');});buttons.append(edit,del);row.append(buttons);target.append(row);}
 const s=cycleStatus(state.periods,state.profile,dayToday);let note='Trage den Beginn deiner Periode ein. Vorhersagen sind nur Schätzungen.';
 if(s.kind==='current')note=`Nächster Beginn geschätzt: ${readable(s.next)}. Berechnet mit ${s.length} Tagen (${s.observations ? `${s.observations} dokumentierte${s.observations===1?'r':''} Zyklusabstände`:'deine Einstellung'}).${s.spread>=7?' Deine Zyklen schwanken stärker – Prognosen sind besonders unsicher.':''}`;
 if(s.kind==='late')note=`Geschätzter Beginn war ${readable(s.next)} – ${s.lateDays} Tag${s.lateDays===1?'':'e'} später. Keine neue Periode wird automatisch eingetragen. Du kannst den tatsächlichen Beginn jederzeit erfassen. Bei möglicher Schwangerschaft ggf. testen oder ärztlichen Rat einholen.`;
 $('forecast-note').textContent=note+' Zyklusprognosen sind nicht zur Verhütung oder sicheren Bestimmung fruchtbarer Tage geeignet.';
 const chart=$('cycle-history');chart.replaceChildren();const history=cycleHistory(state.periods);if(!history.length){chart.append(element('p','empty','Nach zwei tatsächlich eingetragenen Perioden werden hier erste Zyklusabstände sichtbar.'));}else{for(const item of history){const line=element('div','bar-row');const label=element('span','bar-date',shortReadable(item.end));const track=element('div','bar-track');const fill=element('div','bar-fill');fill.style.width=Math.max(8,Math.min(100,item.days/60*100))+'%';fill.setAttribute('aria-hidden','true');track.append(fill);line.append(label,track,element('strong','bar-value',item.days+' T.'));chart.append(line);}}
}
function careFor(entry){const container=$('care-result');container.replaceChildren();let h=element('h2','',entry?'🌷 Für dich heute':'🌷 Ein bisschen Fürsorge');container.append(h);
 if(!entry){container.append(element('p','','Trage Beschwerden ein und erhalte vorsichtige, passende Selbsthilfehinweise.'));return;}
 const pain=Number(entry.pain);if(pain>=8){container.append(element('div','notice danger','Du hast sehr starke Schmerzen erfasst. Bitte heute medizinisch abklären lassen. Bei plötzlich sehr starken Schmerzen, Ohnmacht oder möglicher Schwangerschaft dringend medizinische Hilfe suchen.'));}else if(pain>=5){container.append(element('div','notice','Deine Schmerzen sind mittel bis stark. Wenn sie ungewöhnlich sind, zunehmen, dich im Alltag einschränken oder übliche Mittel nicht helfen, lass sie ärztlich abklären.'));}
 const content=wellness[entry.type]||wellness.Stimmung;container.append(element('h3','',content.title));const list=element('ul');for(const tip of content.tips)list.append(element('li','',tip));container.append(list);container.append(element('p','muted small','Diese Informationen ersetzen keine individuelle medizinische Untersuchung oder Beratung.'));
}
function resetSymptomForm(){ $('symptom-date').value=dayToday;$('pain-range').value=0;$('pain-number').textContent='0 / 10';$('symptom-type').value='Keine';$('symptom-notes').value='';}
function renderSymptoms(){const target=$('symptom-list');target.replaceChildren();if(!state.symptoms.length)target.append(element('div','empty','Noch keine Einträge.'));
 for(const e of state.symptoms.slice(0,30)) {let row=element('div','history-item');row.append(element('b','',`${readable(e.date)} · ${e.pain}/10 · ${e.type}`));if(e.notes)row.append(element('p','',e.notes));let buttons=element('div','row');let edit=element('button','','Bearbeiten');edit.type='button';edit.addEventListener('click',()=>{$('symptom-date').value=e.date;$('pain-range').value=e.pain;$('pain-number').textContent=e.pain+' / 10';$('symptom-type').value=['Keine','Krämpfe','Kopfschmerzen','Übelkeit','Blutung','Stimmung','Andere'].includes(e.type)?e.type:'Andere';$('symptom-notes').value=e.notes;$('symptom-form').scrollIntoView({behavior:'smooth',block:'center'});});let del=element('button','','Löschen');del.type='button';del.addEventListener('click',async()=>{if(!confirm(`Symptome vom ${readable(e.date)} löschen?`))return;state.symptoms=state.symptoms.filter(x=>x.date!==e.date);if(!await save())return;render();});buttons.append(edit,del);row.append(buttons);target.append(row);}
 careFor(state.symptoms.find(e=>e.date===dayToday)||null);$('urgent-text').textContent=safety.urgent;$('soon-text').textContent=safety.soon;
 const results=$('symptom-insights');results.replaceChildren();const stats=symptomOverview(state.symptoms,dayToday);if(stats.tracked===0){results.append(element('p','empty','Noch keine Einträge der letzten 30 Tage.'));}else{
 const grid=element('div','mini-metrics');for(const [title,value] of [['Tage erfasst',stats.tracked],['Tage mit Schmerzen',stats.painDays],['Starke Schmerzen (≥7)',stats.severeDays]]){const box=element('div','metric');box.append(element('strong','',String(value)),element('span','',title));grid.append(box);}results.append(grid);
 const desc=element('p','muted small',`Durchschnitt der erfassten Schmerzwerte: ${stats.avgPain.toLocaleString('de-DE')} / 10${stats.topSymptom?' · Häufigster Eintrag: '+stats.topSymptom:''}.`);results.append(desc);
 if(stats.severeDays>=2)results.append(element('div','notice','Du hast in den letzten 30 Tagen mehrfach starke Schmerzen erfasst. Bitte sprich darüber mit einer medizinischen Fachperson.'));}
}
function renderMoon(){
 const m=moonPhase(dayToday);
 $('moon-big').textContent=m.emoji;
 $('moon-phase-name').textContent=m.label;
 $('moon-thought').textContent='Ein schöner Anlass für ein kleines Ritual: Halte inne und frag dich, was dir heute guttut. ✨';
 const sign=zodiac(state.profile.birthday);
 const h=sign?dailyHoroscope(sign,dayToday):null;
 $('zodiac-description').textContent=h?`${h.symbol} ${h.sign} · Dein Tageshoroskop für ${readable(dayToday)}`:'Trage im Profil freiwillig deinen Geburtstag ein, um dein Tageshoroskop zu sehen.';
 $('horoscope-panel').hidden=!h;
 if(h){
  $('horoscope-main').textContent=h.message;
  $('horoscope-love').textContent=h.love;
  $('horoscope-work').textContent=h.work;
  $('horoscope-wellbeing').textContent=h.wellbeing;
 }
}
function renderProfile(){const p=state.profile;$('profile-name').value=p.name||'';$('profile-birthday').value=p.birthday||'';$('profile-length').value=p.cycleLength||28;$('profile-duration').value=p.duration||5;$('profile-time').value=p.time||'08:00';$('appointment-date').value=state.appointment.date||'';$('appointment-notes').value=state.appointment.notes||'';$('appointment-result').textContent=state.appointment.date?`Notiert: ${new Date(state.appointment.date).toLocaleString('de-DE')}`:'Noch kein Termin notiert.';}
function render(){renderHome();renderFertility();renderCalendar();renderPeriods();renderSymptoms();renderMoon();if(active==='profile')renderProfile();}
// Event delegation: all navigation and interactions remain accessible to keyboard and touch.
document.querySelectorAll('[data-screen]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.screen)));
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.go)));
$('today-shortcut').addEventListener('click',()=>navigate('home'));
document.querySelectorAll('[data-mood]').forEach(b=>b.addEventListener('click',async()=>{state.moods[dayToday]=b.dataset.mood;if(!await save())return;renderHome();toast('Deine Stimmung ist gespeichert ♡');}));
$('copy-quote').addEventListener('click',async()=>{const text=$('morning-quote').textContent;try{if(navigator.share)await navigator.share({text});else if(navigator.clipboard) {await navigator.clipboard.writeText(text);toast('Nachricht kopiert ♡');}else toast('Teilen ist hier nicht verfügbar.');}catch(e){if(e?.name!=='AbortError')toast('Teilen nicht verfügbar.');}});
$('fertility-toggle').addEventListener('change',e=>{try{localStorage.setItem(FERTILITY_OPT_IN,e.target.checked?'yes':'no');}catch{toast('Einstellung konnte nicht gespeichert werden.');}renderFertility();renderCalendar();});
$('prev-month').addEventListener('click',()=>{monthView.setMonth(monthView.getMonth()-1);renderCalendar()});$('next-month').addEventListener('click',()=>{monthView.setMonth(monthView.getMonth()+1);renderCalendar()});
$('period-form').addEventListener('submit',async e=>{e.preventDefault();const start=$('period-start').value,duration=+$('period-duration').value,original=$('period-original').value;if(!parseDate(start)||diffDays(start,dayToday)<0||!Number.isInteger(duration)||duration<1||duration>15){toast('Bitte ein gültiges vergangenes oder heutiges Datum und 1–15 Tage angeben.');return;}if(state.periods.some(x=>x.start===start&&x.start!==original)){toast('Dieser Periodenstart ist bereits erfasst.');return;}state.periods=state.periods.filter(x=>x.start!==original);state.periods.push({start,duration});state.periods=normalizePeriods(state.periods);if(!await save())return;resetPeriodForm();render();toast('Periode gespeichert und Prognose angepasst ♡');});$('period-cancel').addEventListener('click',resetPeriodForm);
$('pain-range').addEventListener('input',()=>{$('pain-number').textContent=$('pain-range').value+' / 10';});$('symptom-form').addEventListener('submit',async e=>{e.preventDefault();const date=$('symptom-date').value,pain=Number($('pain-range').value);if(!parseDate(date)||diffDays(date,dayToday)<0||pain<0||pain>10){toast('Bitte ein gültiges Datum und Schmerzstärke wählen.');return;}state.symptoms=state.symptoms.filter(x=>x.date!==date);state.symptoms.push({date,pain,type:$('symptom-type').value,notes:$('symptom-notes').value.trim().slice(0,400)});state.symptoms.sort((a,b)=>b.date.localeCompare(a.date));if(!await save())return;$('symptom-notice').textContent='Dein Eintrag wurde gespeichert ♡';renderHome();renderSymptoms();toast('Wohlbefinden gespeichert');});
$('profile-form').addEventListener('submit',async e=>{e.preventDefault();const len=+$('profile-length').value,duration=+$('profile-duration').value,birthday=$('profile-birthday').value;if(!Number.isInteger(len)||len<15||len>90||!Number.isInteger(duration)||duration<1||duration>15||duration>len||(birthday&&(!parseDate(birthday)||diffDays(birthday,dayToday)<0))){toast('Bitte gültige Profilangaben machen.');return;}state.profile={name:$('profile-name').value.trim().slice(0,40),birthday,cycleLength:len,duration,time:$('profile-time').value||'08:00'};if(!await save())return;render();$('profile-status').textContent='Deine Einstellungen wurden gespeichert ♡';toast('Einstellungen gespeichert');});
$('appointment-form').addEventListener('submit',async e=>{e.preventDefault();state.appointment={date:$('appointment-date').value,notes:$('appointment-notes').value.slice(0,700)};if(!await save())return;renderProfile();toast('Terminnotiz gespeichert (ohne Erinnerung)');});
function downloadPrivateFile(contents,name,mime){
 const url=URL.createObjectURL(new Blob([contents],{type:mime}));
 const anchor=document.createElement('a');anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function clearBackupPasswords(){ $('backup-password').value=''; $('backup-confirm').value=''; }
async function runStorageProtection(action){
 const status=$('storage-protection-status');
 const check=$('storage-protection-check'),request=$('storage-protection-request');
 check.disabled=true;request.disabled=true;
 status.textContent='Speicherschutz wird geprüft …';
 try{
  const result=await action(navigator);
  status.textContent=result.message;
 }catch{
  status.textContent='Speicherschutz konnte nicht geprüft werden. Ein verschlüsseltes Backup bleibt wichtig.';
 }finally{check.disabled=false;request.disabled=false;}
}
$('storage-protection-check').addEventListener('click',()=>runStorageProtection(inspectStorageProtection));
$('storage-protection-request').addEventListener('click',()=>runStorageProtection(requestStorageProtection));
$('data-export').addEventListener('click',async()=>{
 const password=$('backup-password').value,confirmPassword=$('backup-confirm').value;
 if(password.length<12){$('backup-status').textContent='Bitte ein Passwort mit mindestens 12 Zeichen festlegen.';return;}
 if(password!==confirmPassword){$('backup-status').textContent='Die beiden Passwörter stimmen nicht überein.';return;}
 $('data-export').disabled=true;
 try{const result=await createEncryptedBackup(state,password);downloadPrivateFile(result,`luna-privat-${dayToday}.luna.json`,'application/json');$('backup-status').textContent='Verschlüsseltes Backup erstellt. Bitte Passwort sicher aufbewahren.';toast('Geschützte Sicherung erstellt ♡');}
 catch(err){$('backup-status').textContent=err?.message||'Backup fehlgeschlagen.';}
 finally{clearBackupPasswords();$('data-export').disabled=false;}
});
$('data-import').addEventListener('click',()=>{
 if($('backup-password').value.length<12){$('backup-status').textContent='Gib zuerst das Passwort deiner Sicherung ein.';return;}
 $('backup-file').value='';$('backup-file').click();
});
$('backup-file').addEventListener('change',async()=>{
 const file=$('backup-file').files?.[0];if(!file)return;
 if(file.size>1500000){$('backup-status').textContent='Die Sicherungsdatei ist zu groß.';clearBackupPasswords();return;}
 $('data-import').disabled=true;
 try{
   const imported=await readEncryptedBackup(await file.text(),$('backup-password').value);
   if(!confirm(`Folgende Sicherung wurde gelesen: ${describeBackupState(imported)}.\n\nWiederherstellen? Die bisherigen lokalen Daten werden ersetzt.`)){$('backup-status').textContent='Wiederherstellung abgebrochen. Nichts verändert.';return;}
   state=imported;
   // On a failed save, storageFailure() has already locked the vault and wiped
   // in-memory health data. Never restore the old plaintext into a locked session.
   if(!await save())return;
   resetPeriodForm();resetSymptomForm();render();$('backup-status').textContent='Backup wiederhergestellt: '+describeBackupState(state);toast('Deine Daten sind wiederhergestellt ♡');
 }catch(err){$('backup-status').textContent=err?.message||'Die Sicherung konnte nicht eingelesen werden.';}
 finally{clearBackupPasswords();$('data-import').disabled=false;}
});
const premiumPrices=premiumPriceSummary();
$('premium-yearly').textContent=premiumPrices.yearly+' / Jahr';
$('premium-monthly').textContent='Alternativ '+premiumPrices.monthly+' / Monat · Jahresabo ca. '+premiumPrices.savingPercent+' % günstiger';
$('premium-trial').textContent=premiumPrices.trialDays+' Tage kostenlose Testphase geplant · Noch kein Bezahlvorgang eingerichtet. Keine Kosten und kein aktives Abo.';
$('notification-capability').textContent=notificationStatus(browserNotificationEnvironment(globalThis)).message;
if(!nativePlatform(globalThis.Capacitor)){
 $('morning-push-enable').hidden=true;
 $('morning-push-disable').hidden=true;
}
$('notification-preview').addEventListener('click',async()=>{
 const button=$('notification-preview');button.disabled=true;
 try{const result=await (nativePlatform(globalThis.Capacitor)?sendNativeTestNotification(globalThis):sendNotificationPreview(globalThis));$('notification-preview-result').textContent=result.message;}
 catch{$('notification-preview-result').textContent='Die Testnachricht konnte nicht gestartet werden.';}
 finally{button.disabled=false;$('notification-capability').textContent=notificationStatus(browserNotificationEnvironment(globalThis)).message;
if(!nativePlatform(globalThis.Capacitor)){
 $('morning-push-enable').hidden=true;
 $('morning-push-disable').hidden=true;
}}
});
$('calendar-reminder').addEventListener('click',()=>{
 try{const ics=reminderCalendar(state.profile.time||'06:30',new Date());downloadPrivateFile(ics,'luna-morgenroutine.ics','text/calendar;charset=utf-8');$('reminder-result').textContent='Kalenderdatei erstellt. Importiere sie freiwillig in deine Kalender-App, um tägliche Erinnerungen zu erhalten. Der Import ist vom Gerät abhängig. Bei erneutem Import können manche Kalender doppelte Einträge erzeugen.';}
 catch(err){$('reminder-result').textContent=err?.message||'Kalenderdatei konnte nicht erstellt werden.';}
});
$('password-change-form').addEventListener('submit',async e=>{
 e.preventDefault();
 const current=$('password-current').value,next=$('password-new').value,repeat=$('password-repeat').value;
 const status=$('password-change-result'),button=$('password-change-submit');
 if(next.length<12){status.textContent='Das neue Passwort muss mindestens 12 Zeichen haben.';return;}
 if(next!==repeat){status.textContent='Die neuen Passwörter stimmen nicht überein.';return;}
 if(current===next){status.textContent='Bitte wähle ein anderes Passwort als bisher.';return;}
 button.disabled=true;
 // Prevent new form edits during key rotation; pending encrypted writes finish first.
 const shell=document.querySelector('.app-shell');shell.inert=true;
 try{
  await saveQueue;
  if(storageFailed||!vault.unlocked)throw Error('Luna ist gesperrt. Bitte erneut entsperren.');
  await vault.changePassword(current,next);
  status.textContent='Passwort geändert. Ab dem nächsten Öffnen gilt nur noch das neue Passwort.';
  toast('Dein Passwort wurde geändert ♡');
 }catch(err){status.textContent=err?.message||'Das Passwort konnte nicht geändert werden.';}
 finally{
  $('password-current').value='';$('password-new').value='';$('password-repeat').value='';
  shell.inert=false;button.disabled=false;
 }
});
$('data-delete').addEventListener('click',async()=>{
 if(!confirm('Wirklich alle lokalen Zyklus-, Stimmungs- und Gesundheitsdaten unwiderruflich löschen?'))return;
 document.querySelector('.app-shell').hidden=true;
 await saveQueue;
 try{vault.clear();location.reload();}catch(err){showGate('Löschen fehlgeschlagen: '+(err?.message||'Unbekannter Fehler'));}
});
$('vault-form').addEventListener('submit',async e=>{
 e.preventDefault();
 if(TEST_NO_LOGIN){const name=$('vault-password').value.trim().slice(0,40);if(!name){$('vault-status').textContent='Bitte gib einen Vornamen ein.';return;}state=defaults();state.profile.name=name;try{await vault.save(state);showApp();}catch{$('vault-status').textContent='Speichern ist in diesem Browser nicht möglich.';}return;}
 const password=$('vault-password').value,confirmPassword=$('vault-confirm').value;
 const exists=vault.exists();
 if(password.length<12){$('vault-status').textContent='Bitte mindestens 12 Zeichen verwenden.';return;}
 if(!exists&&password!==confirmPassword){$('vault-status').textContent='Die Passwörter stimmen nicht überein.';return;}
 $('vault-submit').disabled=true;$('vault-status').textContent='Bitte warten …';
 try{
  const result=exists?await vault.unlock(password):await vault.create(password,loadLegacy(localStorage,defaults));
  state=result.state;storageFailed=false;showApp(result.legacyCleared);
 }catch(err){showGate(err?.message||'Luna konnte nicht entsperrt werden.');}
 finally{$('vault-password').value='';$('vault-confirm').value='';$('vault-submit').disabled=false;}
});
$('vault-reset').addEventListener('click',()=>{
 if(!confirm('Ohne Passwort können diese Daten nicht wiederhergestellt werden. Wirklich alle lokalen Luna-Daten endgültig löschen?'))return;
 try{vault.clear();location.reload();}catch(err){$('vault-status').textContent='Löschen fehlgeschlagen: '+(err?.message||'Unbekannter Fehler');}
});
$('retry-cleanup').addEventListener('click',()=>{const success=vault.cleanupLegacy();$('legacy-warning').hidden=success;if(success)toast('Alte unverschlüsselte Einträge entfernt.');else toast('Entfernen nicht möglich.');});
$('lock-vault').addEventListener('click',async()=>{await saveQueue;vault.lock();state=defaults();location.reload();});
window.addEventListener('storage',event=>{
 if(!TEST_NO_LOGIN&&event.key===VAULT_KEY&&vault.unlocked&&event.newValue!==vault.current){vault.lock();state=defaults();location.reload();}
});
window.addEventListener('beforeunload',event=>{if(pendingWrites>0){event.preventDefault();event.returnValue='';}});
document.addEventListener('visibilitychange',()=>{
 if(DEMO_MODE||TEST_NO_LOGIN)return;
 if(document.visibilityState==='hidden'){privacyLock.hide();return;}
 privacyLock.show();
 if(vault.unlocked&&dayToday!==todayISO()){dayToday=todayISO();resetPeriodForm();resetSymptomForm();render();}
});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
if(DEMO_MODE){
 state=demoState(dayToday);
 showApp();
 $('demo-banner').hidden=false;
 $('demo-reset').addEventListener('click',()=>{state=demoState(dayToday);active='home';document.querySelectorAll('.screen').forEach(s=>s.hidden=s.id!=='screen-home');document.querySelectorAll('[data-screen]').forEach(b=>b.classList.toggle('selected',b.dataset.screen==='home'));resetPeriodForm();resetSymptomForm();render();toast('Beispieldaten zurückgesetzt ♡');});
 document.querySelectorAll('[data-real-only]').forEach(el=>el.hidden=true);
 $('profile-time').closest('label').hidden=true;
 $('profile-form').querySelector('.muted.small').textContent='Demo: Alle Änderungen sind nur vorübergehend und werden nicht gespeichert.';
}else if(TEST_NO_LOGIN){
 const existing=vault.read();
 if(existing){state=existing;showApp();}
 else{
  $('vault-title').textContent='Willkommen bei Luna ♡';
  $('vault-intro').textContent='Wie heißt du? Starte ohne Anmeldung. Bitte nur erfundene Testdaten eingeben.';
  $('vault-confirm-label').hidden=true;
  $('vault-password').type='text';$('vault-password').minLength=1;
  $('vault-password').removeAttribute('autocomplete');
  $('vault-submit').textContent='Luna starten ♡';
  $('vault-reset').hidden=true;
  $('vault-gate').hidden=false;
 }
 document.querySelectorAll('[data-real-only]').forEach(el=>{
  if(el.id==='lock-vault'||el.querySelector('#password-change-form'))el.hidden=true;
 });
 $('legacy-warning').hidden=true;
}else showGate();
if(!nativePlatform(globalThis.Capacitor)&&!DEMO_MODE&&'serviceWorker' in navigator && location.protocol==='https:')navigator.serviceWorker.register('./service-worker.js').catch(()=>{});

// Native mode replaces browser push controls with local device notifications.
setupNativeReminderUI(globalThis).catch(()=>{});
