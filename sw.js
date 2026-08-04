/* 指数・対数アプリの Service Worker
   ねらいは2つだけ ——
     ・オフラインでも開けること
     ・オンラインのときは必ず最新が出ること
   なので、ページ本体は「ネットワーク優先・失敗したらキャッシュ」、
   アイコン等の変わらないものは「キャッシュ優先・裏で更新」にしている。 */

const VERSION = 'v26';                       // 中身を変えたらここを上げる
const CACHE   = 'explog-' + VERSION;

const SHELL = [
  './',
  './index.html',
  './koppen.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', e=>{
  e.waitUntil(
    caches.open(CACHE)
      /* 1つ失敗しただけで全部落とさない */
      .then(c=>Promise.all(SHELL.map(u=>c.add(u).catch(()=>{}))))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys()
      .then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;

  /* ページの表示はネットワーク優先。更新があればすぐ反映され、
     圏外ならキャッシュから開ける。 */
  if(req.mode === 'navigate'){
    e.respondWith(
      fetch(req)
        .then(res=>{
          const copy = res.clone();
          caches.open(CACHE).then(c=>c.put(req, copy)).catch(()=>{});
          return res;
        })
        .catch(()=>caches.match(req).then(r=>r || caches.match('./index.html')))
    );
    return;
  }

  /* それ以外はキャッシュを即返しつつ、裏で新しいものを取っておく */
  e.respondWith(
    caches.match(req).then(hit=>{
      const net = fetch(req).then(res=>{
        if(res && res.status===200 && res.type==='basic'){
          const copy = res.clone();
          caches.open(CACHE).then(c=>c.put(req, copy)).catch(()=>{});
        }
        return res;
      }).catch(()=>hit);
      return hit || net;
    })
  );
});
