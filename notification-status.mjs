/* Capability reporting only: never asks for permission or promises background delivery. */
export function notificationStatus(env={}) {
 const secure=env.isSecureContext===true;
 const available=env.hasNotification===true;
 const permission=env.permission;
 if(!secure)return {code:'insecure',message:'Benachrichtigungen benötigen eine sichere HTTPS-Verbindung. Die Kalender-Erinnerung bleibt verfügbar.'};
 if(!available)return {code:'unsupported',message:'Dieser Browser unterstützt keine Web-Benachrichtigungen. Nutze bei Bedarf die Kalender-Erinnerung.'};
 if(permission==='denied')return {code:'blocked',message:'Benachrichtigungen sind im Browser blockiert. Luna ändert diese Einstellung nicht.'};
 if(permission==='granted')return {code:'permitted',message:'Benachrichtigungen sind erlaubt. Automatische Erinnerungen bei geschlossener App sind noch nicht eingerichtet.'};
 return {code:'not-requested',message:'Luna fragt nicht ungefragt nach Benachrichtigungsrechten. Automatische Push-Erinnerungen sind noch nicht verfügbar.'};
}
export function browserNotificationEnvironment(scope) {
 return {isSecureContext:scope.isSecureContext===true,hasNotification:typeof scope.Notification!=='undefined',permission:scope.Notification?.permission};
}
