// Hors ligne : l'appli et les recettes restent disponibles en magasin sans réseau.
const VERSION='mwzjwtwb';
const CACHE='menus-'+VERSION;
const FILES=['./','./index.html','./js/moteur.js','./js/stockage.js','./js/app.js','./config.js','./recettes.json','./manifest.json','./icon-180.png','./icon-192.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  // Images des recettes : cache d'abord (rapide). Le reste : réseau d'abord, cache si pas de réseau.
  if(u.pathname.includes('/recettes/')){
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{const cl=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,cl));return resp})));
  }else{
    e.respondWith(fetch(e.request).then(resp=>{const cl=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,cl));return resp}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('./index.html'))));
  }
});
