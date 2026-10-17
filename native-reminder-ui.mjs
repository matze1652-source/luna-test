import {enableLocalMorningNotifications,disableLocalMorningNotifications,isLocalMorningScheduled,nativePlatform} from './local-notifications.mjs';
export async function setupNativeReminderUI(scope=globalThis){
 if(!nativePlatform(scope.Capacitor))return false;
 const enable=scope.document.getElementById('morning-push-enable');
 const disable=scope.document.getElementById('morning-push-disable');
 const result=scope.document.getElementById('morning-push-result');
 const note=scope.document.getElementById('morning-reminder-description');
 const capability=scope.document.getElementById('notification-capability');
 if(!enable||!disable||!result)return false;
 // Native mode: prevent the legacy push handlers from running by replacing controls.
 const e=enable,d=disable;
 e.textContent='Tägliche 06:30-Erinnerung einschalten';
 d.textContent='Tägliche Erinnerung ausschalten';
 if(note)note.textContent='Lokale Erinnerung direkt auf deinem Gerät. Kein Server, kein Gesundheitsinhalt. Die genaue Anzeige kann von Energiesparmodus und Systemeinstellungen abhängen.';
 if(capability)capability.textContent='Native lokale Benachrichtigungen verfügbar (nach Berechtigung).';
 let plugin;
 try{plugin=(await import('@capacitor/local-notifications')).LocalNotifications;}
 catch{result.textContent='Lokale Benachrichtigungen sind in dieser App-Version nicht installiert.';e.disabled=true;d.disabled=true;return true;}
 const update=async()=>{const scheduled=await isLocalMorningScheduled(plugin);d.disabled=!scheduled;e.setAttribute('aria-pressed',String(scheduled));};
 e.addEventListener('click',async()=>{
  e.disabled=true;
  const response=await enableLocalMorningNotifications(plugin);
  result.textContent=response.ok?'Tägliche Erinnerung für 06:30 Uhr auf diesem Gerät eingerichtet.':'Erinnerung nicht eingerichtet ('+response.reason+').';
  await update();e.disabled=false;
 });
 d.addEventListener('click',async()=>{
  d.disabled=true;
  const response=await disableLocalMorningNotifications(plugin);
  result.textContent=response.ok?'Tägliche Erinnerung auf diesem Gerät deaktiviert.':'Deaktivierung fehlgeschlagen ('+response.reason+').';
  await update();
 });
 await update();
 return true;
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
  // Unique ID prevents the test from overwriting the daily 06:30 reminder.
  const id=631;
  await plugin.schedule({notifications:[{id,title:'Dein Luna-Moment',body:'Dies ist eine Test-Benachrichtigung von Luna.',schedule:{at:new Date(Date.now()+10000)},extra:{kind:'notification-test'}}]});
  return {ok:true,message:'Test für in etwa 10 Sekunden geplant. Sperre dein Handy und prüfe die Benachrichtigung.'};
 }catch{return {ok:false,message:'Test konnte nicht geplant werden. Bitte App-Berechtigungen prüfen.'};}
}
