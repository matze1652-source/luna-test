/* Cache only Luna's public static app shell. Never cache personal or dynamic data. */
const CACHE='luna-v39-passwordless-static-1';
const ASSETS=['./','./index.html','./testhinweise.html','./styles.css','./app.mjs','./cycle.mjs','./content.mjs','./locale.mjs','./insights.mjs','./backup.mjs','./vault.mjs','./reminder.mjs','./notification-status.mjs','./notification-preview.mjs','./local-notifications.mjs','./native-reminder-ui.mjs','./pricing.mjs','./privacy-lock.mjs','./demo-mode.mjs','./storage-resilience.mjs','./legacy-migration.mjs','./manifest.webmanifest','./assets/luna-icon.svg'];
const ALLOWED=new Set(ASSETS.map(path=>new URL(path,self.registration.scope).href));
// Precache only verified public responses. cache.addAll would store private responses unchecked.
function safeToCache(res,url){
 const directives=(res.headers?.get('cache-control')||'').toLowerCase();
 const privateResponse=/(?:^|,)\s*(?:private|no-store|no-cache)(?:\s*(?:,|$|=))/.test(directives);
 return res.ok&&res.type==='basic'&&!res.redirected&&res.url===url&&!privateResponse;
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 await Promise.all(ASSETS.map(async path=>{
  const url=new URL(path,self.registration.scope).href;
  try {const res=await fetch(url,{cache:'no-store'});if(safeToCache(res,url))await cache.put(url,res);}
  catch { /* A missing static file must not cause a private cache fallback. */ }
 }));
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('luna-v')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||!ALLOWED.has(req.url))return;
 event.respondWith(fetch(req).then(res=>{
  if(safeToCache(res,req.url)){
   const copy=res.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)));
  }
  return res;
 }).catch(()=>caches.match(req)));
});

