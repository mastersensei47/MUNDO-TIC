// ============================================================================
// SERVICE-WORKER.JS — Habilita el modo PWA ("agregar a la pantalla de
// inicio"). Estrategia deliberadamente "red primero, caché como respaldo":
// mientras haya conexión, SIEMPRE se pide la versión más nueva a internet
// (nunca sirve algo viejo desde caché por accidente). El caché solo entra
// en juego si el celular está sin conexión. Esto es a propósito: este
// proyecto se actualiza seguido, y un caché "agresivo" terminaría mostrando
// código desactualizado — exactamente el tipo de bug que ya tuvimos una vez.
// ============================================================================

const CACHE_VERSION = "v1";
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

self.addEventListener("fetch", (event) => {
    // Solo GET: nunca interceptar escrituras a Firestore ni nada por el estilo.
    if (event.request.method !== "GET") return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)).catch(() => {});
                return response;
            })
            .catch(() => caches.match(event.request)) // sin conexión: usar lo último que quedó guardado
    );
});
