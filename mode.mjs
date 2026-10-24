/* V44: explicit, fail-closed separation of fictional plaintext testing and
 * password-protected local development. URL and HTML declaration must agree.
 * This is a storage-mode distinction, NOT an origin-level security boundary.
 */
export const LUNA_MODES=Object.freeze({TEST:'test',PROTECTED:'protected'});
export function resolveLunaMode(pathname,declaredMode,isNative=false){
 if(typeof pathname!=='string'||typeof declaredMode!=='string')throw Error('Luna-Betriebsmodus fehlt.');
 const page=pathname.slice(pathname.lastIndexOf('/')+1);
 // Capacitor must load index.html. Only an explicitly native runtime may
 // interpret that page as protected; browser index.html stays test-only.
 const expected=isNative&&(page===''||page==='index.html')?LUNA_MODES.PROTECTED
  :page===''||page==='index.html'?LUNA_MODES.TEST
  :page==='protected.html'?LUNA_MODES.PROTECTED:null;
 if(!expected||declaredMode!==expected)throw Error('Luna-Betriebsmodus stimmt nicht mit der Seite überein. Aus Sicherheitsgründen wurde der Start abgebrochen.');
 return expected;
}
