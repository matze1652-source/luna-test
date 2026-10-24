/* Local-notification tap routing. Never unlocks the encrypted vault. */
export const LUNA_NOTIFICATION_KINDS = Object.freeze(['morning-reminder','notification-test']);
export function isLunaNotificationTap(event){
 const notification=event?.notification;
 return notification && LUNA_NOTIFICATION_KINDS.includes(notification.extra?.kind) &&
  Number.isInteger(notification.id) && (notification.id===631 || (notification.id>=7100&&notification.id<7156));
}
/** Registers the native tap handler; callers can remove it during teardown. */
export async function registerLunaNotificationTap(plugin,{isUnlocked,onHome}={}){
 if(typeof plugin?.addListener!=='function'||typeof isUnlocked!=='function'||typeof onHome!=='function')return {ok:false,reason:'unavailable'};
 try{
  const handle=await plugin.addListener('localNotificationActionPerformed',event=>{
   if(!isLunaNotificationTap(event))return;
   // The OS opens the app. Only navigate if the local vault is already unlocked.
   // If locked, the normal password gate stays in place; after unlock the home screen appears.
   if(isUnlocked())onHome();
  });
  if(typeof handle?.remove!=='function')return {ok:false,reason:'listener-unconfirmed'};
  return {ok:true,remove:()=>handle.remove()};
 }catch{return {ok:false,reason:'listener-failed'};}
}
