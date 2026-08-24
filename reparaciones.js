// ============================================================================
// REPARACIONES.JS — Control de reparaciones de celulares (repuestos, costos,
// ganancias). Mismo patrón de conexión dinámica por slug que la tienda:
// primero resuelve el slug contra el proyecto master, después se conecta al
// proyecto de Firebase PROPIO de este taller (100% aislado del resto).
// ============================================================================

let db, auth;
let masterApp, clienteApp;
let esAdmin = false;
let reparaciones = [];
let editandoId = null;

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
    if (!slug) return mostrarErrorSlug("Falta indicar el taller en el link (falta ?slug=... en la URL).");

    try {
        masterApp = firebase.initializeApp(MASTER_FIREBASE_CONFIG, "master");
        const masterDb = firebase.firestore(masterApp);
        const clienteDoc = await masterDb.collection("clientes").doc(slug).get();

        if (!clienteDoc.exists || clienteDoc.data().activo === false) {
            return mostrarErrorSlug("No encontramos este taller. Verificá el link.");
        }
        const { firebaseConfig, storeName } = clienteDoc.data();
        if (!firebaseConfig || !firebaseConfig.projectId) {
            return mostrarErrorSlug("Este taller todavía no está configurado del todo.");
        }

        clienteApp = firebase.initializeApp(firebaseConfig, "cliente");
        db = firebase.firestore(clienteApp);
        auth = firebase.auth(clienteApp);

        const nombreEl = document.getElementById("tallerNombre");
        if (nombreEl) nombreEl.innerText = "🔧 " + (storeName || "Reparaciones");
        document.title = (storeName || "Reparaciones") + " — Control de Reparaciones";

        generarManifestDinamico(storeName || "Reparaciones");
        registrarServiceWorker();

        init();
    } catch (e) {
        console.error("Error al inicializar:", e);
        mostrarErrorSlug("No pudimos cargar esta herramienta. Probá de nuevo en unos minutos.");
    }
}

// Mismo patrón que la tienda: un manifest.json por taller, generado al
// vuelo (no puede ser un archivo estático distinto por cliente).
function generarManifestDinamico(nombre) {
    try {
        const manifest = {
            name: nombre,
            short_name: nombre.slice(0, 12),
            start_url: `${location.origin}${location.pathname}${location.search}`,
            scope: `${location.origin}${location.pathname}`,
            display: "standalone",
            background_color: "#0f172a",
            theme_color: "#3b82f6",
            icons: [
                { src: "log.png", sizes: "192x192", type: "image/png", purpose: "any" },
                { src: "log.png", sizes: "512x512", type: "image/png", purpose: "any" }
            ]
        };
        const url = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: "application/json" }));
        let link = document.querySelector('link[rel="manifest"]');
        if (!link) { link = document.createElement("link"); link.rel = "manifest"; document.head.appendChild(link); }
        link.href = url;
    } catch (e) {
        console.warn("No se pudo generar el manifest:", e);
    }
}

function registrarServiceWorker() {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("service-worker.js").catch(e => console.warn("Service worker no registrado:", e));
    }
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
            } else {
                await auth.signOut();
                mostrarLoginNormal();
            }
        } catch (e) {
            console.error(e);
            mostrarLoginNormal();
        }
    });
}

// ==================== LOGIN / PRIMER INGRESO (mismo patrón que la tienda) ====================

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
        alert("Email o contraseña incorrectos.");
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
        location.reload(); // fuerza a re-resolver la sesión ahora que ya sos admin
    } catch (e) {
        console.error(e);
        alert("Ese email (" + auth.currentUser.email + ") no está autorizado. Verificá que sea EXACTAMENTE igual al campo allowedAdminEmail en config/setup de este proyecto (mayúsculas/espacios incluidos).");
    }
}

// ==================== REPARACIONES: CARGA Y CÁLCULOS ====================

function cargarReparaciones() {
    db.collection("reparaciones").orderBy("fechaIngreso", "desc").onSnapshot(snap => {
        reparaciones = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderStats();
        renderLista();
    }, err => console.warn("reparaciones:", err.code));
}

// Suma repuestos + mano de obra = costo total; precio cobrado - costo = ganancia.
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
    en_reparacion:  { label: "En reparación",       color: "var(--promo)" },
    listo:          { label: "Listo para retirar",  color: "var(--accent)" },
    entregado:      { label: "Entregado",           color: "var(--success)" }
};

function renderStats() {
    const ahora = new Date();
    let gananciaTotal = 0, pendientes = 0, delMes = 0, gananciaMes = 0;

    reparaciones.forEach(r => {
        gananciaTotal += (r.ganancia || 0);
        if (r.estado === 'pendiente' || r.estado === 'en_reparacion') pendientes++;
        const f = new Date(r.fechaIngreso);
        if (f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear()) {
            delMes++;
            gananciaMes += (r.ganancia || 0);
        }
    });

    document.getElementById("statGanancia").innerText = "$" + gananciaTotal.toFixed(0);
    document.getElementById("statPendientes").innerText = pendientes;
    document.getElementById("statMes").innerText = delMes;
    document.getElementById("statGananciaMes").innerText = "$" + gananciaMes.toFixed(0);
}

function renderLista() {
    const q = normalizarTextoRep(document.getElementById("buscador").value);
    const filtroEstado = document.getElementById("filtroEstado").value;

    let filtradas = reparaciones;
    if (filtroEstado) filtradas = filtradas.filter(r => r.estado === filtroEstado);
    if (q) filtradas = filtradas.filter(r =>
        normalizarTextoRep(r.cliente).includes(q) || normalizarTextoRep(r.equipo).includes(q)
    );

    const cont = document.getElementById("listaReparaciones");
    if (filtradas.length === 0) {
        cont.innerHTML = '<p style="opacity:0.4; padding:30px; text-align:center;">No hay reparaciones que mostrar.</p>';
        return;
    }

    cont.innerHTML = filtradas.map(r => {
        const estadoInfo = ESTADOS[r.estado] || ESTADOS.pendiente;
        const fecha = r.fechaIngreso ? new Date(r.fechaIngreso).toLocaleDateString('es-ES') : '';
        return `
        <div class="taller-card rep-card">
            <div class="flex-between" style="align-items:flex-start;">
                <div>
                    <b style="font-size:16px;">${r.cliente || 'Sin nombre'}</b>
                    <span class="estado-pill" style="background:${estadoInfo.color}; color:#fff; margin-left:8px;">${estadoInfo.label}</span>
                    <div style="opacity:0.7; font-size:14px; margin-top:4px;">${r.equipo || ''}</div>
                    <div style="opacity:0.5; font-size:12px; margin-top:2px;">${fecha}${r.telefono ? ' · ' + r.telefono : ''}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:800; color:var(--success);">$${(r.ganancia || 0).toFixed(0)}</div>
                    <small style="opacity:0.5;">ganancia</small>
                </div>
            </div>
            ${r.problema ? `<div style="margin-top:10px; font-size:13px; opacity:0.8;">${r.problema}</div>` : ''}
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
    document.getElementById("formTitulo").innerText = "Nueva reparación";
    document.getElementById("rId").value = "";
    document.getElementById("rCliente").value = "";
    document.getElementById("rTelefono").value = "";
    document.getElementById("rEquipo").value = "";
    document.getElementById("rProblema").value = "";
    document.getElementById("rRepuestos").value = "";
    document.getElementById("rManoObra").value = "";
    document.getElementById("rPrecio").value = "";
    document.getElementById("rEstado").value = "pendiente";
    document.getElementById("rNotas").value = "";
    actualizarGananciaPreview();
    document.getElementById("formModal").style.display = "flex";
}

function editarReparacion(id) {
    const r = reparaciones.find(x => x.id === id);
    if (!r) return;
    editandoId = id;
    document.getElementById("formTitulo").innerText = "Editar reparación";
    document.getElementById("rId").value = r.id;
    document.getElementById("rCliente").value = r.cliente || "";
    document.getElementById("rTelefono").value = r.telefono || "";
    document.getElementById("rEquipo").value = r.equipo || "";
    document.getElementById("rProblema").value = r.problema || "";
    document.getElementById("rRepuestos").value = (r.repuestos || []).map(x => `${x.nombre} | ${x.costo}`).join('\n');
    document.getElementById("rManoObra").value = r.manoDeObra || "";
    document.getElementById("rPrecio").value = r.precioCobrado || "";
    document.getElementById("rEstado").value = r.estado || "pendiente";
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
    if (!cliente || !equipo) return alert("Completá al menos el cliente y el equipo");

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
    if (!confirm("¿Eliminar esta reparación? No se puede deshacer.")) return;
    try {
        await db.collection("reparaciones").doc(id).delete();
    } catch (e) {
        console.error(e);
        alert("No se pudo borrar: " + (e.message || e));
    }
}

// Vista previa de la ganancia mientras se completa el formulario
["rRepuestos", "rManoObra", "rPrecio"].forEach(id => {
    document.addEventListener("input", (e) => {
        if (e.target && e.target.id === id) actualizarGananciaPreview();
    });
});

window.onload = bootstrap;
