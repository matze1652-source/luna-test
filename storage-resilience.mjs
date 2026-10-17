/* Luna V18: optional, user-initiated browser storage persistence.
 * No health data is read, logged, uploaded, or sent to a server.
 * A persistent-storage grant reduces some eviction risks, but never replaces backups.
 */
const BACKUP_WARNING=' Ein zusätzliches verschlüsseltes Backup bleibt wichtig.';
const UNSUPPORTED='Dieser Browser bietet keinen überprüfbaren Speicherschutz. Lokale Daten können beim Löschen von Websitedaten oder durch den Browser verloren gehen.'+BACKUP_WARNING;

export async function inspectStorageProtection(browserNavigator) {
 const storage=browserNavigator?.storage;
 if(typeof storage?.persisted!=='function')return {code:'unsupported',message:UNSUPPORTED};
 try {
  const persistent=await storage.persisted();
  if(persistent===true)return {code:'protected',message:'Der Browser meldet geschützten lokalen Speicher. Manuelles Löschen von Websitedaten oder ein Geräteverlust bleiben möglich.'+BACKUP_WARNING};
  return {code:'unprotected',message:'Der Browser meldet keinen dauerhaften Speicherschutz. Lokale Luna-Daten können automatisch entfernt werden.'+BACKUP_WARNING};
 }catch {
  return {code:'error',message:'Der Speicherschutz konnte nicht überprüft werden.'+BACKUP_WARNING};
 }
}

export async function requestStorageProtection(browserNavigator) {
 const storage=browserNavigator?.storage;
 if(typeof storage?.persisted!=='function'||typeof storage?.persist!=='function')return {code:'unsupported',message:UNSUPPORTED};
 try {
  if(await storage.persisted()===true)return inspectStorageProtection(browserNavigator);
  // Only call this function in direct response to a user's explicit click.
  await storage.persist();
  // Trust the actual persisted() state, not the request return value.
  const result=await inspectStorageProtection(browserNavigator);
  if(result.code==='unprotected')return {code:'denied',message:'Der Browser hat keinen dauerhaften Speicherschutz aktiviert. Das ist keine Fehlfunktion von Luna.'+BACKUP_WARNING};
  return result;
 }catch {
  return {code:'error',message:'Die Anfrage für dauerhaften Speicherschutz ist fehlgeschlagen oder wurde abgelehnt.'+BACKUP_WARNING};
 }
}
