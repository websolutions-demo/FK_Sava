const CACHE='fk-sava-v6-1';
const SHELL=[
  './',
  './index.html',
  './admin.html',
  './site-manifest.webmanifest',
  './admin-manifest.webmanifest',
  './assets/css/style.css',
  './assets/css/admin.css',
  './assets/js/app.js',
  './assets/js/admin.js',
  './assets/js/data.js',
  './assets/images/logo.png',
  './assets/icons/favicon-32.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/pwa-192.png',
  './assets/icons/pwa-512.png',
  './assets/icons/pwa-maskable-192.png',
  './assets/icons/pwa-maskable-512.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin) return;

  // Always prefer fresh club data; cached copy is only an offline fallback.
  if(url.pathname.endsWith('/club-data.json')){
    event.respondWith(
      fetch(req).then(res=>{
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put(req,copy));
        return res;
      }).catch(()=>caches.match(req))
    );
    return;
  }

  // Navigation: network first, correct offline fallback for site or admin.
  if(req.mode==='navigate'){
    event.respondWith(
      fetch(req).catch(()=>{
        const admin=url.pathname.endsWith('/admin.html');
        return caches.match(admin?'./admin.html':'./index.html');
      })
    );
    return;
  }

  // Static assets: cache first, then refresh from network.
  event.respondWith(
    caches.match(req).then(cached=>cached||fetch(req).then(res=>{
      const copy=res.clone();
      caches.open(CACHE).then(c=>c.put(req,copy));
      return res;
    }))
  );
});
