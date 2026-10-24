/** Luna cycle calculation engine – local calendar days, not fertility or contraceptive advice. */
export const ISO = /^\d{4}-\d{2}-\d{2}$/;
export function parseDate(value) {
  if (typeof value !== 'string' || !ISO.test(value)) return null;
  const [y,m,d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y,m-1,d));
  return date.getUTCFullYear() === y && date.getUTCMonth()+1 === m && date.getUTCDate() === d ? date : null;
}
export function formatISO(date) { return date.toISOString().slice(0,10); }
export function addDays(day, n) { const date = parseDate(day); if (!date || !Number.isInteger(n)) return null; date.setUTCDate(date.getUTCDate()+n); return formatISO(date); }
export function diffDays(a,b) { const x=parseDate(a), y=parseDate(b); return x&&y ? Math.round((y-x)/86400000) : null; }
export function median(values) { const v=[...values].sort((a,b)=>a-b); if (!v.length) return null; const k=Math.floor(v.length/2);return v.length%2?v[k]:Math.round((v[k-1]+v[k])/2); }
export function normalizePeriods(periods=[]) {
  if (!Array.isArray(periods)) return [];
  const unique=new Map();
  for (const p of periods) if (p && parseDate(p.start)) {
    const d=Number(p.duration); unique.set(p.start,{start:p.start,duration:Number.isInteger(d)&&d>=1&&d<=15?d:5});
  }
  return [...unique.values()].sort((a,b)=>a.start.localeCompare(b.start));
}
export function cycleStats(periods=[],settings={}) {
  const actual=normalizePeriods(periods);
  const fallback=Number.isInteger(+settings.cycleLength) && +settings.cycleLength>=15 && +settings.cycleLength<=90 ? +settings.cycleLength:28;
  const gaps=[];
  for(let i=1;i<actual.length;i++) {
    const gap=diffDays(actual[i-1].start,actual[i].start);
    if (gap>=15 && gap<=90) gaps.push(gap);
  }
  const relevant=gaps.slice(-6);
  const length=median(relevant)??fallback;
  const spread=relevant.length>=2?Math.max(...relevant)-Math.min(...relevant):null;
  return {actual,length,spread,observations:relevant.length,estimated:relevant.length<2};
}
/** Preserve an overdue predicted date; never silently treat an unlogged forecast as a real period. */
export function cycleStatus(periods=[],settings={},today) {
  const stats=cycleStats(periods,settings), last=stats.actual.at(-1);
  if(!last||!parseDate(today)) return {kind:'empty',...stats};
  const since=diffDays(last.start,today);
  const next=addDays(last.start,stats.length);
  const until=diffDays(today,next);
  if(since<0) return {kind:'future',next,...stats};
  return {kind:until<0?'late':'current',day:since+1,next,until,lateDays:Math.max(0,-until),...stats};
}
export function cyclePhase(periods,settings,today) {
  const s=cycleStatus(periods,settings,today);
  if(s.kind!=='current'||!s.actual.length) return 'unknown';
  const last=s.actual.at(-1); const day=diffDays(last.start,today)+1;
  if(day<=last.duration)return 'period';
  if(day>=Math.max(last.duration+1,s.length-6))return 'luteal';
  return 'other'; // Do not predict ovulation from cycle dates alone.
}
export function calendarMarks(periods,settings,day,today) {
  const s=cycleStatus(periods,settings,today), actual=s.actual;
  for(const p of actual) if(diffDays(p.start,day)>=0&&diffDays(p.start,day)<p.duration) return 'actual';
  // Only the immediately next predicted bleed; never manufacture subsequent cycles.
  const requestedDuration=Number(settings.duration);
  const forecastDuration=Number.isInteger(requestedDuration)&&requestedDuration>=1&&requestedDuration<=15?requestedDuration:5;
  if(s.next&&diffDays(s.next,day)>=0&&diffDays(s.next,day)<forecastDuration && diffDays(today,day)>=0) return 'forecast';
  return '';
}
/** Optional calendar-only illustration. Never use for contraception or fertility decisions. */
export function fertilityEstimate(periods=[],settings={},today) {
  const s=cycleStatus(periods,settings,today);
  if(s.actual.length<3 || s.observations<2) return {available:false,reason:'Für eine erste Schätzung mindestens drei tatsächliche Periodenstarts eintragen.'};
  if(s.spread!==null && s.spread>=7) return {available:false,reason:'Deine dokumentierten Zykluslängen schwanken deutlich. Luna zeigt deshalb keine konkreten fruchtbaren Tage an.'};
  if(s.kind!=='current') return {available:false,reason:'Aktuell ist keine sinnvolle Kalenderschätzung möglich. Trage einen neuen tatsächlichen Periodenbeginn ein.'};
  const last=s.actual.at(-1);
  const ovulation=addDays(last.start,s.length-14);
  if(!ovulation || diffDays(last.start,ovulation)<0) return {available:false,reason:'Keine Schätzung möglich.'};
  return {available:true,ovulation,start:addDays(ovulation,-5),end:ovulation,length:s.length,uncertain:true};
}
/** Astronomical approximation, not tied to health or the menstrual cycle. */
export function moonPhase(day) {
  const d=parseDate(day);if(!d)return {label:'Unbekannt',emoji:'🌙'};
  const knownNew=Date.UTC(2000,0,6,18,14), synodic=29.530588853;
  const age=((d.getTime()-knownNew)/86400000 % synodic + synodic)%synodic;
  const eight=Math.floor((age+synodic/16)/(synodic/8))%8;
  const labels=['Neumond','Zunehmende Sichel','Erstes Viertel','Zunehmender Mond','Vollmond','Abnehmender Mond','Letztes Viertel','Abnehmende Sichel'];
  const emojis=['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'];
  return {label:labels[eight],emoji:emojis[eight],age:Math.round(age*10)/10,approximate:true};
}
export function zodiac(day) {
  const d=parseDate(day); if(!d)return null;
  const md=(d.getUTCMonth()+1)*100+d.getUTCDate();
  const changeovers=[
    [120,'Wassermann'],[219,'Fische'],[321,'Widder'],[420,'Stier'],
    [521,'Zwillinge'],[621,'Krebs'],[723,'Löwe'],[823,'Jungfrau'],
    [923,'Waage'],[1023,'Skorpion'],[1122,'Schütze'],[1222,'Steinbock']
  ];
  let sign='Steinbock';
  for(const [cutoff,name] of changeovers) if(md>=cutoff)sign=name;else break;
  return sign;
}
