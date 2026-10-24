import {enableLocalMorningNotifications,disableLocalMorningNotifications,isLocalMorningScheduled,refreshLocalMorningNotifications,nativePlatform,LUNA_MORNING_TIME} from './local-notifications.mjs';
const ENABLED_KEY='luna-morning-enabled';
// Serialize user changes and background refills so a delayed refill cannot undo a stop.
let notificationJob=Promise.resolve();
function queueNotificationChange(action){
 const job=notificationJob.then(action,action);
 notificationJob=job.catch(()=>{});
 return job;
}
export function nativeMorningPermissionMessage(permission,scheduled){
 if(permission==='denied')return 'Morgenbenachrichtigungen sind in den Geräteeinstellungen blockiert. Bitte dort die Berechtigung für Luna prüfen.';
 if(permission!=='granted')return 'Für Morgenbenachrichtigungen ist eine Geräteberechtigung nötig. Luna fragt erst beim Einschalten danach.';
 return scheduled?'Morgenbotschaften sind auf dem Gerät vorgemerkt. Die tatsächliche Zustellung ist noch nicht auf echten Geräten bestätigt.':'Berechtigung erteilt, aber derzeit keine Morgenbotschaften vorgemerkt.';
}
export async function setupNativeReminderUI(scope=globalThis,{getName=()=>''}={}){
 if(!nativePlatform(scope.Capacitor))return false;
 const enable=scope.document.getElementById('morning-push-enable');
 const disable=scope.document.getElementById('morning-push-disable');
 const result=scope.document.getElementById('morning-push-result');
 const note=scope.document.getElementById('morning-reminder-description');
 const capability=scope.document.getElementById('notification-capability');
 if(!enable||!disable||!result)return false;
 // Native mode: the encrypted profile's old time field is not a second notification control.
 const profileTime=scope.document.getElementById('profile-time');
 if(profileTime?.closest('label'))profileTime.closest('label').hidden=true;
 const timeLabel=scope.document.createElement('label');
 timeLabel.textContent='Uhrzeit deiner Morgenbotschaft';
 const timeInput=scope.document.createElement('input');
 timeInput.type='time';timeInput.id='luna-morning-time';timeInput.value=readMorningTime(scope.localStorage);
 timeLabel.appendChild(timeInput);
 enable.parentNode.insertBefore(timeLabel,enable);
 enable.textContent='Tägliche Erinnerung einschalten / Uhrzeit speichern';
 disable.textContent='Tägliche Erinnerung ausschalten';
 if(note)note.textContent='56 wechselnde, persönliche Morgenbotschaften werden lokal geplant. Öffne Luna mindestens alle 4 Wochen, damit weitere Nachrichten geplant werden können. Dein Vorname kann auf dem Sperrbildschirm sichtbar sein; keine Zyklusdaten. Kein Server. Die genaue Uhrzeit ist systemabhängig.';
 if(capability)capability.textContent='Native lokale Benachrichtigungen verfügbar (nach Berechtigung).';
 let plugin;
 try{plugin=(await import('@capacitor/local-notifications')).LocalNotifications;}
 catch{result.textContent='Lokale Benachrichtigungen sind in dieser App-Version nicht installiert.';enable.disabled=true;disable.disabled=true;return true;}
 const update=async()=>{
  const scheduled=await isLocalMorningScheduled(plugin);
  let permission='unknown';
  try{permission=(await plugin.checkPermissions())?.display??'unknown';}catch{}
  disable.disabled=!scheduled;
  enable.setAttribute('aria-pressed',String(scheduled&&permission==='granted'));
  if(capability)capability.textContent=nativeMorningPermissionMessage(permission,scheduled);
 };
 enable.addEventListener('click',async()=>{
  enable.disabled=true;
  const {response,saved}=await queueNotificationChange(async()=>{
   const response=await enableLocalMorningNotifications(plugin,timeInput.value,getName());
   const saved=response.ok && writeMorningTime(scope.localStorage,timeInput.value) && writeMorningEnabled(scope.localStorage,true);
   return {response,saved};
  });
  result.textContent=response.ok?(saved?'56 Morgenbotschaften ab '+timeInput.value+' Uhr lokal geplant. Bitte Luna regelmäßig öffnen.':'56 Nachrichten geplant, aber Einstellungen konnten nicht dauerhaft gespeichert werden. Bitte später erneut einschalten.'):'Erinnerung nicht eingerichtet ('+response.reason+').';
  await update();enable.disabled=false;
 });
 disable.addEventListener('click',async()=>{
  disable.disabled=true;
  const {saved,response}=await queueNotificationChange(async()=>{
   // Persist opt-out before cancellation; serialize with any in-flight refill.
   const saved=writeMorningEnabled(scope.localStorage,false);
   const response=await disableLocalMorningNotifications(plugin);
   return {saved,response};
  });
  result.textContent=response.ok?(saved?'Tägliche Erinnerung auf diesem Gerät deaktiviert.':'Erinnerungen entfernt, aber die Deaktivierung konnte nicht dauerhaft gespeichert werden. Bitte Luna-Benachrichtigungen zusätzlich in den Geräteeinstellungen ausschalten.'):'Deaktivierung fehlgeschlagen ('+response.reason+'). Bitte die Benachrichtigungen in den Geräteeinstellungen ausschalten.';
  await update();
 });
 await update();
 return true;
}

export async function stopNativeMorningNotifications(scope=globalThis){
 if(!nativePlatform(scope.Capacitor))return {ok:true};
 return queueNotificationChange(async()=>{
  const saved=writeMorningEnabled(scope.localStorage,false);
  try{
   const plugin=(await import('@capacitor/local-notifications')).LocalNotifications;
   const result=await disableLocalMorningNotifications(plugin);
   return {ok:result.ok&&saved,reason:result.ok?(saved?'':'preference-not-saved'):result.reason};
  }catch{return {ok:false,reason:'unavailable'};}
 });
}

// Called only after unlocking the local vault: the name never goes into localStorage.
export async function refreshNativeMorningNotifications(scope=globalThis,getName=()=>'',{force=false}={}){
 if(!nativePlatform(scope.Capacitor)||!readMorningEnabled(scope.localStorage))return {ok:false,reason:'disabled'};
 try{
  const plugin=(await import('@capacitor/local-notifications')).LocalNotifications;
  return await queueNotificationChange(()=>readMorningEnabled(scope.localStorage)
   ?refreshLocalMorningNotifications(plugin,readMorningTime(scope.localStorage),getName(),new Date(),{force})
   :{ok:false,reason:'disabled'});
 }catch{return {ok:false,reason:'unavailable'};}
}

/* User-triggered immediate test, deliberately separate from daily schedule. */
export async function sendNativeTestNotification(scope=globalThis){
 if(!nativePlatform(scope.Capacitor))return {ok:false,message:'Nur in der installierten App verfügbar.'};
 try{
  const plugin=(await import('@capacitor/local-notifications')).LocalNotifications;
  const status=await plugin.checkPermissions();
  let permission=status?.display;
  if(permission!=='granted')permission=(await plugin.requestPermissions())?.display;
  if(permission!=='granted')return {ok:false,message:'Benachrichtigungsberechtigung nicht erteilt.'};
  // Unique ID prevents the test from overwriting daily reminders.
  const id=631;
  await plugin.schedule({notifications:[{id,title:'Dein Luna-Moment',body:'Dies ist eine Test-Benachrichtigung von Luna.',schedule:{at:new Date(Date.now()+10000)},isExactNotification:false,extra:{kind:'notification-test'}}]});
  return {ok:true,message:'Test für in etwa 10 Sekunden geplant. Sperre dein Handy und prüfe die Benachrichtigung.'};
 }catch{return {ok:false,message:'Test konnte nicht geplant werden. Bitte App-Berechtigungen prüfen.'};}
}

// Only non-health preferences are stored outside the encrypted vault.
export function validMorningTime(time){return typeof time==='string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);}
export function readMorningTime(storage){try{const t=storage?.getItem('luna-morning-clock');return validMorningTime(t)?t:LUNA_MORNING_TIME;}catch{return LUNA_MORNING_TIME;}}
export function writeMorningTime(storage,time){if(!validMorningTime(time))return false;try{storage?.setItem('luna-morning-clock',time);return true;}catch{return false;}}
export function readMorningEnabled(storage){try{return storage?.getItem(ENABLED_KEY)==='yes';}catch{return false;}}
export function writeMorningEnabled(storage,enabled){try{if(enabled)storage?.setItem(ENABLED_KEY,'yes');else storage?.removeItem(ENABLED_KEY);return true;}catch{return false;}}
