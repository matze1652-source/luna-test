/* Luna V4 – encrypted, local-only backups. This is not encryption-at-rest. */
import {normalizePeriods,parseDate} from './cycle.mjs';
const FORMAT='luna-private-encrypted-backup';
const ITERATIONS=240000;
const enc=new TextEncoder();
const dec=new TextDecoder('utf-8',{fatal:true});
const nonBlankString=(v,max=400)=>typeof v==='string'?v.slice(0,max):'';
const own=(obj,key)=>obj&&typeof obj==='object'&&Object.prototype.hasOwnProperty.call(obj,key);
const base64=data=>{let s=''; for(const b of data) s+=String.fromCharCode(b);return btoa(s);};
const unbase64=text=>Uint8Array.from(atob(text),ch=>ch.charCodeAt(0));
function validDate(value){return typeof value==='string'&&Boolean(parseDate(value));}
function validDateTime(value){if(typeof value!=='string')return false;if(value==='')return true;const m=/^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(value);return Boolean(m&&validDate(m[1]));}
export function sanitizePrivateState(data){
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Unbekanntes Datenformat.');
 if(!Array.isArray(data.periods)||!Array.isArray(data.symptoms)||!data.profile||typeof data.profile!=='object'||Array.isArray(data.profile))throw Error('Backup enthält keine gültigen Luna-Daten.');
 if(data.periods.length>2500||data.symptoms.length>5000||JSON.stringify(data).length>1000000)throw Error('Die Sicherung ist ungewöhnlich groß.');
 for(const p of data.periods){if(!validDate(p?.start)||!Number.isInteger(Number(p?.duration))||Number(p.duration)<1||Number(p.duration)>15)throw Error('Ungültige Periodendaten.');}
 for(const x of data.symptoms){if(!validDate(x?.date)||!Number.isInteger(Number(x?.pain))||Number(x.pain)<0||Number(x.pain)>10)throw Error('Ungültige Symptome.');}
 const p=data.profile;
 const len=Number(p.cycleLength),dur=Number(p.duration);
 if(!Number.isInteger(len)||len<15||len>90||!Number.isInteger(dur)||dur<1||dur>15||dur>len)throw Error('Ungültige Zykluseinstellungen.');
 if(p.birthday&&!validDate(p.birthday))throw Error('Ungültiges Geburtsdatum.');
 if(p.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time))throw Error('Ungültige Uhrzeit.');
 if(data.appointment?.date&&!validDateTime(data.appointment.date))throw Error('Ungültiger Termin.');
 const moods=Object.create(null);
 if(data.moods&&typeof data.moods==='object'&&!Array.isArray(data.moods)){
   const keys=Object.keys(data.moods);if(keys.length>5000)throw Error('Zu viele Stimmungseinträge.');
   for(const key of keys){if(validDate(key)&&['gut','sensibel','erschöpft','gestresst'].includes(data.moods[key]))moods[key]=data.moods[key];}
 }
 return {
   version:4,
   profile:{name:nonBlankString(p.name,40),birthday:p.birthday||'',cycleLength:len,duration:dur,time:p.time||'08:00'},
   periods:normalizePeriods(data.periods),
   symptoms:data.symptoms.map(x=>({date:x.date,pain:Number(x.pain),type:nonBlankString(x.type,40)||'Andere',notes:nonBlankString(x.notes,400)})).sort((a,b)=>b.date.localeCompare(a.date)),
   moods,
   preferences:{fertilityOptIn:data.preferences?.fertilityOptIn===true},
   appointment:{date:nonBlankString(data.appointment?.date,16),notes:nonBlankString(data.appointment?.notes,700)}
 };
}
async function passwordKey(password,salt){
 const subtle=globalThis.crypto?.subtle;
 if(!subtle)throw Error('Verschlüsselung ist in diesem Browser nicht verfügbar.');
 const raw=await subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
 return subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},raw,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function createEncryptedBackup(state,password){
 if(typeof password!=='string'||password.length<12)throw Error('Bitte mindestens 12 Zeichen als Passwort verwenden.');
 const clean=sanitizePrivateState(state);
 const salt=crypto.getRandomValues(new Uint8Array(16)),nonce=crypto.getRandomValues(new Uint8Array(12));
 const key=await passwordKey(password,salt);
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},key,enc.encode(JSON.stringify(clean)));
 return JSON.stringify({format:FORMAT,version:1,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,cipher:'AES-256-GCM',salt:base64(salt),nonce:base64(nonce),data:base64(new Uint8Array(ciphertext))},null,2);
}
export async function readEncryptedBackup(text,password){
 if(typeof text!=='string'||text.length>1500000)throw Error('Datei zu groß oder ungültig.');
 if(typeof password!=='string'||password.length<12)throw Error('Bitte dein Backup-Passwort eingeben (mindestens 12 Zeichen).');
 let obj;try{obj=JSON.parse(text)}catch{throw Error('Die Datei ist kein gültiges JSON-Backup.');}
 if(obj?.format!==FORMAT||obj.version!==1||obj.kdf!=='PBKDF2-SHA256'||obj.iterations!==ITERATIONS||obj.cipher!=='AES-256-GCM')throw Error('Das Dateiformat wird nicht unterstützt.');
 let salt,nonce,data;
 try{salt=unbase64(obj.salt);nonce=unbase64(obj.nonce);data=unbase64(obj.data);}catch{throw Error('Die Sicherungsdatei ist beschädigt.');}
 if(salt.length!==16||nonce.length!==12||data.length<16)throw Error('Die Sicherungsdatei ist beschädigt.');
 try{
  const key=await passwordKey(password,salt);
  const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:nonce},key,data);
  return sanitizePrivateState(JSON.parse(dec.decode(bytes)));
 }catch(err){if(err?.message?.includes('Ungültig')||err?.message?.includes('Backup')||err?.message?.includes('ungewöhnlich')||err?.message?.includes('Zu viele'))throw err;throw Error('Entschlüsselung nicht möglich. Passwort falsch oder Datei beschädigt.');}
}
export function describeBackupState(s){return `${s.periods.length} Perioden, ${s.symptoms.length} Symptomeinträge und ${Object.keys(s.moods||{}).length} Stimmungen`;}
