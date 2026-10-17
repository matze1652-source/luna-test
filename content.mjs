export const messages={
 period:[
  'Du darfst heute sanft mit dir sein. Ein langsamerer Tag kann genauso wertvoll sein. ♡',
  'Ein bisschen Wärme, eine kleine Pause und Zeit für dich – mehr braucht es manchmal nicht.',
  'Guten Morgen, du Liebe. Hör heute auf das, was dir guttut, ohne dich zu überfordern.'
 ],
 luteal:[
  'Heute darfst du Grenzen setzen und dir Raum zum Durchatmen geben. 🌷',
  'Was auch immer der Tag bringt: Du darfst Pausen machen und freundlich mit dir sprechen.',
  'Du musst nicht jeden Tag gleich viel Energie haben. Du bist trotzdem genug.'
 ],
 other:[
  'Guten Morgen! Vielleicht findest du heute einen kleinen Moment, der nur dir gehört. ✨',
  'Eine gute Sache für heute: Zeit für das einplanen, was dir Freude macht.',
  'Dein Tag, dein Tempo. Ich wünsche dir einen liebevollen Start. 🌸'
 ],
 unknown:[
  'Guten Morgen, du Liebe. Dein Wohlbefinden darf heute an erster Stelle stehen. ♡',
  'Heute ist ein neuer Tag für kleine schöne Momente. 🌷',
  'Du musst nicht perfekt sein. Ein freundlicher Gedanke an dich selbst reicht als Anfang.'
 ]
};
export function morningMessage(day,phase,mood){
  const lines=messages[phase]||messages.unknown;
  const code=[...day].reduce((n,c)=>n*31+c.charCodeAt(0),0);
  let result=lines[Math.abs(code)%lines.length];
  if(mood==='erschöpft')result+=' Und falls du müde bist: Ein ruhiger Start ist völlig okay.';
  if(mood==='gestresst')result+=' Vielleicht hilft dir heute ein Moment ohne Ablenkung.';
  return result;
}
export const wellness={
  'Krämpfe':{title:'Bei Unterleibskrämpfen',tips:['Eine Wärmflasche mit Hülle oder ein warmes Bad kann Krämpfe lindern.','Sanfte Bewegung oder leichte Dehnübungen sind einen Versuch wert.','Ibuprofen oder Naproxen können helfen, sind aber nicht für alle geeignet. Packungsbeilage beachten; bei Schwangerschaftsmöglichkeit, Magen-/Nierenproblemen, Blutverdünnern oder Unsicherheit Apotheke/Ärztin fragen. Schmerzmittel nicht auf eigene Faust kombinieren.']},
  'Kopfschmerzen':{title:'Bei Kopfschmerzen',tips:['Ausreichend trinken, wenn du Durst hast, und eine ruhige Umgebung ausprobieren.','Bei neuen, ungewöhnlich starken oder wiederkehrenden Kopfschmerzen ärztlichen Rat einholen.']},
  'Übelkeit':{title:'Bei Übelkeit',tips:['Kleine Schlucke Wasser und leichte Mahlzeiten können angenehmer sein.','Wenn Erbrechen anhält oder du kaum Flüssigkeit behalten kannst, medizinisch abklären lassen.']},
  'Stimmung':{title:'Wenn die Gefühle Achterbahn fahren',tips:['Nimm dein Gefühl ernst, ohne es allein deinem Zyklus zuzuschreiben.','Ein kurzer Spaziergang, Gespräch oder eine ruhige Pause kann guttun.','Wenn depressive Symptome stark sind oder lange anhalten, professionelle Hilfe in Anspruch nehmen.']},
  'Blutung':{title:'Bei stärkerer Blutung',tips:['Notiere ungefähre Stärke und Dauer für die ärztliche Besprechung.','Bei sehr starker Blutung, Schwindel oder Schwäche dringend medizinisch abklären lassen.']}
};
export const safety={urgent:'Bei plötzlich starken oder einseitigen Unterleibsschmerzen, Ohnmacht/Kreislaufproblemen oder starker Blutung mit Schwäche sofort medizinische Hilfe holen. Besonders wichtig, wenn eine Schwangerschaft möglich ist. Im Notfall 112.',soon:'Fieber, ungewöhnlicher Ausfluss, zunehmend starke Schmerzen, neue Beschwerden oder Schmerzen trotz üblicher Behandlung sollten ärztlich abgeklärt werden.'};
