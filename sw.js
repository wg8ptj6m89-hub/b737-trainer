'use strict';
// Offline-first shell. For updates, bump the cache name.
const CACHE='b737-trainer-shell-v16';
const ASSETS=['./','./index.html','./app.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('b737-trainer-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 if(new URL(event.request.url).origin!==self.location.origin)return;
 const url=new URL(event.request.url);
 const freshShell=event.request.mode==='navigate'||/\/(?:index\.html|app\.js)$/.test(url.pathname);
 if(freshShell){
  // Refresh HTML/JS online but keep a cached copy for fully offline operation.
  event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
   if(response.ok){
    const copy=response.clone();
    event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{}));
   }
   return response;
  }).catch(()=>caches.match(event.request,{ignoreSearch:true}).then(cached=>cached||Response.error())));
 }else{
  event.respondWith(caches.match(event.request,{ignoreSearch:true}).then(cached=>cached||fetch(event.request)));
 }
});