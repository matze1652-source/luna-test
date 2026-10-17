/* Native-only daily local reminders. Never sends health data to a server. */
export const LUNA_MORNING_ID=630;
export const LUNA_MORNING_TIME='06:30';
export const LUNA_MORNING_TITLE='Dein Luna-Moment';
export const LUNA_MORNING_BODY='Ein kleiner Moment nur für dich. Öffne Luna, wenn du magst.';
export function nativePlatform(capacitor){
 return Boolean(capacitor?.isNativePlatform?.());
}
export async function enableLocalMorningNotifications(plugin, time=LUNA_MORNING_TIME){
 if(!plugin || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return {ok:false,reason:'unavailable'};
 try{
  const status=await plugin.checkPermissions();
  let display=status?.display;
  if(display!=='granted')display=(await plugin.requestPermissions())?.display;
  if(display!=='granted')return {ok:false,reason:'permission-denied'};
  const [hour,minute]=time.split(':').map(Number);
  await plugin.cancel({notifications:[{id:LUNA_MORNING_ID}]});
  await plugin.schedule({notifications:[{
   id:LUNA_MORNING_ID,title:LUNA_MORNING_TITLE,body:LUNA_MORNING_BODY,
   schedule:{on:{hour,minute},allowWhileIdle:true},
   smallIcon:'ic_stat_luna',
   extra:{kind:'morning-reminder'}
  }]});
  return {ok:true};
 }catch{return {ok:false,reason:'schedule-failed'};}
}
export async function disableLocalMorningNotifications(plugin){
 if(!plugin)return {ok:false,reason:'unavailable'};
 try{await plugin.cancel({notifications:[{id:LUNA_MORNING_ID}]});return {ok:true};}
 catch{return {ok:false,reason:'cancel-failed'};}
}
export async function isLocalMorningScheduled(plugin){
 if(!plugin)return false;
 try{return (await plugin.getPending())?.notifications?.some(n=>n.id===LUNA_MORNING_ID)===true;}
 catch{return false;}
}
