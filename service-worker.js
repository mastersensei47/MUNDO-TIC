const CACHE_VERSION = "v6-fast";
const CACHE_NAME = `plataforma-cache-${CACHE_VERSION}`;
const STATIC_ASSET_RE = /\.(?:css|js|png|jpg|jpeg|webp|svg|ico|json)$/i;

self.addEventListener("install", event => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k.startsWith("plataforma-cache-") && k !== CACHE_NAME).map(k => caches.delete(k))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener("message", event => {
    if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

async function fetchWithTimeout(request, ms = 2500) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try { return await fetch(request, { signal: controller.signal }); }
    finally { clearTimeout(timer); }
}

self.addEventListener("fetch", event => {
    if (event.request.method !== "GET") return;
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    if (STATIC_ASSET_RE.test(url.pathname)) {
        event.respondWith((async () => {
            const cached = await caches.match(event.request);
            const network = fetch(event.request).then(response => {
                if (response && response.ok) caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone())).catch(() => {});
                return response;
            }).catch(() => null);
            return cached || await network || new Response("", { status: 504 });
        })());
        return;
    }

    // Para HTML: intentamos red unos segundos para obtener cambios, pero
    // usamos el caché inmediatamente como respaldo si la red está lenta/offline.
    event.respondWith((async () => {
        const cached = await caches.match(event.request);
        try {
            const response = await fetchWithTimeout(event.request, 2500);
            if (response && response.ok) caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone())).catch(() => {});
            return response;
        } catch (_) {
            return cached || new Response("Sin conexión", { status: 503, statusText: "Offline" });
        }
    })());
});
