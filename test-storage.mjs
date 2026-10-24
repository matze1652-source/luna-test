/* Luna V42: explicitly unencrypted, fictional-data-only test storage.
 * This is not suitable for genuine health data or public release.
 * A synchronous revision check prevents stale tabs from silently overwriting
 * previously changed/deleted test records (localStorage is not transactional).
 */
import {sanitizePrivateState} from './backup.mjs';

export const TEST_KEY='luna-v39-fictional-test-only';
export const FERTILITY_OPT_IN='luna-test-fertility-v40-opt-in';

export class LunaTestStore {
 constructor(storage=globalThis.localStorage){
  this.storage=storage;
  this.current=storage.getItem(TEST_KEY);
  this.invalidated=false;
 }
 get unlocked(){return !this.invalidated;}
 exists(){return this.storage.getItem(TEST_KEY)!==null;}
 legacyPresent(){return false;}
 lock(){this.invalidated=true;}
 cleanupLegacy(){return true;}
 invalidate(){this.invalidated=true;}
 read(){
  const raw=this.storage.getItem(TEST_KEY);
  if(raw!==this.current)throw Error('Testdaten wurden in einem anderen Tab verändert. Bitte Luna neu öffnen.');
  if(raw===null)return null;
  try {
   if(raw.length>1000000)throw Error('too large');
   return sanitizePrivateState(JSON.parse(raw));
  }catch{throw Error('Gespeicherte Testdaten sind beschädigt. Sie wurden NICHT überschrieben. Du kannst sie im Browser löschen und neu starten.');}
 }
 async save(data){
  if(!this.unlocked)throw Error('Die Testsitzung ist nicht mehr gültig. Bitte Luna neu öffnen.');
  if(this.storage.getItem(TEST_KEY)!==this.current){this.invalidate();throw Error('Testdaten wurden in einem anderen Tab geändert oder gelöscht. Bitte Luna neu öffnen.');}
  const raw=JSON.stringify(sanitizePrivateState(data));
  this.storage.setItem(TEST_KEY,raw);
  if(this.storage.getItem(TEST_KEY)!==raw){this.invalidate();throw Error('Das Speichern konnte nicht bestätigt werden.');}
  this.current=raw;
 }
 clear(){
  // Only remove V39+ test data and its test-only opt-in. Never silently erase
  // separate, password-protected LunaVault records from older versions.
  this.invalidate();
  for(const key of [TEST_KEY,FERTILITY_OPT_IN])this.storage.removeItem(key);
  if(this.storage.getItem(TEST_KEY)!==null||this.storage.getItem(FERTILITY_OPT_IN)!==null)
   throw Error('Nicht alle Testdaten konnten entfernt werden. Bitte erneut versuchen.');
  this.current=null;
 }
}
