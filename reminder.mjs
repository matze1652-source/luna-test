/* Optional privacy-safe calendar reminder. Does not schedule push notifications. */
const isoLocal=(date)=>`${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}T${String(date.getHours()).padStart(2,'0')}${String(date.getMinutes()).padStart(2,'0')}00`;
const isoUTC=(date)=>date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
export function reminderCalendar(time,now=new Date(),id='luna-private-reminder'){
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error('Ungültige Erinnerungszeit.');
 if(typeof id!=='string'||id.length>100||!(/^[a-z0-9-]+$/i.test(id)))throw Error('Ungültige Erinnerungskennung.');
 const [h,m]=time.split(':').map(Number);
 const start=new Date(now.getFullYear(),now.getMonth(),now.getDate(),h,m,0,0);
 if(start<=now)start.setDate(start.getDate()+1);
 // Floating DTSTART intentionally tracks the calendar app's local clock time across DST.
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Luna//Daily Wellbeing//DE','CALSCALE:GREGORIAN','METHOD:PUBLISH',
 'BEGIN:VEVENT',`UID:${id}@local.invalid`,`DTSTAMP:${isoUTC(now)}`,`DTSTART:${isoLocal(start)}`,'DURATION:PT5M','RRULE:FREQ=DAILY',
 'SUMMARY:Dein Luna-Moment','DESCRIPTION:Ein kleiner Moment nur für dich. Öffne Luna, wenn du magst.',
 'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Dein Luna-Moment','TRIGGER:PT0S','END:VALARM','END:VEVENT','END:VCALENDAR',''].join('\r\n');
}
