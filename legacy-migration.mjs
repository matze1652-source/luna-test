/* Luna V21: fail-closed migration of old unencrypted local data.
 * Invalid or unreadable source data must never be replaced with an empty vault
 * and then deleted by LunaVault.cleanupLegacy().
 */
import {parseDate} from './cycle.mjs';
import {sanitizePrivateState} from './backup.mjs';

const V2_KEY='luna-v2-private-local';
const V1_KEY='luna_private_cycle_v1';
const failure=()=>Error('Alte Luna-Daten sind unvollständig oder beschädigt. Die Übernahme wurde abgebrochen; die alten Daten bleiben erhalten.');
function decode(raw){
 try{
  const data=JSON.parse(raw);
  if(!data||typeof data!=='object'||Array.isArray(data))throw failure();
  return data;
 }catch{throw failure();}
}
function assertNoSilentLoss(source,clean){
 if(source.periods.length!==clean.periods.length||source.symptoms.length!==clean.symptoms.length)throw failure();
 const moods=source.moods||{};
 if(!moods||typeof moods!=='object'||Array.isArray(moods)||Object.keys(moods).length!==Object.keys(clean.moods).length)throw failure();
}
export function loadLegacy(storage,defaults){
 const v2=storage.getItem(V2_KEY),v1=storage.getItem(V1_KEY);
 if(v2===null&&v1===null)return defaults();
 const state=defaults();
 let source;
 if(v2!==null){
  const data=decode(v2);
  if(!data.profile||typeof data.profile!=='object'||Array.isArray(data.profile)||!Array.isArray(data.periods)||!Array.isArray(data.symptoms))throw failure();
  source={...state,...data,profile:{...state.profile,...data.profile},moods:data.moods??{},appointment:data.appointment??state.appointment};
 }else{
  const data=decode(v1);
  if(!parseDate(data.start)||!Array.isArray(data.entries||[])||data.entries?.some(e=>!e||typeof e!=='object'||!parseDate(e.date)))throw failure();
  const duration=data.duration===undefined?5:Number(data.duration);
  const cycleLength=data.length===undefined?28:Number(data.length);
  source={...state,periods:[{start:data.start,duration}],profile:{...state.profile,cycleLength},symptoms:(data.entries||[]).map(e=>({date:e.date,pain:e.pain===undefined?0:Number(e.pain),type:e.symptom||'Andere',notes:e.note||''}))};
 }
 try{
  const clean=sanitizePrivateState(source);
  assertNoSilentLoss(source,clean);
  return clean;
 }catch{throw failure();}
}
