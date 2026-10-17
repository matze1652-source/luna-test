// Unterhaltungsinhalte: deterministische, selbst verfasste Tagesimpulse, keine Tatsachenprognosen.
const SIGNS={
 'Widder':'♈','Stier':'♉','Zwillinge':'♊','Krebs':'♋',
 'Löwe':'♌','Jungfrau':'♍','Waage':'♎','Skorpion':'♏',
 'Schütze':'♐','Steinbock':'♑','Wassermann':'♒','Fische':'♓'
};
const DAILY=[
 'Heute darfst du dir Zeit für die Dinge nehmen, die dir wirklich Freude machen.',
 'Ein kleiner Perspektivwechsel kann deinen Alltag heute leichter machen.',
 'Vertraue darauf, dass auch kleine Schritte wertvoll sind.',
 'Vielleicht ist heute ein guter Moment, jemandem etwas Nettes zu sagen.',
 'Du musst heute nicht alles schaffen. Achte auch auf deine Pausen.',
 'Ein offenes Gespräch kann neue Gedanken und schöne Begegnungen bringen.',
 'Heute darf Neugier wichtiger sein als Perfektion.',
 'Nimm dir bewusst einen Moment für das, was dich inspiriert.',
 'Manchmal tut es gut, etwas Vertrautes neu zu betrachten.',
 'Heute ist ein guter Tag, um dir selbst etwas Freundlichkeit zu schenken.',
 'Kleine kreative Ideen dürfen heute Raum bekommen.',
 'Dein Tempo ist in Ordnung – lass dich nicht hetzen.'
];
const LOVE=[
 'Ein ehrliches Wort kann Nähe schaffen.',
 'Zeige Wertschätzung für einen lieben Menschen.',
 'Vielleicht tut ein ruhiges Gespräch besonders gut.',
 'Ein kleiner Gruß kann Freude schenken.',
 'Achte darauf, was du selbst brauchst.',
 'Gemeinsame Zeit darf unkompliziert sein.'
];
const WORK=[
 'Beginne mit dem wichtigsten kleinen Schritt.',
 'Neue Ideen dürfen erst einmal wachsen.',
 'Ein kurzer Überblick bringt Struktur.',
 'Pausen können helfen, klarer zu denken.',
 'Heute lohnt es sich, Fragen zu stellen.',
 'Feiere auch die kleinen Fortschritte.'
];
const WELLBEING=[
 'Plane einen Moment Ruhe für dich ein.',
 'Ein kurzer Spaziergang kann eine schöne Auszeit sein.',
 'Mach etwas, das dir Freude bereitet.',
 'Du darfst Grenzen setzen und Pausen machen.',
 'Ein bisschen frische Luft kann guttun.',
 'Ein bewusstes Innehalten passt heute gut.'
];
function indexFor(date,sign,salt,length){
 const seed=String(date)+'|'+String(sign)+'|'+salt;
 let hash=2166136261;
 for(let i=0;i<seed.length;i++){hash=Math.imul(hash^seed.charCodeAt(i),16777619);}
 return (hash>>>0)%length;
}
export function dailyHoroscope(sign,date){
 if(!SIGNS[sign]||!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
 return {
  sign,symbol:SIGNS[sign],
  message:DAILY[indexFor(date,sign,'main',DAILY.length)],
  love:LOVE[indexFor(date,sign,'love',LOVE.length)],
  work:WORK[indexFor(date,sign,'work',WORK.length)],
  wellbeing:WELLBEING[indexFor(date,sign,'wellbeing',WELLBEING.length)]
 };
}
