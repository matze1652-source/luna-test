/* Explicitly user-triggered neutral notification. No scheduling or background push. */
export const PREVIEW_TITLE='Dein Luna-Moment';
export const PREVIEW_BODY='Ein kleiner Moment nur für dich. Öffne Luna, wenn du magst.';
const neutralOptions=()=>({body:PREVIEW_BODY,tag:'luna-preview',silent:true});

export async function sendNotificationPreview(scope){
 if(scope?.isSecureContext!==true || typeof scope?.Notification==='undefined')return {ok:false,message:'Benachrichtigungen sind hier nicht verfügbar. Die Kalender-Erinnerung bleibt möglich.'};
 const NotificationAPI=scope.Notification;
 let permission=NotificationAPI.permission;
 if(permission==='denied')return {ok:false,message:'Benachrichtigungen sind blockiert. Bitte ändere dies bei Bedarf in deinen Geräteeinstellungen.'};
 if(permission!=='granted'){
  if(typeof NotificationAPI.requestPermission!=='function')return {ok:false,message:'Dieser Browser kann keine Berechtigung anfordern.'};
  try { permission=await NotificationAPI.requestPermission(); }
  catch { return {ok:false,message:'Die Berechtigungsanfrage konnte nicht abgeschlossen werden. Es wurde keine Nachricht gesendet.'}; }
 }
 if(permission!=='granted')return {ok:false,message:'Keine Benachrichtigung gesendet. Deine Entscheidung wurde respektiert.'};
 // Prefer the service worker API, which works in installed PWAs on supported phones.
 // getRegistration() does not install a worker or wait forever for an unregistered worker.
 try {
  const registration=await scope.navigator?.serviceWorker?.getRegistration?.();
  if(typeof registration?.showNotification==='function'){
   await registration.showNotification(PREVIEW_TITLE,neutralOptions());
   return {ok:true,message:'Testnachricht angefordert. Ob sie angezeigt wird, hängt von Browser und Gerät ab. Keine automatische tägliche Zustellung.'};
  }
 } catch { /* Fallback to desktop Notification constructor below. */ }
 try {
  if(typeof NotificationAPI!=='function')throw Error('No notification constructor');
  new NotificationAPI(PREVIEW_TITLE,neutralOptions());
  return {ok:true,message:'Testnachricht angefordert. Ob sie angezeigt wird, hängt von Browser und Gerät ab. Keine automatische tägliche Zustellung.'};
 } catch {
  return {ok:false,message:'Dieser Browser kann die Testnachricht nicht anzeigen. Die Kalender-Erinnerung bleibt verfügbar.'};
 }
}
