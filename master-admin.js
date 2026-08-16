// ============================================================================
// MASTER-ADMIN.JS — Panel para dar de alta y administrar el directorio de
// tiendas. Se conecta SIEMPRE al proyecto master (MASTER_FIREBASE_CONFIG,
// definido en config.js) — nunca al proyecto de un cliente puntual.
// ============================================================================

firebase.initializeApp(MASTER_FIREBASE_CONFIG);
const db = firebase.firestore();
const auth = firebase.auth();

let esAdmin = false;
let clientes = [];
let editandoSlug = null; // null = alta nueva; string = editando ese slug original

// Tipos de aplicación que puede alojar el directorio. Para sumar un tipo
// nuevo en el futuro (otra herramienta más, no solo tiendas), alcanza con
// agregarlo acá y construir su propio archivo .html/.js con el mismo
// patrón de conexión dinámica por slug que ya usan "index.html" y
// "reparaciones.html".
const APP_TYPES = {
    tienda:       { label: "Tienda online",          archivo: "index.html",         icon: "🛒" },
    reparaciones: { label: "Taller de reparaciones",  archivo: "reparaciones.html",  icon: "🔧" }
};

function init() {
    auth.onAuthStateChanged(async (user) => {
        esAdmin = false;
        if (!user) { mostrarLoginNormal(); return; }
        try {
            const adminDoc = await db.collection("admins").doc(user.uid).get();
            if (adminDoc.exists) {
                esAdmin = true;
                mostrarPanel();
                cargarClientes();
            } else {
                mostrarLoginNormal();
            }
        } catch (e) {
            console.error(e);
            mostrarLoginNormal();
        }
    });
}

// ==================== LOGIN / PRIMER INGRESO ====================
// Mismo patrón de seguridad que usa cada tienda: sin usuario "de fábrica".
// El primer acceso requiere un email pre-autorizado en config/setup del
// proyecto master, y verificación real por correo.

function mostrarLoginNormal() {
    document.getElementById("panelMaster").style.display = "none";
    document.getElementById("loginMaster").style.display = "flex";
    document.getElementById("loginPaso").style.display = "block";
    document.getElementById("setupPaso1").style.display = "none";
    document.getElementById("setupPaso2").style.display = "none";
}

function mostrarSetup() {
    document.getElementById("loginPaso").style.display = "none";
    document.getElementById("setupPaso1").style.display = "block";
}

function mostrarPanel() {
    document.getElementById("loginMaster").style.display = "none";
    document.getElementById("panelMaster").style.display = "block";
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
        alert("✅ ¡Listo! Ya tenés acceso al panel master.");
    } catch (e) {
        console.error(e);
        alert("Ese email no está autorizado. Verificá el campo allowedAdminEmail en config/setup del proyecto master.");
    }
}

// ==================== DIRECTORIO DE CLIENTES ====================

function cargarClientes() {
    db.collection("clientes").onSnapshot(snap => {
        clientes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderClientes();
    }, err => console.error("clientes:", err));
}

function normalizarTextoMaster(s) {
    return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function renderClientes() {
    const buscador = document.getElementById("masterSearch");
    const q = normalizarTextoMaster(buscador ? buscador.value : "");
    const filtrados = q
        ? clientes.filter(c => normalizarTextoMaster(c.storeName || "").includes(q) || normalizarTextoMaster(c.id).includes(q))
        : clientes;

    const counter = document.getElementById("clientesCount");
    if (counter) {
        counter.innerText = clientes.length === 0
            ? ""
            : (q ? `${filtrados.length} de ${clientes.length} registro${clientes.length === 1 ? '' : 's'}` : `${clientes.length} registro${clientes.length === 1 ? '' : 's'}`);
    }

    const cont = document.getElementById("listaClientes");
    if (clientes.length === 0) {
        cont.innerHTML = '<p style="opacity:0.4; padding:20px; text-align:center;">Todavía no diste de alta nada en el directorio.</p>';
        return;
    }
    if (filtrados.length === 0) {
        cont.innerHTML = '<p style="opacity:0.4; padding:20px; text-align:center;">Nada coincide con la búsqueda.</p>';
        return;
    }

    cont.innerHTML = filtrados.map(c => {
        const inactiva = c.activo === false;
        const tipoInfo = APP_TYPES[c.tipo] || APP_TYPES.tienda;
        return `
        <div class="admin-item">
            <div style="flex:1;">
                <b>${c.storeName || c.id}</b>
                <span style="background:rgba(255,255,255,0.08); padding:2px 8px; border-radius:9999px; font-size:11px; margin-left:6px;">${tipoInfo.icon} ${tipoInfo.label}</span>
                <br>
                <small style="opacity:0.6;">slug: ${c.id}${c.firebaseConfig ? ' — proyecto: ' + c.firebaseConfig.projectId : ''}</small><br>
                <span style="background:${inactiva ? '#64748b' : 'var(--success)'}; color:white; padding:2px 8px; border-radius:9999px; font-size:11px;">${inactiva ? 'INACTIVA' : 'ACTIVA'}</span>
            </div>
            <div style="display:flex; gap:6px;">
                <button title="Editar" onclick="editarCliente('${c.id}')" style="background:none; border:none; font-size:18px; cursor:pointer;">✏️</button>
                <button title="Copiar link" onclick="copiarLink('${c.id}')" style="background:none; border:none; font-size:18px; cursor:pointer;">🔗</button>
                <button title="${inactiva ? 'Activar' : 'Pausar'}" onclick="toggleActivo('${c.id}', ${inactiva})" style="background:none; border:none; font-size:18px; cursor:pointer;">${inactiva ? '▶️' : '⏸️'}</button>
                <button title="Eliminar" onclick="borrarCliente('${c.id}')" style="background:none; border:none; font-size:18px; cursor:pointer; color:var(--danger);">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

function editarCliente(slug) {
    const c = clientes.find(x => x.id === slug);
    if (!c) return;
    editandoSlug = slug;
    document.getElementById("cNombre").value = c.storeName || "";
    document.getElementById("cSlug").value = c.id;
    document.getElementById("cTipo").value = c.tipo || "tienda";
    const fc = c.firebaseConfig || {};
    document.getElementById("cApiKey").value = fc.apiKey || "";
    document.getElementById("cAuthDomain").value = fc.authDomain || "";
    document.getElementById("cProjectId").value = fc.projectId || "";
    document.getElementById("cStorageBucket").value = fc.storageBucket || "";
    document.getElementById("cMessagingSenderId").value = fc.messagingSenderId || "";
    document.getElementById("cAppId").value = fc.appId || "";

    document.getElementById("formClienteTitulo").innerText = "Editar: " + (c.storeName || slug);
    document.getElementById("btnGuardarCliente").innerText = "GUARDAR CAMBIOS";
    document.getElementById("btnCancelarEdicion").style.display = "block";
    document.getElementById("formCliente").scrollIntoView({ behavior: "smooth" });
}

function cancelarEdicion() {
    limpiarFormCliente();
}

function limpiarFormCliente() {
    editandoSlug = null;
    document.querySelectorAll('#formCliente input').forEach(i => i.value = "");
    document.getElementById("cTipo").value = "tienda";
    document.getElementById("formClienteTitulo").innerText = "Agregar registro nuevo";
    document.getElementById("btnGuardarCliente").innerText = "GUARDAR";
    document.getElementById("btnCancelarEdicion").style.display = "none";
}

function linkDe(cliente) {
    const tipoInfo = APP_TYPES[cliente.tipo] || APP_TYPES.tienda;
    return `${location.origin}${location.pathname.replace('master-admin.html', tipoInfo.archivo)}?slug=${cliente.id}`;
}

function copiarLink(slug) {
    const c = clientes.find(x => x.id === slug);
    if (!c) return;
    const url = linkDe(c);
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => alert("Link copiado:\n" + url)).catch(() => prompt("Copiá el link:", url));
    } else {
        prompt("Copiá el link:", url);
    }
}

// Pausar NO borra nada del cliente: solo hace que su link deje de resolver
// (mostrarErrorSlug en la tienda) hasta que se reactive.
async function toggleActivo(slug, activarlo) {
    try {
        await db.collection("clientes").doc(slug).update({ activo: activarlo });
    } catch (e) {
        console.error(e);
        alert("No se pudo actualizar: " + (e.message || e));
    }
}

// Esto solo saca el registro del directorio (deja de resolver el slug). NO
// borra el proyecto de Firebase del cliente ni ninguno de sus datos.
async function borrarCliente(slug) {
    if (!confirm(`¿Quitar "${slug}" del directorio?\n\nEsto NO borra su proyecto de Firebase ni sus datos — solo hace que el link con ese slug deje de funcionar.`)) return;
    try {
        await db.collection("clientes").doc(slug).delete();
        if (editandoSlug === slug) limpiarFormCliente();
    } catch (e) {
        console.error(e);
        alert("No se pudo borrar: " + (e.message || e));
    }
}

async function guardarCliente() {
    const nuevoSlug = document.getElementById("cSlug").value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const storeName = document.getElementById("cNombre").value.trim();
    const tipo = document.getElementById("cTipo").value;
    if (!nuevoSlug || !storeName) return alert("Completá nombre y slug");

    const firebaseConfig = {
        apiKey: document.getElementById("cApiKey").value.trim(),
        authDomain: document.getElementById("cAuthDomain").value.trim(),
        projectId: document.getElementById("cProjectId").value.trim(),
        storageBucket: document.getElementById("cStorageBucket").value.trim(),
        messagingSenderId: document.getElementById("cMessagingSenderId").value.trim(),
        appId: document.getElementById("cAppId").value.trim(),
    };
    if (Object.values(firebaseConfig).some(v => !v)) return alert("Completá las 6 credenciales de Firebase del cliente");

    const esEdicion = !!editandoSlug;
    const cambioSlug = esEdicion && editandoSlug !== nuevoSlug;

    try {
        // Si es alta nueva, o si cambió el slug, verificamos que no pisemos
        // sin querer otro registro que ya use ese slug.
        if (!esEdicion || cambioSlug) {
            const existe = await db.collection("clientes").doc(nuevoSlug).get();
            if (existe.exists) return alert("Ya existe un registro con ese slug. Elegí otro.");
        }

        const previo = esEdicion ? clientes.find(c => c.id === editandoSlug) : null;
        const datos = {
            storeName,
            tipo,
            firebaseConfig,
            activo: previo ? previo.activo !== false : true,
            creado: previo ? (previo.creado || Date.now()) : Date.now(),
            actualizado: Date.now()
        };

        if (cambioSlug) {
            // El slug es el ID del documento: para "renombrarlo" hay que crear
            // el nuevo y borrar el viejo (Firestore no permite renombrar un ID).
            const batch = db.batch();
            batch.set(db.collection("clientes").doc(nuevoSlug), datos);
            batch.delete(db.collection("clientes").doc(editandoSlug));
            await batch.commit();
        } else {
            await db.collection("clientes").doc(nuevoSlug).set(datos);
        }

        alert(`✅ Guardado. Link: ${linkDe({ id: nuevoSlug, tipo })}`);
        limpiarFormCliente();
    } catch (e) {
        console.error(e);
        alert("Error al guardar: " + (e.message || e));
    }
}

window.onload = init;
