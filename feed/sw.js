/* フィード版の Service Worker

   このファイルは /tiri/feed/index.html から登録するので、担当する範囲は
   /tiri/feed/ の中だけになる。親の /tiri/sw.js とは持ち場が分かれていて、
   ページはいちばん範囲の狭い登録に従うので、本編アプリの動きは変わらない。

   やることは本編と同じ2つ ——
     ・圏外でも開けること
     ・つながっているときは必ず最新が出ること */

const VERSION = 'v1';
const CACHE   = 'explog-feed-' + VERSION;

const SHELL = [
  './',
  './index.html',
  './data.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './icon-apple.png'
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
      /* 消すのは自分のぶんだけ。本編アプリのキャッシュには手を出さない。 */
      .then(ks=>Promise.all(
        ks.filter(k=>k.indexOf('explog-feed-')===0 && k!==CACHE).map(k=>caches.delete(k))
      ))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;

  /* ページはネットワーク優先。更新があればすぐ反映され、圏外ならキャッシュから開ける。 */
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

  /* 問題データやアイコンはキャッシュを即返しつつ、裏で新しいものを取っておく */
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
