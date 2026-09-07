// ============================================================================
// SERVICE-WORKER.JS — Habilita el modo PWA ("agregar a la pantalla de
// inicio"). Estrategia deliberadamente "red primero, caché como respaldo":
// mientras haya conexión, SIEMPRE se pide la versión más nueva a internet
// (nunca sirve algo viejo desde caché por accidente). El caché solo entra
// en juego si el celular está sin conexión. Esto es a propósito: este
// proyecto se actualiza seguido, y un caché "agresivo" terminaría mostrando
// código desactualizado — exactamente el tipo de bug que ya tuvimos una vez.
// ============================================================================

const CACHE_VERSION = "v7-store-init";
const CACHE_NAME = `plataforma-cache-${CACHE_VERSION}`;

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    // Navegación: red primero para no servir HTML viejo.
    if (event.request.mode === "navigate") {
        event.respondWith(
            fetch(event.request).then(response => {
                if (response && response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)).catch(() => {});
                }
                return response;
            }).catch(() => caches.match(event.request))
        );
        return;
    }

    // Recursos propios: caché primero + actualización en segundo plano.
    // Las visitas posteriores no tienen que esperar la red para CSS/JS/imágenes.
    event.respondWith(
        caches.match(event.request).then(cached => {
            const network = fetch(event.request).then(response => {
                if (response && response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)).catch(() => {});
                }
                return response;
            }).catch(() => cached);
            return cached || network;
        })
    );
});
