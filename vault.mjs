/* Luna V5: encrypted, passphrase-unlocked, local-only data vault.
 * Password is never persisted. The non-extractable CryptoKey is kept in memory only.
 * All user content is encrypted with a fresh AES-GCM nonce before localStorage writes.
 */
import {sanitizePrivateState} from './backup.mjs';
import {loadLegacy} from './legacy-migration.mjs';

export const VAULT_KEY='luna-v5-encrypted-vault';
export const LEGACY_KEYS=['luna-v2-private-local','luna_private_cycle_v1'];
// Explicit full-data deletion in protected mode also removes fictional test records.
const TEST_KEYS=['luna-v39-fictional-test-only','luna-test-fertility-v40-opt-in'];
const FORMAT='luna-local-vault';
const ITERATIONS=240000;
const MAX_BYTES=1500000;
const enc=new TextEncoder();
const dec=new TextDecoder('utf-8',{fatal:true});
const aad=enc.encode('luna-local-vault/v1');
const b64=bytes=>{let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);};
function fromB64(s,max){
 if(typeof s!=='string'||s.length>max*2||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s))throw Error('Der verschlüsselte Datenspeicher ist beschädigt.');
 let bytes;try{bytes=Uint8Array.from(atob(s),c=>c.charCodeAt(0));}catch{throw Error('Der verschlüsselte Datenspeicher ist beschädigt.');}
 if(bytes.length>max)throw Error('Der Datenspeicher ist zu groß.');
 return bytes;
}
function parseEnvelope(raw){
 if(typeof raw!=='string'||raw.length>MAX_BYTES*2)throw Error('Der Datenspeicher ist zu groß oder beschädigt.');
 let obj;try{obj=JSON.parse(raw);}catch{throw Error('Der verschlüsselte Datenspeicher ist beschädigt.');}
 if(obj?.format!==FORMAT||obj.version!==1||obj.kdf!=='PBKDF2-SHA256'||obj.iterations!==ITERATIONS||obj.cipher!=='AES-256-GCM')throw Error('Unbekanntes Format des Datenspeichers.');
 const salt=fromB64(obj.salt,16),nonce=fromB64(obj.nonce,12),data=fromB64(obj.data,MAX_BYTES);
 if(salt.length!==16||nonce.length!==12||data.length<16)throw Error('Der verschlüsselte Datenspeicher ist beschädigt.');
 return {salt,nonce,data};
}
async function derive(password,salt,api){
 if(typeof password!=='string'||password.length<12)throw Error('Bitte ein Passwort mit mindestens 12 Zeichen verwenden.');
 if(!api?.subtle||!api?.getRandomValues)throw Error('Sichere Verschlüsselung erfordert HTTPS oder localhost und einen aktuellen Browser.');
 const material=await api.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
 return api.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function seal(state,key,salt,api){
 const clean=sanitizePrivateState(state);
 const nonce=api.getRandomValues(new Uint8Array(12));
 const data=await api.subtle.encrypt({name:'AES-GCM',iv:nonce,additionalData:aad},key,enc.encode(JSON.stringify(clean)));
 return JSON.stringify({format:FORMAT,version:1,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,cipher:'AES-256-GCM',salt:b64(salt),nonce:b64(nonce),data:b64(new Uint8Array(data))});
}
async function open(raw,key,api){
 const {nonce,data}=parseEnvelope(raw);
 let bytes;
 try{bytes=await api.subtle.decrypt({name:'AES-GCM',iv:nonce,additionalData:aad},key,data);}
 catch{throw Error('Passwort falsch oder verschlüsselte Daten beschädigt.');}
 let parsed;try{parsed=JSON.parse(dec.decode(bytes));}catch{throw Error('Entschlüsselte Daten sind beschädigt.');}
 return sanitizePrivateState(parsed);
}
export class LunaVault {
 constructor(storage=globalThis.localStorage,api=globalThis.crypto){this.storage=storage;this.api=api;this.key=null;this.salt=null;this.current=null;this.generation=0;this.verifiedLegacySnapshot=null;}
 assertSession(generation){if(this.generation!==generation)throw Error('Die Sitzung wurde inzwischen gesperrt. Bitte erneut entsperren.');}
 get unlocked(){return Boolean(this.key);}
 get canRetryLegacyCleanup(){return Boolean(this.verifiedLegacySnapshot);}
 exists(){return this.storage.getItem(VAULT_KEY)!==null;}
 legacyPresent(){return LEGACY_KEYS.some(k=>this.storage.getItem(k)!==null);}
 // Only legacy bytes that were explicitly imported and verified may be deleted.
 // A later unlock cannot establish that legacy records match this vault.
 cleanupLegacy(){
  const snapshot=this.verifiedLegacySnapshot;
  if(!snapshot)return !this.legacyPresent();
  if(LEGACY_KEYS.some(k=>{
   const previous=snapshot.get(k),now=this.storage.getItem(k);
   return now!==previous && !(previous!==null&&now===null);
  }))return false;
  for(const k of LEGACY_KEYS){
   if(snapshot.get(k)!==null){
    try{this.storage.removeItem(k);}catch{return false;}
   }
  }
  const cleared=!this.legacyPresent();
  if(cleared)this.verifiedLegacySnapshot=null;
  return cleared;
 }
 // Migration is a separate, explicit operation. Do not erase legacy records
 // simply because a vault was created or unlocked.
 async createMigratingLegacy(password,defaults){
  if(this.exists())throw Error('Ein geschützter Datenspeicher existiert bereits.');
  const snapshot=new Map(LEGACY_KEYS.map(k=>[k,this.storage.getItem(k)]));
  const imported=loadLegacy(this.storage,defaults);
  // Fail closed if source records changed between reading and validation.
  if(LEGACY_KEYS.some(k=>this.storage.getItem(k)!==snapshot.get(k)))
   throw Error('Alte Daten wurden während der Übernahme geändert. Bitte neu laden.');
  const result=await this.create(password,imported);
  this.verifiedLegacySnapshot=snapshot;
  return {...result,legacyCleared:this.cleanupLegacy()};
 }
 async create(password,state){
  const generation=this.generation;
  if(this.exists())throw Error('Ein geschützter Datenspeicher existiert bereits. Bitte entsperren.');
  const salt=this.api?.getRandomValues?.(new Uint8Array(16));
  if(!salt)throw Error('Sichere Verschlüsselung ist hier nicht verfügbar.');
  const key=await derive(password,salt,this.api);
  const raw=await seal(state,key,salt,this.api);
  this.assertSession(generation);
  if(this.exists())throw Error('Datenspeicher wurde in einem anderen Tab erstellt. Bitte neu laden.');
  this.storage.setItem(VAULT_KEY,raw);
  // Verify that the committed ciphertext can be read before removing any plaintext.
  const verified=await open(this.storage.getItem(VAULT_KEY),key,this.api);
  this.assertSession(generation);
  this.key=key;this.salt=salt;this.current=raw;
  return {state:verified,legacyCleared:!this.legacyPresent()};
 }
 async unlock(password){
  const generation=this.generation;
  const raw=this.storage.getItem(VAULT_KEY);
  if(raw===null)throw Error('Kein geschützter Datenspeicher gefunden.');
  const {salt}=parseEnvelope(raw);
  const key=await derive(password,salt,this.api);
  const state=await open(raw,key,this.api);
  this.assertSession(generation);
  // Detect a competing writer during the expensive password derivation.
  if(this.storage.getItem(VAULT_KEY)!==raw)throw Error('Die Daten wurden in einem anderen Tab geändert. Bitte erneut entsperren.');
  this.key=key;this.salt=salt;this.current=raw;
  return {state,legacyCleared:!this.legacyPresent()};
 }
 async save(state){
  const generation=this.generation;
  if(!this.unlocked)throw Error('Luna ist gesperrt.');
  if(this.storage.getItem(VAULT_KEY)!==this.current)throw Error('Daten wurden in einem anderen Tab geändert. Bitte Luna neu öffnen.');
  const raw=await seal(state,this.key,this.salt,this.api);
  this.assertSession(generation);
  if(this.storage.getItem(VAULT_KEY)!==this.current)throw Error('Daten wurden in einem anderen Tab geändert. Bitte Luna neu öffnen.');
  this.storage.setItem(VAULT_KEY,raw);
  if(this.storage.getItem(VAULT_KEY)!==raw)throw Error('Speichern konnte nicht bestätigt werden. Bitte Luna erneut entsperren.');
  this.current=raw;
 }
 async changePassword(currentPassword,newPassword){
  const generation=this.generation;
  if(!this.unlocked)throw Error('Luna ist gesperrt.');
  // Verify the current password against the stored ciphertext, not just the
  // unlocked session. This also detects corrupted or replaced storage.
  const original=this.current;
  if(this.storage.getItem(VAULT_KEY)!==original)throw Error('Daten wurden in einem anderen Tab geändert. Bitte Luna neu öffnen.');
  const {salt}=parseEnvelope(original);
  const oldKey=await derive(currentPassword,salt,this.api);
  const verified=await open(original,oldKey,this.api);
  if(this.storage.getItem(VAULT_KEY)!==original)throw Error('Daten wurden in einem anderen Tab geändert. Bitte Luna neu öffnen.');
  // A fresh salt, new derived key and fresh AES-GCM nonce ensure that the old
  // password no longer decrypts the updated vault. No plaintext is persisted.
  const newSalt=this.api.getRandomValues(new Uint8Array(16));
  const newKey=await derive(newPassword,newSalt,this.api);
  const replacement=await seal(verified,newKey,newSalt,this.api);
  await open(replacement,newKey,this.api); // verify before replacing the original
  this.assertSession(generation);
  if(this.storage.getItem(VAULT_KEY)!==original)throw Error('Daten wurden in einem anderen Tab geändert. Bitte Luna neu öffnen.');
  this.storage.setItem(VAULT_KEY,replacement);
  if(this.storage.getItem(VAULT_KEY)!==replacement)throw Error('Passwortänderung konnte nicht bestätigt werden. Bitte Luna erneut entsperren.');
  this.key=newKey;this.salt=newSalt;this.current=replacement;
  return true;
 }
 lock(){this.generation++;this.key=null;this.salt=null;this.current=null;this.verifiedLegacySnapshot=null;}
 clear(){
  this.lock();
  this.storage.removeItem(VAULT_KEY);
  for(const k of [...LEGACY_KEYS,...TEST_KEYS])this.storage.removeItem(k);
  if(this.exists()||[...LEGACY_KEYS,...TEST_KEYS].some(k=>this.storage.getItem(k)!==null))
   throw Error('Nicht alle Luna-Daten konnten gelöscht werden.');
 }
}
