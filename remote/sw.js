// TempleGo 離線快取
// ⚠️ 新增或改名圖片時：把路徑加進 PRECACHE，並把 VERSION 加 1，遊客手機才會更新快取
const VERSION = "v41";
const CACHE = `templego-${VERSION}`;
const FONT_CACHE = "templego-fonts";

const PRECACHE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/style.css",
  "js/data.js",
  "js/app.js",
  "assets/img/guide-real-intro.webp",
  "assets/img/guide-real-default.webp",
  "assets/img/guide-real-wave.webp",
  "assets/img/guide-real-point.webp",
  "assets/img/guide-real-think.webp",
  "assets/img/guide-real-happy.webp",
  "assets/img/guide-real-fruit.webp",
  "assets/img/guide-q-default.svg",
  "assets/img/guide-q-wave.svg",
  "assets/img/guide-q-point.svg",
  "assets/img/guide-q-think.svg",
  "assets/img/guide-q-happy.svg",
  "assets/img/damaopu-overview.svg",
  "assets/img/qr-site.png",
  "assets/img/map.svg",
  "assets/photos/temple-front.webp",
  "assets/photos/front-steps.webp",
  "assets/photos/door-gods-photo.webp",
  "assets/photos/guowang-board.webp",
  "assets/photos/bijiao-front.webp",
  "assets/photos/bijiao-altar.webp",
  "assets/photos/longshen.webp",
  "assets/photos/plaza-end.webp",
  "assets/photos/sanchuan-back.webp",
  "assets/photos/main-hall-front.webp",
  "assets/photos/board-wide.webp",
  "assets/photos/main-hall-altar.webp",
  "assets/img/sanshan-scroll.svg",
  "assets/img/kaojiang-scroll.svg",
  "assets/img/plaza-scroll.svg",
  "assets/img/bijiao-scroll.svg",
  "assets/photos/main-hall-pano.webp",
  "assets/photos/courtyard-pano.webp",
  "assets/photos/plaza-pano.webp",
  "assets/photos/houyuan-pano.webp",
  "assets/photos/longshen-xiangwei.webp",
  "assets/photos/qushui.webp",
  "assets/photos/shanshui-ji.webp",
  "assets/photos/shihu.webp",
  "assets/photos/yaorenmao.webp",
  "assets/icons/icon-192.png",
  "assets/icons/favicon.png",
  "https://cdnjs.cloudflare.com/ajax/libs/pannellum/2.5.6/pannellum.css",
  "https://cdnjs.cloudflare.com/ajax/libs/pannellum/2.5.6/pannellum.js",
];

// 程式與文字：先抓網路最新版，4 秒抓不到就用快取（廟裡收訊差也不會卡住）
const NETWORK_FIRST = /\.(html|js|css|webmanifest)$|\/$/;

self.addEventListener("install", (e) => {
  // cache: "reload"：略過瀏覽器自己的暫存，確保存進來的是伺服器上的最新版
  const reqs = PRECACHE.map((u) => new Request(u, { cache: "reload" }));
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(reqs)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Google 字型：有快取就先用，背景再更新
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(staleWhileRevalidate(req, FONT_CACHE));
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && url.hostname !== "cdnjs.cloudflare.com") return;
  // 志永哥的影片、聲音交給瀏覽器自己處理（影片是分段下載，快取會出錯）
  if (/\.(webm|mp4|m4a|mp3|ogg)$/i.test(url.pathname)) return;

  if (sameOrigin && (req.mode === "navigate" || NETWORK_FIRST.test(url.pathname))) {
    e.respondWith(networkFirst(req));
  } else {
    e.respondWith(cacheFirst(req));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    // cache: "no-cache"：每次都跟伺服器確認是不是最新版（沒改過只回 304，很快）
    const res = await withTimeout(fetch(req, { cache: "no-cache" }), 4000);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req, { ignoreSearch: true }))
      || (req.mode === "navigate" ? cache.match("index.html") : Response.error());
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  const update = fetch(req).then((res) => {
    if (res.ok || res.type === "opaque") cache.put(req, res.clone());
    return res;
  }).catch(() => hit);
  return hit || update;
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (err) => { clearTimeout(t); reject(err); });
  });
}
