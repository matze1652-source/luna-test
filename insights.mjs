/** Pure, non-diagnostic summaries of user-entered observations. */
import {diffDays,normalizePeriods,parseDate} from './cycle.mjs';

export function cycleHistory(periods,limit=6){
  const sorted=normalizePeriods(periods);
  const pairs=[];
  for(let i=1;i<sorted.length;i++){
    const days=diffDays(sorted[i-1].start,sorted[i].start);
    // Irregular and long cycles can be meaningful; display measured intervals,
    // without treating any of them as proof of an ovulation or a diagnosis.
    if(days>0) pairs.push({start:sorted[i-1].start,end:sorted[i].start,days});
  }
  return pairs.slice(-limit);
}

export function symptomOverview(entries,today,windowDays=30){
  if(!parseDate(today)||!Array.isArray(entries))return {tracked:0,painDays:0,severeDays:0,avgPain:null,topSymptom:null};
  // One editable record per date; imports with repeated dates do not inflate statistics.
  const unique=new Map();
  for(const e of entries){
    if(!e||!parseDate(e.date))continue;
    const distance=diffDays(e.date,today);
    const pain=Number(e.pain);
    if(distance===null||distance<0||distance>=windowDays||!Number.isInteger(pain)||pain<0||pain>10)continue;
    unique.set(e.date,{date:e.date,pain,type:String(e.type||'Keine')});
  }
  const recorded=[...unique.values()];
  const symptoms=new Map();
  for(const e of recorded)if(!['Keine','Andere'].includes(e.type))symptoms.set(e.type,(symptoms.get(e.type)||0)+1);
  const top=[...symptoms].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'de'))[0];
  return {
    tracked:recorded.length,
    painDays:recorded.filter(e=>e.pain>0).length,
    severeDays:recorded.filter(e=>e.pain>=7).length,
    avgPain:recorded.length?Math.round(recorded.reduce((a,e)=>a+e.pain,0)/recorded.length*10)/10:null,
    topSymptom:top?.[0]??null
  };
}

export function dailyGuidance(entry,mood){
  const pain=entry?.pain===undefined?null:Number(entry.pain);
  if(pain!==null&&Number.isFinite(pain)&&pain>=8)return {level:'urgent',text:'Du hast sehr starke Schmerzen eingetragen. Bitte heute medizinisch abklären lassen. Bei plötzlichen starken Schmerzen, Ohnmacht oder möglicher Schwangerschaft dringend Hilfe holen.'};
  if(pain!==null&&Number.isFinite(pain)&&pain>=5)return {level:'caution',text:'Bei mittelstarken bis starken Beschwerden können Wärme und Ruhe guttun. Sind die Schmerzen neu, zunehmend oder einschränkend, lass sie ärztlich abklären.'};
  if(mood==='erschöpft')return {level:'gentle',text:'Vielleicht passt heute ein ruhiger Moment zu dir: Lieblingsgetränk, Pause und kein zusätzlicher Druck.'};
  if(mood==='gestresst')return {level:'gentle',text:'Eine kurze Pause ohne Ablenkung kann dir einen kleinen Moment zum Durchatmen schenken.'};
  if(mood==='sensibel')return {level:'gentle',text:'Du musst deine Stimmung nicht erklären. Schau, was dir gerade wirklich guttut.'};
  if(pain!==null&&Number.isFinite(pain)&&pain>0)return {level:'gentle',text:'Wenn es angenehm für dich ist, probiere Wärme oder eine sanfte Bewegung aus.'};
  return {level:'gentle',text:'Dein Selfcare-Impuls: Plane heute einen kleinen Moment nur für dich ein.'};
}
