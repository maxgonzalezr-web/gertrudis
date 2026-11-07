const CACHE_NAME = 'gertrudis-v9-single-shot';
const ASSETS = ['./','./index.html','./app.js','./manifest.webmanifest'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key))
  )).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if(event.request.method!=='GET') return;
  event.respondWith(caches.open(CACHE_NAME).then(async cache=>{
    const cached=await cache.match(event.request);
    if(cached) return cached;
    try {
      const response=await fetch(event.request);
      if(response.ok && new URL(event.request.url).origin===self.location.origin) cache.put(event.request,response.clone());
      return response;
    } catch(error) {
      return cached || Response.error();
    }
  }));
});