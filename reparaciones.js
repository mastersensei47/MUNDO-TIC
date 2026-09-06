// ============================================================================
// REPARACIONES.JS — Herramienta de control de trabajos/servicios (repuestos
// o materiales, costos, ganancias). Sirve para talleres de celulares, motos,
// autos, electrodomésticos, o cualquier otro rubro — el "rubro" elegido solo
// ajusta el vocabulario y el ícono; el motor de abajo es el mismo para
// todos, y los datos siempre se guardan con los mismos nombres de campo.
//
// Mismo patrón de conexión dinámica por slug que la tienda: primero resuelve
// el slug contra el proyecto master, después se conecta al proyecto de
// Firebase PROPIO de este negocio (100% aislado del resto).
// ============================================================================

let db, auth;
let masterApp, clienteApp;
let esAdmin = false;
let reparaciones = [];
let editandoId = null;

// ==================== RUBROS Y TEMAS ====================

const RUBRO_PRESETS = {
    pc_notebooks: { icono: "💻", nombre: "Servicio técnico de PC y notebooks", tituloApp: "Control de Servicio Técnico", campoObjeto: "Equipo", placeholderObjeto: "Ej: PC gamer, notebook Lenovo...", campoTrabajo: "Falla / trabajo realizado", accionNueva: "Nuevo servicio" },
    consolas: { icono: "🎮", nombre: "Reparación de consolas de videojuegos", tituloApp: "Control de Reparaciones", campoObjeto: "Consola", placeholderObjeto: "Ej: PS5, Xbox Series, Nintendo Switch...", campoTrabajo: "Falla / trabajo realizado", accionNueva: "Nueva reparación" },
    audio_tv: { icono: "📺", nombre: "Servicio técnico de audio y TV", tituloApp: "Control de Servicio Técnico", campoObjeto: "Equipo", placeholderObjeto: "Ej: Smart TV, parlante, equipo de audio...", campoTrabajo: "Falla / trabajo realizado", accionNueva: "Nuevo servicio" },
    bicicletas: { icono: "🚲", nombre: "Bicicleterías", tituloApp: "Control de Taller", campoObjeto: "Bicicleta", placeholderObjeto: "Ej: MTB rodado 29, bicicleta urbana...", campoTrabajo: "Trabajo realizado", accionNueva: "Nuevo trabajo" },
    electricos: { icono: "🛴", nombre: "Reparación de monopatines y vehículos eléctricos", tituloApp: "Control de Taller", campoObjeto: "Vehículo eléctrico", placeholderObjeto: "Ej: Monopatín Xiaomi, bici eléctrica...", campoTrabajo: "Falla / trabajo realizado", accionNueva: "Nuevo trabajo" },
    refrigeracion: { icono: "❄️", nombre: "Técnicos en refrigeración y aires acondicionados", tituloApp: "Control de Servicio Técnico", campoObjeto: "Equipo", placeholderObjeto: "Ej: Aire acondicionado, heladera, freezer...", campoTrabajo: "Falla / trabajo realizado", accionNueva: "Nuevo servicio" },
    herramientas: { icono: "🔧", nombre: "Reparación de herramientas eléctricas", tituloApp: "Control de Reparaciones", campoObjeto: "Herramienta", placeholderObjeto: "Ej: Taladro, amoladora, atornillador...", campoTrabajo: "Falla / trabajo realizado", accionNueva: "Nueva reparación" },
    jardineria: { icono: "🌿", nombre: "Mantenimiento de maquinaria de jardinería", tituloApp: "Control de Taller", campoObjeto: "Máquina", placeholderObjeto: "Ej: Cortadora, motosierra, bordeadora...", campoTrabajo: "Mantenimiento / trabajo realizado", accionNueva: "Nuevo trabajo" },
    zapateria: { icono: "👞", nombre: "Zapaterías y marroquinerías", tituloApp: "Control de Trabajos", campoObjeto: "Artículo", placeholderObjeto: "Ej: Zapatillas, botas, cartera, bolso...", campoTrabajo: "Arreglo / trabajo realizado", accionNueva: "Nuevo trabajo" },
    sastreria: { icono: "🧵", nombre: "Sastrerías y modistas", tituloApp: "Control de Trabajos", campoObjeto: "Prenda", placeholderObjeto: "Ej: Traje, vestido, pantalón...", campoTrabajo: "Arreglo / trabajo realizado", accionNueva: "Nuevo trabajo" },
    relojeria: { icono: "⌚", nombre: "Relojerías y joyerías", tituloApp: "Control de Trabajos", campoObjeto: "Artículo", placeholderObjeto: "Ej: Reloj, cadena, anillo, pulsera...", campoTrabajo: "Reparación / trabajo realizado", accionNueva: "Nuevo trabajo" },
    celulares: { icono: "📱", nombre: "Reparación de celulares y tablets", tituloApp: "Control de Reparaciones", campoObjeto: "Equipo", placeholderObjeto: "Ej: iPhone 11, Samsung A32, iPad...", campoTrabajo: "Problema / trabajo realizado", accionNueva: "Nueva reparación" },
    motos: { icono: "🏍️", nombre: "Mecánica de motos", tituloApp: "Control de Taller", campoObjeto: "Moto", placeholderObjeto: "Ej: Honda Wave 110 — patente ABC123", campoTrabajo: "Trabajo realizado", accionNueva: "Nuevo trabajo" },
    autos: { icono: "🚗", nombre: "Mecánica de autos", tituloApp: "Control de Taller", campoObjeto: "Vehículo", placeholderObjeto: "Ej: Fiat Cronos — patente AB123CD", campoTrabajo: "Trabajo realizado", accionNueva: "Nuevo trabajo" },
    electro: { icono: "🔌", nombre: "Reparación de electrodomésticos", tituloApp: "Control de Servicio Técnico", campoObjeto: "Artefacto", placeholderObjeto: "Ej: Heladera Whirlpool, lavarropas...", campoTrabajo: "Falla / trabajo realizado", accionNueva: "Nuevo servicio" },
    barberia: { icono: "💈", nombre: "Barbería", tituloApp: "Control de Servicios", campoObjeto: "Servicio", placeholderObjeto: "Ej: Corte, barba, corte + barba...", campoTrabajo: "Servicio realizado", accionNueva: "Nuevo servicio" },
    general: { icono: "🛠️", nombre: "General / personalizado", tituloApp: "Control de Trabajos", campoObjeto: "Ítem / Producto", placeholderObjeto: "Descripción del producto o trabajo", campoTrabajo: "Detalle del trabajo", accionNueva: "Nuevo trabajo" }
};

const RUBRO_LISTA = Object.entries(RUBRO_PRESETS).filter(([k]) => k !== 'general').map(([id, p]) => ({ id, ...p }));

const TEMA_DEFAULT = { bg: "#0f172a", card: "#1e293b", text: "#f1f5f9", accent: "#3b82f6", success: "#10b981", promo: "#f59e0b", danger: "#ef4444", radius: "18px" };

// Temas rápidos — mismo espíritu que los de la tienda, con un par pensados
// para talleres físicos (paleta "industrial" y "verde taller").
const TEMA_PRESETS = {
    oscuro: { bg: "#0f172a", card: "#1e293b", text: "#f1f5f9", accent: "#3b82f6", success: "#10b981", promo: "#f59e0b", danger: "#ef4444" },
    claro:  { bg: "#f1f5f9", card: "#ffffff", text: "#0f172a", accent: "#2563eb", success: "#059669", promo: "#d97706", danger: "#dc2626" },
    taller: { bg: "#1a1305", card: "#2b2008", text: "#fef3c7", accent: "#f59e0b", success: "#65a30d", promo: "#ea580c", danger: "#dc2626" },
    verde:  { bg: "#0a0f0a", card: "#131f13", text: "#e8f5e9", accent: "#22c55e", success: "#16a34a", promo: "#eab308", danger: "#ef4444" }
};

let TALLER_CONFIG = { rubro: "general", rubrosSeleccionados: ["general"], rubrosPersonalizados: [], nombreNegocio: "", logoUrl: "", theme: { ...TEMA_DEFAULT } };
let presetTemaTallerSeleccionado = null;
let deferredInstallPrompt = null;

function todosLosRubros() {
    return [...RUBRO_LISTA, ...(TALLER_CONFIG.rubrosPersonalizados || []).map(r => ({ ...r, personalizado: true }))];
}

function presetRubro() {
    const id = TALLER_CONFIG.rubro || (TALLER_CONFIG.rubrosSeleccionados || [])[0] || "general";
    return RUBRO_PRESETS[id] || (TALLER_CONFIG.rubrosPersonalizados || []).find(r => r.id === id) || RUBRO_PRESETS.general;
}

function rubrosActivos() {
    const ids = TALLER_CONFIG.rubrosSeleccionados && TALLER_CONFIG.rubrosSeleccionados.length
        ? TALLER_CONFIG.rubrosSeleccionados
        : [TALLER_CONFIG.rubro || 'general'];
    return ids.map(id => RUBRO_PRESETS[id] || (TALLER_CONFIG.rubrosPersonalizados || []).find(r => r.id === id)).filter(Boolean);
}

// Igual que el "conEl" de la tienda: aplica una función a un elemento SOLO
// si existe, para que un elemento faltante no rompa el resto en cadena.
function conElRep(id, fn) {
    const el = document.getElementById(id);
    if (el) fn(el);
}

function leerSlug() {
    return new URLSearchParams(location.search).get("slug");
}

function mostrarErrorSlug(mensaje) {
    const el = document.getElementById("slugError");
    if (el) {
        el.querySelector("p").innerText = mensaje;
        el.style.display = "flex";
    }
}

async function bootstrap() {
    const slug = leerSlug();
    if (!slug) return mostrarErrorSlug("Falta indicar el negocio en el link (falta ?slug=... en la URL).");

    try {
        masterApp = firebase.initializeApp(MASTER_FIREBASE_CONFIG, "master");
        const masterDb = firebase.firestore(masterApp);
        const clienteDoc = await masterDb.collection("clientes").doc(slug).get();

        if (!clienteDoc.exists || clienteDoc.data().activo === false) {
            return mostrarErrorSlug("No encontramos este negocio. Verificá el link.");
        }
        const { firebaseConfig, storeName } = clienteDoc.data();
        if (!firebaseConfig || !firebaseConfig.projectId) {
            return mostrarErrorSlug("Este negocio todavía no está configurado del todo.");
        }

        clienteApp = firebase.initializeApp(firebaseConfig, "cliente");
        db = firebase.firestore(clienteApp);
        auth = firebase.auth(clienteApp);

        // Configuración propia de este negocio (rubro, nombre, tema, logo).
        // Lectura pública a propósito (igual que config/tienda en la
        // tienda): así la pantalla de login ya se ve con la marca correcta
        // antes de que el dueño inicie sesión.
        let datosTaller = {};
        try {
            const cfgDoc = await db.collection("config").doc("taller").get();
            if (cfgDoc.exists) datosTaller = cfgDoc.data();
        } catch (e) {
            console.warn("No se pudo leer config/taller, se usan valores por defecto:", e);
        }

        const rubroLegacy = datosTaller.rubro || "general";
        const seleccionados = Array.isArray(datosTaller.rubrosSeleccionados) && datosTaller.rubrosSeleccionados.length
            ? datosTaller.rubrosSeleccionados
            : [rubroLegacy];
        TALLER_CONFIG = {
            rubro: rubroLegacy,
            rubrosSeleccionados: seleccionados,
            rubrosPersonalizados: Array.isArray(datosTaller.rubrosPersonalizados) ? datosTaller.rubrosPersonalizados : [],
            nombreNegocio: datosTaller.nombreNegocio || storeName || "Mi negocio",
            logoUrl: datosTaller.logoUrl || "",
            theme: { ...TEMA_DEFAULT, ...(datosTaller.theme || {}) }
        };

        const pasos = [
            ["aplicarTemaTaller", aplicarTemaTaller],
            ["aplicarTextosRubro", aplicarTextosRubro],
            ["generarManifestDinamico", generarManifestDinamico],
            ["registrarServiceWorker", registrarServiceWorker],
            ["prepararInstalacionPWA", prepararInstalacionPWA],
        ];
        pasos.forEach(([nombre, fn]) => {
            try { fn(); } catch (e) { console.error(`bootstrap(): falló ${nombre}()`, e); }
        });

        init();
    } catch (e) {
        console.error("Error al inicializar:", e);
        mostrarErrorSlug("No pudimos cargar esta herramienta. Probá de nuevo en unos minutos.");
    }
}

function aplicarTemaTaller() {
    const root = document.documentElement;
    Object.entries(TALLER_CONFIG.theme || {}).forEach(([k, v]) => root.style.setProperty(`--${k}`, v));
}

// Ajusta todos los textos/labels según el rubro elegido y muestra el
// logo (o el ícono del rubro como respaldo si no hay logo cargado).
function aplicarTextosRubro() {
    const p = presetRubro();
    document.title = TALLER_CONFIG.nombreNegocio + " — " + p.tituloApp;

    conElRep("loginTitulo", el => el.innerText = `${p.icono} ${p.tituloApp}`);
    const activos = rubrosActivos();
    conElRep("tallerSubtitulo", el => el.innerText = activos.length > 1 ? `${p.tituloApp} · ${activos.length} rubros` : p.tituloApp);
    conElRep("tallerNombre", el => el.innerText = TALLER_CONFIG.nombreNegocio);
    conElRep("rubrosActivosTexto", el => el.innerText = activos.map(r => `${r.icono} ${r.nombre || r.tituloApp}`).join(" · "));

    conElRep("lblCampoObjeto", el => el.innerText = p.campoObjeto);
    conElRep("rEquipo", el => el.placeholder = p.placeholderObjeto);
    conElRep("lblCampoTrabajo", el => el.innerText = p.campoTrabajo);
    conElRep("btnNuevo", el => el.innerText = "+ " + p.accionNueva.toUpperCase());
    conElRep("buscador", el => el.placeholder = `Buscar por cliente o ${p.campoObjeto.toLowerCase()}...`);

    const tieneLogo = !!TALLER_CONFIG.logoUrl;
    conElRep("tallerLogoImg", el => { el.style.display = tieneLogo ? "block" : "none"; if (tieneLogo) el.src = TALLER_CONFIG.logoUrl; });
    conElRep("tallerIconoRubro", el => { el.style.display = tieneLogo ? "none" : "flex"; el.innerText = p.icono; });
}

// Mismo patrón que la tienda: un manifest.json por negocio, generado al
// vuelo (no puede ser un archivo estático distinto por cliente).
function generarManifestDinamico() {
    try {
        const p = presetRubro();
        const manifest = {
            id: `${location.origin}${location.pathname}${location.search}`,
            name: TALLER_CONFIG.nombreNegocio + " — Control de Trabajos",
            short_name: (TALLER_CONFIG.nombreNegocio || "Taller").slice(0, 20),
            start_url: `${location.origin}${location.pathname}${location.search}`,
            scope: `${location.origin}${location.pathname}`,
            display: "standalone",
            orientation: "portrait-primary",
            background_color: TALLER_CONFIG.theme.bg || "#0f172a",
            theme_color: TALLER_CONFIG.theme.accent || "#3b82f6",
            icons: [
                { src: TALLER_CONFIG.logoUrl || "log.png", sizes: "192x192", type: "image/png", purpose: "any" },
                { src: TALLER_CONFIG.logoUrl || "log.png", sizes: "512x512", type: "image/png", purpose: "any" }
            ]
        };
        const url = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: "application/json" }));
        let link = document.querySelector('link[rel="manifest"]');
        if (!link) { link = document.createElement("link"); link.rel = "manifest"; document.head.appendChild(link); }
        link.href = url;

        let meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) { meta = document.createElement("meta"); meta.name = "theme-color"; document.head.appendChild(meta); }
        meta.content = TALLER_CONFIG.theme.accent || "#3b82f6";
    } catch (e) {
        console.warn("No se pudo generar el manifest:", e);
    }
}

function registrarServiceWorker() {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("service-worker.js").catch(e => console.warn("Service worker no registrado:", e));
    }
}

function prepararInstalacionPWA() {
    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        conElRep("btnInstalarApp", el => el.style.display = "inline-flex");
    });
    window.addEventListener("appinstalled", () => {
        deferredInstallPrompt = null;
        conElRep("btnInstalarApp", el => el.style.display = "none");
        alert("✅ La app quedó instalada en tu dispositivo.");
    });
    const esStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (esStandalone) conElRep("btnInstalarApp", el => el.style.display = "none");
}

async function instalarApp() {
    if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        conElRep("btnInstalarApp", el => el.style.display = "none");
        return;
    }
    alert("En Android/Chrome: abrí el menú del navegador y elegí 'Instalar aplicación' o 'Agregar a pantalla de inicio'. En iPhone/iPad: Safari → Compartir → 'Agregar a pantalla de inicio'.");
}

function init() {
    auth.onAuthStateChanged(async (user) => {
        esAdmin = false;
        if (!user) { mostrarLoginNormal(); return; }
        try {
            const adminDoc = await db.collection("admins").doc(user.uid).get();
            if (adminDoc.exists) {
                esAdmin = true;
                mostrarApp();
                cargarReparaciones();
                cargarFormConfigTaller();
            } else {
                const emailUsado = user.email;
                await auth.signOut();
                alert(
                    `Iniciaste sesión con "${emailUsado}" correctamente, pero esa cuenta no está autorizada como administrador de este negocio.\n\n` +
                    `Revisá en Firestore → config/setup → allowedAdminEmail que sea EXACTAMENTE ese mismo email (mayúsculas, espacios y todo tienen que coincidir).\n\n` +
                    `Si nunca hiciste "¿Primera vez? Configurar acceso" con este email, hacelo ahora.`
                );
                mostrarLoginNormal();
            }
        } catch (e) {
            console.error(e);
            alert("No pudimos verificar tu cuenta de administrador. Código de error: " + (e.code || e.message || e) + "\n\nProbá de nuevo en un momento, o revisá que las reglas de Firestore (firestore.reparaciones.rules) estén publicadas en este proyecto.");
            mostrarLoginNormal();
        }
    });
}

// ==================== LOGIN / PRIMER INGRESO (sin cambios de fondo) ====================

function mostrarLoginNormal() {
    document.getElementById("appScreen").style.display = "none";
    document.getElementById("loginScreen").style.display = "flex";
    document.getElementById("loginPaso").style.display = "block";
    document.getElementById("setupPaso1").style.display = "none";
    document.getElementById("setupPaso2").style.display = "none";
}

function mostrarSetup() {
    document.getElementById("loginPaso").style.display = "none";
    document.getElementById("setupPaso1").style.display = "block";
}

function mostrarApp() {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("appScreen").style.display = "block";
}

async function doLogin() {
    const email = document.getElementById("uInp").value.trim().toLowerCase();
    const pass = document.getElementById("pInp").value.trim();
    if (!email || !pass) return alert("Completá email y contraseña");
    try {
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (e) {
        console.error(e);
        if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
            alert("Email o contraseña incorrectos.");
        } else if (e.code === 'auth/too-many-requests') {
            alert("Demasiados intentos fallidos. Esperá unos minutos y probá de nuevo.");
        } else {
            alert("No pudimos iniciar sesión. Código de error: " + (e.code || e.message || e));
        }
    }
}

function logout() {
    if (confirm("¿Cerrar sesión?")) auth.signOut();
}

async function crearCuentaAdmin() {
    const email = document.getElementById("setupEmail").value.trim().toLowerCase();
    const pass = document.getElementById("setupPass").value.trim();
    if (!email.includes("@")) return alert("Ingresá un email válido");
    if (pass.length < 6) return alert("La contraseña debe tener al menos 6 caracteres");
    try {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        await cred.user.sendEmailVerification();
        document.getElementById("setupPaso1").style.display = "none";
        document.getElementById("setupPaso2").style.display = "block";
    } catch (e) {
        console.error(e);
        if (e.code === 'auth/email-already-in-use') alert("Ya existe una cuenta con ese email. Iniciá sesión normalmente.");
        else alert("No pudimos crear la cuenta: " + (e.message || e));
    }
}

async function confirmarAdminVerificado() {
    if (!auth.currentUser) return alert("Se cerró la sesión. Volvé a intentar desde 'Configurar acceso'.");
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    if (!auth.currentUser.emailVerified) {
        return alert("Todavía no verificaste tu email. Revisá tu bandeja de entrada (y spam).");
    }
    try {
        await db.collection("admins").doc(auth.currentUser.uid).set({
            email: auth.currentUser.email, creado: Date.now()
        });
        alert("✅ ¡Listo! Ya tenés acceso. La página se va a recargar para entrar.");
        location.reload();
    } catch (e) {
        console.error(e);
        alert("Ese email (" + auth.currentUser.email + ") no está autorizado. Verificá que sea EXACTAMENTE igual al campo allowedAdminEmail en config/setup de este proyecto (mayúsculas/espacios incluidos).");
    }
}

// ==================== CONFIGURACIÓN DEL NEGOCIO (rubro, nombre, tema, logo) ====================

function abrirConfigTaller() {
    cargarFormConfigTaller();
    document.getElementById("configModal").style.display = "flex";
}

function cerrarConfigTaller() {
    document.getElementById("configModal").style.display = "none";
}

function cargarFormConfigTaller() {
    const el = document.getElementById("cfgNombreNegocio");
    if (!el) return;
    el.value = TALLER_CONFIG.nombreNegocio || "";
    renderSelectorRubros();
    document.getElementById("cfgLogoUrl").value = TALLER_CONFIG.logoUrl || "";
    document.getElementById("cfgTemaPreset").value = "";
    document.getElementById("cfgAccentTaller").value = TALLER_CONFIG.theme.accent || "#3b82f6";
    document.getElementById("cfgBgTaller").value = TALLER_CONFIG.theme.bg || "#0f172a";
    presetTemaTallerSeleccionado = null;
    renderRubrosPersonalizados();
}

function renderSelectorRubros() {
    const cont = document.getElementById("selectorRubros");
    if (!cont) return;
    const activos = new Set(TALLER_CONFIG.rubrosSeleccionados || [TALLER_CONFIG.rubro || "general"]);
    cont.innerHTML = todosLosRubros().map(r => `
        <label class="rubro-check">
            <input type="checkbox" value="${r.id}" ${activos.has(r.id) ? "checked" : ""} onchange="actualizarRubrosSeleccionados()">
            <span>${r.icono} ${r.nombre}</span>
        </label>`).join('');
    const generalActivo = activos.has('general');
    if (generalActivo && activos.size > 1) {
        const cb = cont.querySelector('input[value="general"]');
        if (cb) cb.checked = false;
    }
}

function actualizarRubrosSeleccionados() {
    const cont = document.getElementById("selectorRubros");
    if (!cont) return;
    let ids = [...cont.querySelectorAll('input[type="checkbox"]:checked')].map(x => x.value);
    if (!ids.length) {
        ids = ["general"];
        const cb = cont.querySelector('input[value="general"]');
        if (cb) cb.checked = true;
    }
    if (ids.length > 1 && ids.includes('general')) {
        ids = ids.filter(x => x !== 'general');
        const cb = cont.querySelector('input[value="general"]');
        if (cb) cb.checked = false;
    }
    TALLER_CONFIG.rubrosSeleccionados = ids;
    TALLER_CONFIG.rubro = ids[0];
    aplicarTextosRubro();
    renderRubrosActivosPreview();
}

function renderRubrosActivosPreview() {
    const cont = document.getElementById("rubrosActivosPreview");
    if (!cont) return;
    const activos = rubrosActivos();
    cont.innerHTML = activos.map(r => `<span class="rubro-chip">${r.icono} ${r.nombre}</span>`).join('');
}

function crearRubroPersonalizado() {
    const nombre = (document.getElementById("nuevoRubroNombre")?.value || '').trim();
    const icono = (document.getElementById("nuevoRubroIcono")?.value || '🛠️').trim() || '🛠️';
    const campoObjeto = (document.getElementById("nuevoRubroObjeto")?.value || 'Ítem / Producto').trim() || 'Ítem / Producto';
    const campoTrabajo = (document.getElementById("nuevoRubroTrabajo")?.value || 'Detalle del trabajo').trim() || 'Detalle del trabajo';
    if (!nombre) return alert('Poné un nombre para el rubro.');
    const id = 'custom_' + Date.now();
    TALLER_CONFIG.rubrosPersonalizados.push({ id, nombre, icono, tituloApp: 'Control de Trabajos', campoObjeto, placeholderObjeto: `Ej: ${campoObjeto.toLowerCase()}...`, campoTrabajo, accionNueva: 'Nuevo trabajo' });
    TALLER_CONFIG.rubrosSeleccionados = [...new Set([...(TALLER_CONFIG.rubrosSeleccionados || []), id])].filter(x => x !== 'general');
    TALLER_CONFIG.rubro = TALLER_CONFIG.rubrosSeleccionados[0] || id;
    ['nuevoRubroNombre','nuevoRubroIcono','nuevoRubroObjeto','nuevoRubroTrabajo'].forEach(id2 => { const x=document.getElementById(id2); if(x) x.value=''; });
    renderSelectorRubros();
    renderRubrosPersonalizados();
    renderRubrosActivosPreview();
    aplicarTextosRubro();
}

function eliminarRubroPersonalizado(id) {
    if (!confirm('¿Eliminar este rubro personalizado? Los trabajos ya guardados no se borran.')) return;
    TALLER_CONFIG.rubrosPersonalizados = (TALLER_CONFIG.rubrosPersonalizados || []).filter(r => r.id !== id);
    TALLER_CONFIG.rubrosSeleccionados = (TALLER_CONFIG.rubrosSeleccionados || []).filter(x => x !== id);
    if (!TALLER_CONFIG.rubrosSeleccionados.length) TALLER_CONFIG.rubrosSeleccionados = ['general'];
    TALLER_CONFIG.rubro = TALLER_CONFIG.rubrosSeleccionados[0];
    renderSelectorRubros(); renderRubrosPersonalizados(); renderRubrosActivosPreview(); aplicarTextosRubro();
}

function editarRubroPersonalizado(id) {
    const r = (TALLER_CONFIG.rubrosPersonalizados || []).find(x => x.id === id);
    if (!r) return;
    const nombre = prompt('Nombre del rubro:', r.nombre);
    if (nombre === null) return;
    const icono = prompt('Ícono/emoji:', r.icono) || r.icono;
    const campoObjeto = prompt('Nombre del objeto/equipo:', r.campoObjeto) || r.campoObjeto;
    const campoTrabajo = prompt('Nombre del trabajo/servicio:', r.campoTrabajo) || r.campoTrabajo;
    r.nombre = nombre.trim() || r.nombre; r.icono = icono.trim() || r.icono; r.campoObjeto = campoObjeto.trim() || r.campoObjeto; r.campoTrabajo = campoTrabajo.trim() || r.campoTrabajo;
    r.placeholderObjeto = `Ej: ${r.campoObjeto.toLowerCase()}...`;
    renderSelectorRubros(); renderRubrosPersonalizados(); renderRubrosActivosPreview(); aplicarTextosRubro();
}

function renderRubrosPersonalizados() {
    const cont = document.getElementById("rubrosPersonalizadosLista");
    if (!cont) return;
    const arr = TALLER_CONFIG.rubrosPersonalizados || [];
    cont.innerHTML = arr.length ? arr.map(r => `<div class="custom-rubro-row"><span>${r.icono} <b>${r.nombre}</b><small>${r.campoObjeto} · ${r.campoTrabajo}</small></span><span><button type="button" onclick="editarRubroPersonalizado('${r.id}')">✏️</button><button type="button" onclick="eliminarRubroPersonalizado('${r.id}')">🗑️</button></span></div>`).join('') : '<small style="opacity:.5;">Todavía no agregaste rubros personalizados.</small>';
}

// Vista previa en vivo: se ve el cambio al toque, pero queda guardado recién al tocar GUARDAR.
function previsualizarColorTaller(variableCSS, valor) {
    document.documentElement.style.setProperty(variableCSS, valor);
}

function aplicarPresetTemaTaller() {
    const key = document.getElementById("cfgTemaPreset").value;
    if (!key || !TEMA_PRESETS[key]) { presetTemaTallerSeleccionado = null; return; }
    presetTemaTallerSeleccionado = TEMA_PRESETS[key];
    document.getElementById("cfgAccentTaller").value = presetTemaTallerSeleccionado.accent;
    document.getElementById("cfgBgTaller").value = presetTemaTallerSeleccionado.bg;
    Object.entries(presetTemaTallerSeleccionado).forEach(([k, v]) => previsualizarColorTaller(`--${k}`, v));
}

async function guardarConfigTaller() {
    const nombreNegocio = document.getElementById("cfgNombreNegocio").value.trim() || TALLER_CONFIG.nombreNegocio;
    const rubrosSeleccionados = (TALLER_CONFIG.rubrosSeleccionados || []).length ? TALLER_CONFIG.rubrosSeleccionados : ["general"];
    const rubro = rubrosSeleccionados[0];
    const logoUrl = document.getElementById("cfgLogoUrl").value.trim();
    const themeBase = presetTemaTallerSeleccionado || TALLER_CONFIG.theme;
    const theme = { ...themeBase, accent: document.getElementById("cfgAccentTaller").value, bg: document.getElementById("cfgBgTaller").value };
    const datos = { nombreNegocio, rubro, rubrosSeleccionados, rubrosPersonalizados: TALLER_CONFIG.rubrosPersonalizados || [], logoUrl, theme };
    try {
        await db.collection("config").doc("taller").set(datos, { merge: true });
        TALLER_CONFIG = { ...TALLER_CONFIG, ...datos };
        presetTemaTallerSeleccionado = null;
        aplicarTemaTaller(); aplicarTextosRubro(); renderLista();
        generarManifestDinamico();
        alert("✅ Configuración guardada");
        cerrarConfigTaller();
    } catch (e) { console.error(e); alert("Error al guardar: " + (e.message || e)); }
}

// ==================== REPARACIONES/TRABAJOS: CARGA Y CÁLCULOS ====================

function cargarReparaciones() {
    db.collection("reparaciones").orderBy("fechaIngreso", "desc").onSnapshot(snap => {
        reparaciones = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderStats();
        renderLista();
    }, err => console.warn("reparaciones:", err.code));
}

function calcularCostosGanancia(repuestos, manoDeObra, precioCobrado) {
    const costoRepuestos = (repuestos || []).reduce((acc, r) => acc + (Number(r.costo) || 0), 0);
    const costoTotal = costoRepuestos + (Number(manoDeObra) || 0);
    const ganancia = (Number(precioCobrado) || 0) - costoTotal;
    return { costoTotal, ganancia };
}

function parsearRepuestos(texto) {
    if (!texto || !texto.trim()) return [];
    return texto.trim().split('\n').map(linea => {
        const [nombre, costoStr] = linea.split('|').map(s => (s || '').trim());
        return nombre ? { nombre, costo: parseFloat(costoStr) || 0 } : null;
    }).filter(Boolean);
}

function normalizarTextoRep(s) {
    return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const ESTADOS = {
    pendiente:      { label: "Pendiente",           color: "var(--danger)" },
    en_reparacion:  { label: "En proceso",          color: "var(--promo)" },
    listo:          { label: "Listo para retirar",  color: "var(--accent)" },
    entregado:      { label: "Entregado",           color: "var(--success)" }
};

function renderStats() {
    const ahora = new Date();
    let gananciaTotal = 0, pendientes = 0, delMes = 0, gananciaMes = 0, urgentes = 0;

    reparaciones.forEach(r => {
        gananciaTotal += (r.ganancia || 0);
        if (r.estado === 'pendiente' || r.estado === 'en_reparacion') pendientes++;
        if (r.prioridad === 'urgente' && r.estado !== 'entregado') urgentes++;
        const f = new Date(r.fechaIngreso);
        if (f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear()) {
            delMes++;
            gananciaMes += (r.ganancia || 0);
        }
    });

    conElRep("statGanancia", el => el.innerText = "$" + gananciaTotal.toFixed(0));
    conElRep("statPendientes", el => el.innerText = pendientes);
    conElRep("statMes", el => el.innerText = delMes);
    conElRep("statGananciaMes", el => el.innerText = "$" + gananciaMes.toFixed(0));
    conElRep("statUrgentes", el => el.innerText = urgentes);
}

function renderLista() {
    const buscadorEl = document.getElementById("buscador");
    const filtroEl = document.getElementById("filtroEstado");
    if (!buscadorEl || !filtroEl) return;
    const q = normalizarTextoRep(buscadorEl.value);
    const filtroEstado = filtroEl.value;
    const p = presetRubro();

    let filtradas = reparaciones;
    if (filtroEstado) filtradas = filtradas.filter(r => r.estado === filtroEstado);
    if (q) filtradas = filtradas.filter(r =>
        normalizarTextoRep(r.cliente).includes(q) || normalizarTextoRep(r.equipo).includes(q)
    );

    const cont = document.getElementById("listaReparaciones");
    if (filtradas.length === 0) {
        cont.innerHTML = `<div class="taller-card" style="text-align:center; padding:40px 20px; opacity:0.5;"><div style="font-size:40px; margin-bottom:12px;">${p.icono}</div>No hay ${reparaciones.length === 0 ? 'nada cargado todavía' : 'resultados para mostrar'}.</div>`;
        return;
    }

    cont.innerHTML = filtradas.map(r => {
        const estadoInfo = ESTADOS[r.estado] || ESTADOS.pendiente;
        const fecha = r.fechaIngreso ? new Date(r.fechaIngreso).toLocaleDateString('es-ES') : '';
        const esUrgente = r.prioridad === 'urgente';
        return `
        <div class="taller-card rep-card" style="border-left-color:${estadoInfo.color};">
            <div class="flex-between" style="align-items:flex-start;">
                <div>
                    ${esUrgente ? '<span class="urgente-badge">🔥 URGENTE</span><br>' : ''}
                    <b style="font-size:16px;">${r.cliente || 'Sin nombre'}</b>
                    <span class="estado-pill" style="background:${estadoInfo.color}; color:#fff; margin-left:8px;">${estadoInfo.label}</span>
                    <div style="opacity:0.7; font-size:14px; margin-top:4px;">${p.icono} ${r.equipo || ''}</div>
                    <div style="opacity:0.5; font-size:12px; margin-top:2px;">
                        ${fecha}${r.telefono ? ' · ' + r.telefono : ''}${r.fechaEstimada ? ' · Entrega est.: ' + new Date(r.fechaEstimada + 'T00:00:00').toLocaleDateString('es-ES') : ''}
                    </div>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:800; color:var(--success);">$${(r.ganancia || 0).toFixed(0)}</div>
                    <small style="opacity:0.5;">ganancia</small>
                </div>
            </div>
            ${r.problema ? `<div style="margin-top:10px; font-size:13px; opacity:0.8;">${r.problema}</div>` : ''}
            ${r.garantiaDias ? `<div style="margin-top:8px; font-size:11px; opacity:0.55;">🛡️ Garantía: ${r.garantiaDias} días</div>` : ''}
            <div style="display:flex; gap:8px; margin-top:12px;">
                <button onclick="editarReparacion('${r.id}')" style="flex:1; background:rgba(255,255,255,0.06); border:none; color:var(--text); padding:10px; border-radius:10px; cursor:pointer; font-weight:700;">✏️ Editar</button>
                <button onclick="borrarReparacion('${r.id}')" style="background:none; border:none; color:var(--danger); padding:10px; cursor:pointer;">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

// ==================== FORMULARIO (alta / edición) ====================

function abrirFormNuevo() {
    editandoId = null;
    document.getElementById("formTitulo").innerText = presetRubro().accionNueva;
    document.getElementById("rId").value = "";
    document.getElementById("rCliente").value = "";
    document.getElementById("rTelefono").value = "";
    document.getElementById("rEquipo").value = "";
    document.getElementById("rProblema").value = "";
    document.getElementById("rRepuestos").value = "";
    document.getElementById("rManoObra").value = "";
    document.getElementById("rPrecio").value = "";
    document.getElementById("rEstado").value = "pendiente";
    document.getElementById("rPrioridad").value = "normal";
    document.getElementById("rFechaEstimada").value = "";
    document.getElementById("rGarantiaDias").value = "";
    document.getElementById("rNotas").value = "";
    actualizarGananciaPreview();
    document.getElementById("formModal").style.display = "flex";
}

function editarReparacion(id) {
    const r = reparaciones.find(x => x.id === id);
    if (!r) return;
    editandoId = id;
    document.getElementById("formTitulo").innerText = "Editar " + presetRubro().accionNueva.replace(/^Nuev[oa] /i, '');
    document.getElementById("rId").value = r.id;
    document.getElementById("rCliente").value = r.cliente || "";
    document.getElementById("rTelefono").value = r.telefono || "";
    document.getElementById("rEquipo").value = r.equipo || "";
    document.getElementById("rProblema").value = r.problema || "";
    document.getElementById("rRepuestos").value = (r.repuestos || []).map(x => `${x.nombre} | ${x.costo}`).join('\n');
    document.getElementById("rManoObra").value = r.manoDeObra || "";
    document.getElementById("rPrecio").value = r.precioCobrado || "";
    document.getElementById("rEstado").value = r.estado || "pendiente";
    document.getElementById("rPrioridad").value = r.prioridad || "normal";
    document.getElementById("rFechaEstimada").value = r.fechaEstimada || "";
    document.getElementById("rGarantiaDias").value = r.garantiaDias || "";
    document.getElementById("rNotas").value = r.notas || "";
    actualizarGananciaPreview();
    document.getElementById("formModal").style.display = "flex";
}

function cerrarFormModal() {
    document.getElementById("formModal").style.display = "none";
    editandoId = null;
}

function actualizarGananciaPreview() {
    const repuestos = parsearRepuestos(document.getElementById("rRepuestos").value);
    const manoDeObra = document.getElementById("rManoObra").value;
    const precio = document.getElementById("rPrecio").value;
    const { costoTotal, ganancia } = calcularCostosGanancia(repuestos, manoDeObra, precio);
    document.getElementById("rGananciaPreview").innerText =
        `Costo total: $${costoTotal.toFixed(0)} — Ganancia estimada: $${ganancia.toFixed(0)}`;
}

async function guardarReparacion() {
    const cliente = document.getElementById("rCliente").value.trim();
    const equipo = document.getElementById("rEquipo").value.trim();
    if (!cliente || !equipo) return alert(`Completá al menos el cliente y ${presetRubro().campoObjeto.toLowerCase()}`);

    const repuestos = parsearRepuestos(document.getElementById("rRepuestos").value);
    const manoDeObra = parseFloat(document.getElementById("rManoObra").value) || 0;
    const precioCobrado = parseFloat(document.getElementById("rPrecio").value) || 0;
    const { costoTotal, ganancia } = calcularCostosGanancia(repuestos, manoDeObra, precioCobrado);

    const datos = {
        cliente,
        telefono: document.getElementById("rTelefono").value.trim(),
        equipo,
        problema: document.getElementById("rProblema").value.trim(),
        repuestos,
        manoDeObra,
        precioCobrado,
        costoTotal,
        ganancia,
        estado: document.getElementById("rEstado").value,
        prioridad: document.getElementById("rPrioridad").value,
        fechaEstimada: document.getElementById("rFechaEstimada").value || null,
        garantiaDias: parseInt(document.getElementById("rGarantiaDias").value) || 0,
        notas: document.getElementById("rNotas").value.trim()
    };

    try {
        if (editandoId) {
            await db.collection("reparaciones").doc(editandoId).update(datos);
        } else {
            datos.fechaIngreso = Date.now();
            await db.collection("reparaciones").add(datos);
        }
        cerrarFormModal();
    } catch (e) {
        console.error(e);
        alert("Error al guardar: " + (e.message || e));
    }
}

async function borrarReparacion(id) {
    if (!confirm("¿Eliminar este registro? No se puede deshacer.")) return;
    try {
        await db.collection("reparaciones").doc(id).delete();
    } catch (e) {
        console.error(e);
        alert("No se pudo borrar: " + (e.message || e));
    }
}

// ==================== EXPORTAR A EXCEL (CSV) ====================

function exportarReparacionesCSV() {
    if (reparaciones.length === 0) return alert("No hay registros para exportar.");
    const p = presetRubro();
    const filas = [["Fecha ingreso", "Cliente", "Teléfono", p.campoObjeto, "Detalle", "Costo total", "Precio cobrado", "Ganancia", "Estado", "Prioridad"]];
    reparaciones.forEach(r => {
        filas.push([
            r.fechaIngreso ? new Date(r.fechaIngreso).toLocaleDateString('es-ES') : '',
            r.cliente || '',
            r.telefono || '',
            r.equipo || '',
            (r.problema || '').replace(/\n/g, ' | '),
            r.costoTotal || 0,
            r.precioCobrado || 0,
            r.ganancia || 0,
            (ESTADOS[r.estado] || {}).label || r.estado || '',
            r.prioridad === 'urgente' ? 'Urgente' : 'Normal'
        ]);
    });
    const csv = filas.map(fila => fila.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `registros_${(TALLER_CONFIG.nombreNegocio || 'negocio').toLowerCase().replace(/[^a-z0-9]+/g, '-')}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Vista previa de la ganancia mientras se completa el formulario
["rRepuestos", "rManoObra", "rPrecio"].forEach(id => {
    document.addEventListener("input", (e) => {
        if (e.target && e.target.id === id) actualizarGananciaPreview();
    });
});

window.onload = bootstrap;
