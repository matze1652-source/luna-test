/* Native-only local notifications. No server and never any cycle/health details. */
export const LUNA_MORNING_ID=630; // V47/V48 legacy recurring notification, removed during migration.
export const LUNA_MORNING_TIME='06:30';
export const LUNA_MORNING_TITLE='Dein Luna-Moment';
export const LUNA_MORNING_BODY='Ein kleiner Moment nur für dich. Öffne Luna, wenn du magst.';
export const LUNA_MORNING_FIRST_ID=7100;
export const LUNA_MORNING_DAYS=56; // Reserve capacity under iOS's 64-pending-notification limit.
export const LUNA_MORNING_REFRESH_WHEN_DAYS_LEFT=21;

const morningThoughts=[
 'Heute darfst du dir selbst ein bisschen Freundlichkeit schenken. ♡',
 'Ein neuer Tag, ein neuer kleiner Moment nur für dich. 🌸',
 'Du musst nicht alles auf einmal schaffen. Dein Tempo zählt.',
 'Vielleicht wartet heute etwas Schönes im Kleinen auf dich. ✨',
 'Du darfst stolz sein auf die Schritte, die niemand sieht.',
 'Nimm dir heute einen Augenblick, der ganz dir gehört.',
 'Du bist mehr als deine To-do-Liste. Hab einen schönen Tag. ♡',
 'Ein freundlicher Gedanke an dich selbst ist ein guter Anfang.',
 'Heute darf auch ein ruhiger Tag ein guter Tag sein. 🌷',
 'Du musst nicht perfekt sein, um etwas Schönes zu erleben.',
 'Manchmal beginnt ein guter Morgen mit einem tiefen Atemzug.',
 'Kleine Pausen dürfen einen festen Platz in deinem Tag haben.',
 'Ich wünsche dir heute ein Lächeln, das von Herzen kommt.',
 'Du darfst deine Pläne ändern und trotzdem zufrieden sein.',
 'Was dir Freude macht, verdient heute ein bisschen Platz. ✨',
 'Ein liebevoller Start muss nicht kompliziert sein. ♡',
 'Heute ist Raum für neue Ideen und kleine Überraschungen.',
 'Du darfst heute freundlich mit deinen Grenzen umgehen.',
 'Vielleicht findest du heute einen Grund zum Durchatmen.',
 'Nimm die schönen Augenblicke mit, auch wenn sie klein sind.',
 'Ein Schritt nach dem anderen ist völlig in Ordnung. 🌸',
 'Du darfst heute etwas nur für dich tun.',
 'Lass ein bisschen Leichtigkeit in deinen Morgen. ✨',
 'Deine Zeit ist wertvoll. Vergiss dich selbst nicht.',
 'Auch leise Erfolge sind Erfolge. ♡',
 'Ich wünsche dir einen sanften Start und gute Begegnungen.',
 'Heute darfst du einfach du selbst sein. 🌷',
 'Vielleicht wird heute ein Tag mit einem schönen Moment.'
];

export function nativePlatform(capacitor){return Boolean(capacitor?.isNativePlatform?.());}
export function validNotificationTime(time){return typeof time==='string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);}
export function isMorningId(id){return id===LUNA_MORNING_ID || (Number.isInteger(id)&&id>=LUNA_MORNING_FIRST_ID&&id<LUNA_MORNING_FIRST_ID+LUNA_MORNING_DAYS);}
export function morningIds(){return [{id:LUNA_MORNING_ID},...Array.from({length:LUNA_MORNING_DAYS},(_,i)=>({id:LUNA_MORNING_FIRST_ID+i}))];}
export function morningTitle(name=''){
 const safe=typeof name==='string'?name.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,'').trim().slice(0,40):'';
 return safe?`Guten Morgen, ${safe}! 🌸`:'Guten Morgen! 🌸';
}
export function buildMorningNotifications(time=LUNA_MORNING_TIME,name='',now=new Date()){
 if(!validNotificationTime(time)||!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error('Ungültige Erinnerungszeit.');
 const [hour,minute]=time.split(':').map(Number);
 const start=new Date(now.getFullYear(),now.getMonth(),now.getDate(),hour,minute);
 if(start<=now)start.setDate(start.getDate()+1);
 // Local calendar dates, not 24-hour UTC increments: preserve local time across DST.
 return Array.from({length:LUNA_MORNING_DAYS},(_,i)=>{
  const at=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i,hour,minute);
  const calendarDay=Math.floor(Date.UTC(at.getFullYear(),at.getMonth(),at.getDate())/86400000);
  return {id:LUNA_MORNING_FIRST_ID+i,title:morningTitle(name),body:morningThoughts[((calendarDay%morningThoughts.length)+morningThoughts.length)%morningThoughts.length],
   schedule:{at,allowWhileIdle:true},isExactNotification:false,extra:{kind:'morning-reminder'}};
 });
}
// A pending ID alone does not prove that the OS retained the intended reminder.
// Capacitor may return schedule.at as an ISO string rather than a Date object.
function pendingMatchesExpected(pending,expected,{checkId=true}={}){
 if(!pending||!expected||typeof pending!=='object'||!pending.schedule)return false;
 const actualAt=pending.schedule.at instanceof Date?pending.schedule.at:new Date(pending.schedule.at);
 return Number.isFinite(actualAt.getTime())&&actualAt.getTime()===expected.schedule.at.getTime()&&
  pending.title===expected.title&&pending.body===expected.body&&
  (!checkId||pending.id===expected.id);
}
export async function enableLocalMorningNotifications(plugin,time=LUNA_MORNING_TIME,name='',now=new Date(),{askPermission=true}={}){
 if(!plugin||!validNotificationTime(time))return {ok:false,reason:'unavailable'};
 try{
  let display=(await plugin.checkPermissions())?.display;
  if(display!=='granted'&&askPermission)display=(await plugin.requestPermissions())?.display;
  if(display!=='granted')return {ok:false,reason:'permission-denied'};
  const notifications=buildMorningNotifications(time,name,now);
  await plugin.cancel({notifications:morningIds()});
  await plugin.schedule({notifications});
  const pending=(await plugin.getPending())?.notifications;
  const ours=Array.isArray(pending)?pending.filter(n=>isMorningId(n.id)):[];
  const byId=new Map(ours.map(n=>[n.id,n]));
  // Confirm dates, text and every ID, not merely the number of entries.
  if(ours.length!==notifications.length||byId.size!==notifications.length||
     notifications.some(n=>!pendingMatchesExpected(byId.get(n.id),n))){
   await plugin.cancel({notifications:morningIds()});
   return {ok:false,reason:'not-confirmed'};
  }
  return {ok:true,count:notifications.length};
 }catch{
  // A partial batch must not leave the user believing all days are scheduled.
  try{await plugin.cancel({notifications:morningIds()});}catch{}
  return {ok:false,reason:'schedule-failed'};
 }
}
export async function disableLocalMorningNotifications(plugin){
 if(!plugin)return {ok:false,reason:'unavailable'};
 try{
  await plugin.cancel({notifications:morningIds()});
  const pending=(await plugin.getPending())?.notifications;
  if(!Array.isArray(pending)||pending.some(n=>isMorningId(n.id)))return {ok:false,reason:'not-confirmed'};
  return {ok:true};
 }catch{return {ok:false,reason:'cancel-failed'};}
}
export async function isLocalMorningScheduled(plugin){
 if(!plugin)return false;
 try{return (await plugin.getPending())?.notifications?.some(n=>isMorningId(n.id))===true;}
 catch{return false;}
}
export async function refreshLocalMorningNotifications(plugin,time,name='',now=new Date(),{force=false}={}){
 if(!plugin)return {ok:false,reason:'unavailable'};
 if(!validNotificationTime(time)||!(now instanceof Date)||!Number.isFinite(now.getTime()))return {ok:false,reason:'unavailable'};
 try{
  // Revoked OS permission must never be mistaken for working reminders.
  // Background refresh does not request permission; only a user tap can do so.
  if((await plugin.checkPermissions())?.display!=='granted')return {ok:false,reason:'permission-denied'};
  const pending=(await plugin.getPending())?.notifications;
  if(!Array.isArray(pending))return {ok:false,reason:'not-confirmed'};
  const scheduled=pending.filter(n=>Number.isInteger(n.id)&&n.id>=LUNA_MORNING_FIRST_ID&&n.id<LUNA_MORNING_FIRST_ID+LUNA_MORNING_DAYS);
  const expected=buildMorningNotifications(time,name,now);
  const expectedByTime=new Map(expected.map(n=>[n.schedule.at.getTime(),n]));
  // Require continuous coverage for the *next* 21 calendar mornings. A count
  // of 21 sparse or stale entries does not establish reliable delivery.
  const coversNextMornings=expected.slice(0,LUNA_MORNING_REFRESH_WHEN_DAYS_LEFT)
   .every(day=>scheduled.some(n=>pendingMatchesExpected(n,day,{checkId:false})));
  const future=scheduled.filter(n=>{
   const at=n.schedule?.at instanceof Date?n.schedule.at:new Date(n.schedule?.at);
   return Number.isFinite(at.getTime())&&at>now;
  });
  const futureTimes=future.map(n=>new Date(n.schedule.at).getTime());
  // Reject duplicates and unexpected/changed future reminders as well.
  const allFutureValid=new Set(futureTimes).size===futureTimes.length&&future.every(n=>{
   const at=new Date(n.schedule.at).getTime();
   return pendingMatchesExpected(n,expectedByTime.get(at),{checkId:false});
  });
  if(!force&&coversNextMornings&&allFutureValid&&!pending.some(n=>n.id===LUNA_MORNING_ID)){
   return {ok:true,unchanged:true,count:future.length};
  }
  return enableLocalMorningNotifications(plugin,time,name,now,{askPermission:false});
 }catch{return {ok:false,reason:'refresh-failed'};}
}
