/* Display-only premium pricing. Store billing is NOT implemented. */
export const PREMIUM_PRICES = Object.freeze({monthlyCents:699,yearlyCents:3499,trialDays:7});
export function premiumPriceSummary(prices=PREMIUM_PRICES){
 const {monthlyCents,yearlyCents,trialDays}=prices;
 if(![monthlyCents,yearlyCents,trialDays].every(Number.isSafeInteger)||monthlyCents<=0||yearlyCents<=0||trialDays<0)throw Error('Ungültige Premiumpreise.');
 const eur=cents=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(cents/100);
 return {monthly:eur(monthlyCents),yearly:eur(yearlyCents),monthlyEquivalent:eur(yearlyCents/12),savingPercent:Math.round((1-yearlyCents/(monthlyCents*12))*100),trialDays};
}
