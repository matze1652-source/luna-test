/* In-memory sample data for a non-persistent preview; no real health records. */
import {addDays} from './cycle.mjs';

export function demoState(today){
 const starts=[-81,-53,-25].map(offset=>({start:addDays(today,offset),duration:5}));
 return {
  version:2,
  profile:{name:'Mira',birthday:'1998-04-12',cycleLength:28,duration:5,time:'08:00'},
  periods:starts,
  symptoms:[
   {date:addDays(today,-2),pain:3,type:'Krämpfe',notes:'Beispiel: etwas Wärme hat gutgetan.'},
   {date:addDays(today,-5),pain:1,type:'Kopfschmerzen',notes:'Beispieleintrag zum Ausprobieren.'}
  ],
  moods:{[today]:'gut'},
  appointment:{date:'',notes:''}
 };
}
export function demoSave(){return true;} // Intentionally never touches storage or network.
