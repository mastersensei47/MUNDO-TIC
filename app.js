// ============================================================================
// APP.JS — Lógica de la tienda (no debería hacer falta tocar este archivo
// para dar de alta un cliente nuevo; toda la personalización vive en la
// configuración de cada tienda, resuelta dinámicamente por ?slug=)
// ============================================================================

// ==================== MULTI-TIENDA: RESOLUCIÓN DINÁMICA POR SLUG ====================
// Este sitio es UNO SOLO y sirve a todos los clientes según el slug de la
// URL (ej: tuservidor.com/?slug=mundo-tic). Cada cliente sigue teniendo su
// propio proyecto de Firebase, 100% aislado del resto — lo único
// centralizado es un directorio (proyecto "master") que dice "el slug
// mundo-tic corresponde a este firebaseConfig". Ver README.md →
// "Sistema multi-tienda por slug".
//
// MASTER_FIREBASE_CONFIG viene de config.js y es el ÚNICO dato fijo de todo
// el sistema: es el mismo para todos los clientes, porque apunta al
// proyecto "directorio", no a ningún cliente en particular.

let db, auth, STORE_CONFIG;
let clienteApp, masterApp;

function leerSlug() {
    return new URLSearchParams(location.search).get("slug");
}

function mostrarErrorSlug(mensaje) {
    const el = document.getElementById("slugError");
    if (el) {
        el.querySelector("p").innerText = mensaje;
        el.style.display = "flex";
    }
    document.body.classList.add("no-scroll");
}

// Valores por defecto para cualquier campo de config/tienda que un cliente
// no haya cargado todavía, así el sitio nunca se rompe por un dato faltante.
const CONFIG_DEFAULTS = {
    storeName: "Tienda", tagline: "", city: "", logoUrl: "log.png",
    businessType: "generico", whatsappNumber: "", instagramUrl: "", facebookUrl: "",
    currency: "$",
    features: { wholesalePricing: true, stockControl: true, heroSlider: true, userRegistration: true, productVariants: false },
    categories: [],
    theme: { bg: "#0f172a", card: "#1e293b", text: "#f1f5f9", accent: "#3b82f6", success: "#10b981", promo: "#f59e0b", danger: "#ef4444", radius: "18px" },
    notifications: { emailEnabled: false, emailJsServiceId: "", emailJsTemplateId: "", emailJsPublicKey: "", adminEmail: "" }
};

async function bootstrap() {
    const slug = leerSlug();
    if (!slug) {
        return mostrarErrorSlug("Falta indicar la tienda en el link (falta ?slug=... en la URL). Pedile el link completo a quien te lo compartió.");
    }

    try {
        // 1) Conectar al proyecto MASTER (el directorio) para resolver el slug.
        masterApp = firebase.initializeApp(MASTER_FIREBASE_CONFIG, "master");
        const masterDb = firebase.firestore(masterApp);
        const clienteDoc = await masterDb.collection("clientes").doc(slug).get();

        if (!clienteDoc.exists || clienteDoc.data().activo === false) {
            return mostrarErrorSlug("No encontramos esta tienda. Verificá el link, o consultá con el negocio.");
        }
        const { firebaseConfig } = clienteDoc.data();
        if (!firebaseConfig || !firebaseConfig.projectId) {
            return mostrarErrorSlug("Esta tienda todavía no está configurada del todo. Volvé a intentar más tarde.");
        }

        // 2) Conectar al proyecto PROPIO de ese cliente (aislado del resto).
        clienteApp = firebase.initializeApp(firebaseConfig, "cliente");
        db = firebase.firestore(clienteApp);
        auth = firebase.auth(clienteApp);

        // 3) Traer la configuración de marca/tema/categorías de ESE cliente
        // (vive en su propio Firestore, nunca en el proyecto master).
        let datosTienda = {};
        try {
            const cfgDoc = await db.collection("config").doc("tienda").get();
            if (cfgDoc.exists) datosTienda = cfgDoc.data();
        } catch (e) {
            console.warn("No se pudo leer config/tienda, se usan valores por defecto:", e);
        }

        STORE_CONFIG = {
            ...CONFIG_DEFAULTS,
            ...datosTienda,
            features: { ...CONFIG_DEFAULTS.features, ...(datosTienda.features || {}) },
            theme: { ...CONFIG_DEFAULTS.theme, ...(datosTienda.theme || {}) },
            notifications: { ...CONFIG_DEFAULTS.notifications, ...(datosTienda.notifications || {}) },
            storeId: slug // el slug ES el identificador interno, siempre
        };

        init();
    } catch (e) {
        console.error("Error al inicializar la tienda:", e);
        mostrarErrorSlug("No pudimos cargar esta tienda. Probá de nuevo en unos minutos.");
    }
}

let prods = [];
let cart = [];
let users = [];
let orders = [];
let heroImages = [];
let isMay = false;
let esAdmin = false;
let currentUser = null;
let usuarioLogueado = null;
let filterCat = "";
let currentProductId = null;
let currentDetailQty = 1;
let currentVariantes = []; // variantes (talle/color) del producto abierto en el detalle
let rotators = [];
let heroInterval = null;

// Convierte lo que la persona escribió en el login/registro en un "email"
// interno válido para Firebase Authentication. Si ya escribió un email real
// (contiene "@", como hace normalmente el administrador) se usa tal cual,
// para que la recuperación de contraseña por correo funcione de verdad.
// Si escribió un nombre de usuario simple (clientes mayoristas), se arma un
// email interno con el storeId (= slug) como dominio ficticio.
function toAuthEmail(input) {
    const v = (input || "").trim();
    if (v.includes("@")) return v.toLowerCase();
    return v.toLowerCase().replace(/\s+/g, "") + "@" + STORE_CONFIG.storeId + ".tienda.local";
}

function init() {
    aplicarTema();
    aplicarBranding();
    renderCategorias();
    renderCategoriasSelect();
    updateCartUI();
    inicializarNotificaciones();

    // Resolver sesión: ¿invitado, administrador o cliente mayorista?
    auth.onAuthStateChanged(async (user) => {
        currentUser = user;
        esAdmin = false;
        isMay = false;
        usuarioLogueado = null;

        if (!user) {
            mostrarPerfilVacio();
            render();
            return;
        }

        try {
            const adminDoc = await db.collection("admins").doc(user.uid).get();
            if (adminDoc.exists) {
                esAdmin = true;
                document.getElementById("logoutBtn").style.display = "block";
                render();
                return;
            }

            const perfilDoc = await db.collection("usuarios").doc(user.uid).get();
            if (perfilDoc.exists && perfilDoc.data().activo) {
                isMay = STORE_CONFIG.features.wholesalePricing;
                usuarioLogueado = { id: perfilDoc.id, ...perfilDoc.data() };
                llenarPerfil(usuarioLogueado);
            } else if (perfilDoc.exists && !perfilDoc.data().activo) {
                alert("Tu cuenta está en revisión por el administrador.");
                await auth.signOut();
                return;
            } else {
                mostrarPerfilVacio();
            }
        } catch (e) {
            console.error("Error resolviendo la sesión:", e);
            mostrarPerfilVacio();
        }
        render();
    });

    // Cargar productos en tiempo real desde Firebase
    db.collection("productos").onSnapshot(snap => {
        prods = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Asegurar que exista el array de imagenes y el stock por defecto si no existen
        prods.forEach(p => {
            if (!p.imagenes) p.imagenes = p.imagen ? [p.imagen] : [];
            if (typeof p.stock === 'undefined') p.stock = 10;
        });
        render();
        renderAdmP();
    });

    // Cargar usuarios (las reglas de seguridad solo dejan leer la colección
    // completa al administrador; para cualquier otra persona esto queda vacío)
    db.collection("usuarios").onSnapshot(snap => {
        users = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAdmU();
    }, err => console.warn("usuarios:", err.code));

    // Cargar pedidos (idem, solo lectura para el administrador)
    db.collection("pedidos").orderBy("fecha", "desc").onSnapshot(snap => {
        orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAdmO();
        renderAdmStats();
    }, err => console.warn("pedidos:", err.code));

    // Cargar slider hero
    db.collection("hero").orderBy("order").onSnapshot(snap => {
        heroImages = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderHeroSlider();
        renderAdmSlider();
    });
}

// ==================== APLICAR CONFIG.JS AL DOM ====================

function aplicarTema() {
    const root = document.documentElement;
    Object.entries(STORE_CONFIG.theme || {}).forEach(([k, v]) => root.style.setProperty(`--${k}`, v));
}

function aplicarBranding() {
    document.title = STORE_CONFIG.storeName;

    document.querySelectorAll(".main-logo, #drawerLogo").forEach(el => el.src = STORE_CONFIG.logoUrl);
    document.getElementById("drawerBrand").innerText = STORE_CONFIG.storeName;
    document.getElementById("drawerStoreName").innerText = STORE_CONFIG.storeName;
    document.getElementById("drawerTagline").innerHTML =
        STORE_CONFIG.tagline + (STORE_CONFIG.city ? `<br>en ${STORE_CONFIG.city}` : "");

    document.getElementById("waLink").href = `https://wa.me/${STORE_CONFIG.whatsappNumber}`;

    const ig = document.getElementById("igLink");
    ig.href = STORE_CONFIG.instagramUrl || "#";
    ig.style.display = STORE_CONFIG.instagramUrl ? "flex" : "none";

    const fb = document.getElementById("fbLink");
    fb.href = STORE_CONFIG.facebookUrl || "#";
    fb.style.display = STORE_CONFIG.facebookUrl ? "flex" : "none";

    document.getElementById("footerVersion").innerText =
        `${STORE_CONFIG.storeName}${STORE_CONFIG.city ? " • " + STORE_CONFIG.city.toUpperCase() : ""}`;

    document.getElementById("regPrompt").style.display =
        STORE_CONFIG.features.userRegistration ? "" : "none";

    document.getElementById("heroSlider").style.display =
        STORE_CONFIG.features.heroSlider ? "" : "none";

    document.body.classList.toggle("no-stock", !STORE_CONFIG.features.stockControl);
    document.body.classList.toggle("no-variants", !STORE_CONFIG.features.productVariants);
}

function renderCategorias() {
    const bar = document.getElementById("catBar");
    let html = `<div class="cat-item active" onclick="setCat(this, '')">🌐 Todos</div>`;
    html += (STORE_CONFIG.categories || []).map(c =>
        `<div class="cat-item" onclick="setCat(this, '${c.id}')">${c.icon || ''} ${c.label}</div>`
    ).join("");
    bar.innerHTML = html;
}

function renderCategoriasSelect() {
    const sel = document.getElementById("fCat");
    if (!sel) return;
    sel.innerHTML = (STORE_CONFIG.categories || []).map(c =>
        `<option value="${c.id}">${c.icon || ''} ${c.label}</option>`
    ).join("");
}

function mostrarPerfilVacio() {
    document.getElementById("perfilContenido").style.display = "none";
    document.getElementById("perfilVacio").style.display = "block";
    document.getElementById("logoutBtn").style.display = "none";
}

// ==================== NOTIFICACIÓN AUTOMÁTICA POR EMAIL (opcional) ====================
// Usa EmailJS (sin backend propio). Ver README.md → "Notificación
// automática de pedidos" para el paso a paso de configuración.

function inicializarNotificaciones() {
    const n = STORE_CONFIG.notifications;
    if (n && n.emailEnabled && typeof emailjs !== 'undefined' && n.emailJsPublicKey) {
        emailjs.init({ publicKey: n.emailJsPublicKey });
    }
}

function notificarPedidoPorEmail(textoPedido, total) {
    const n = STORE_CONFIG.notifications;
    if (!n || !n.emailEnabled) return;
    if (typeof emailjs === 'undefined') return console.warn("EmailJS no está cargado.");
    if (!n.emailJsServiceId || !n.emailJsTemplateId || !n.adminEmail) {
        return console.warn("Notificaciones por email activadas pero falta completar config.js → notifications.");
    }
    // Si falla, solo lo dejamos en consola: nunca debe romper el checkout,
    // que ya se confirmó igual por WhatsApp y quedó guardado en Firestore.
    emailjs.send(n.emailJsServiceId, n.emailJsTemplateId, {
        to_email: n.adminEmail,
        tienda: STORE_CONFIG.storeName,
        total: total,
        mensaje: textoPedido
    }).catch(err => console.warn("No se pudo enviar el email de notificación:", err));
}

// ==================== HERO SLIDER ====================

function renderHeroSlider() {
    const hero = document.getElementById("heroSlider");
    let content = hero.querySelector('.hero-content');
    if (!content) {
        content = document.createElement('div');
        content.className = 'hero-content';
    }
    content.innerHTML = `<h1>${STORE_CONFIG.storeName}</h1><p>${STORE_CONFIG.tagline}</p>`;
    hero.innerHTML = '';
    hero.appendChild(content);

    if (heroImages.length === 0) {
        const defaultSlide = document.createElement('div');
        defaultSlide.className = 'hero-slide active';
        defaultSlide.style.backgroundImage = "url('https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=1470&auto=format&fit=crop')";
        hero.appendChild(defaultSlide);
        return;
    }

    heroImages.forEach((slide, index) => {
        const div = document.createElement('div');
        div.className = 'hero-slide';
        if (index === 0) div.classList.add('active');
        div.style.backgroundImage = `url('${slide.url}')`;
        hero.appendChild(div);
    });

    let current = 0;
    if (heroInterval) clearInterval(heroInterval);
    heroInterval = setInterval(() => {
        current = (current + 1) % heroImages.length;
        document.querySelectorAll('.hero-slide')
            .forEach((s, i) => s.classList.toggle('active', i === current));
    }, 5000);
}

function startProductImageRotators() {
    rotators.forEach(clearInterval);
    rotators = [];
    document.querySelectorAll('.product-card').forEach(card => {
        const id = card.getAttribute('data-id');
        const product = prods.find(p => p.id === id);
        if (!product || !product.imagenes || product.imagenes.length <= 1) return;
        let index = 0;
        const imgEl = card.querySelector('.img-box img');
        const interval = setInterval(() => {
            index = (index + 1) % product.imagenes.length;
            imgEl.style.opacity = '0';
            setTimeout(() => {
                imgEl.src = product.imagenes[index];
                imgEl.style.opacity = '1';
            }, 300);
        }, 4500);
        rotators.push(interval);
    });
}

// ==================== CATÁLOGO ====================

function render() {
    const query = document.getElementById("searchInput").value.toLowerCase().trim();
    const cont = document.getElementById("productsCont");
    const filtered = prods.filter(p =>
        p.nombre.toLowerCase().includes(query) &&
        (filterCat === "" || p.categoria === filterCat)
    );

    if (filtered.length === 0) {
        cont.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:80px 20px; opacity:0.5;">No se encontraron productos...</div>`;
        return;
    }

    cont.innerHTML = filtered.map(p => {
        const precioActual = isMay ? (p.precio_may || p.precio) : p.precio;
        const firstImg = p.imagenes && p.imagenes.length > 0 ? p.imagenes[0] : (p.imagen || 'https://via.placeholder.com/300?text=Sin+imagen');
        const conVariantes = p.tieneVariantes && STORE_CONFIG.features.productVariants;
        return `
            <div class="product-card" data-id="${p.id}" onclick="if(!event.target.closest('.btn-add')) showProductDetail('${p.id}')">
                ${p.promo ? `<div class="promo-badge">${p.promo}</div>` : ''}
                <div class="img-box">
                    <img src="${firstImg}" alt="${p.nombre}">
                </div>
                <div class="info-box">
                    <div class="prod-title">${p.nombre}</div>
                    <div class="price-val">${STORE_CONFIG.currency}${precioActual}</div>
                    ${conVariantes ? '' : `<div class="stock-info">Stock: ${p.stock} unidades</div>`}
                    <button class="btn-add" onclick="event.stopImmediatePropagation(); ${conVariantes ? `showProductDetail('${p.id}')` : `addToCart('${p.id}')`}">🛒 ${conVariantes ? 'Ver opciones' : 'Agregar'}</button>
                </div>
            </div>`;
    }).join("");
    startProductImageRotators();
}

// ==================== BUSCADOR CON SUGERENCIAS ====================
// Todo client-side, sin servicios externos: coincidencia por texto y, si
// no hay resultados, una tolerancia simple a errores de tipeo.

function normalizarTexto(s) {
    return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function distanciaEdicion(a, b) {
    const dp = [];
    for (let i = 0; i <= a.length; i++) dp.push([i]);
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[a.length][b.length];
}

function actualizarSugerencias() {
    const box = document.getElementById("searchSuggestions");
    if (!box) return;
    const qRaw = document.getElementById("searchInput").value.trim();
    if (!qRaw) { box.style.display = "none"; box.innerHTML = ""; return; }
    const q = normalizarTexto(qRaw);

    let candidatos = prods.filter(p => normalizarTexto(p.nombre).includes(q));
    if (candidatos.length === 0 && q.length >= 3) {
        // Sin coincidencia directa: probamos tolerar un par de errores de tipeo
        candidatos = prods
            .map(p => ({ p, dist: distanciaEdicion(q, normalizarTexto(p.nombre).slice(0, q.length + 3)) }))
            .filter(x => x.dist <= 2)
            .sort((a, b) => a.dist - b.dist)
            .map(x => x.p);
    }
    candidatos = candidatos.slice(0, 6);

    if (candidatos.length === 0) { box.style.display = "none"; box.innerHTML = ""; return; }

    box.innerHTML = candidatos.map(p => {
        const img = (p.imagenes && p.imagenes[0]) ? p.imagenes[0] : (p.imagen || 'https://via.placeholder.com/40');
        return `<div class="suggestion-item" onmousedown="elegirSugerencia('${p.id}')">
            <img src="${img}" alt="">
            <span>${p.nombre}</span>
        </div>`;
    }).join('');
    box.style.display = "block";
}

function elegirSugerencia(id) {
    const p = prods.find(x => x.id === id);
    if (!p) return;
    document.getElementById("searchInput").value = p.nombre;
    document.getElementById("searchSuggestions").style.display = "none";
    render();
}

async function showProductDetail(id) {
    const p = prods.find(x => x.id === id);
    if (!p) return;
    currentProductId = id;
    currentDetailQty = 1;
    document.getElementById('detailQtyInput').value = 1;

    const imgs = (p.imagenes && p.imagenes.length > 0)
        ? [...p.imagenes]
        : (p.imagen ? [p.imagen] : ['https://via.placeholder.com/600?text=Sin+imagen']);

    if (imgs.length === 1) imgs.push(imgs[0]);

    document.getElementById('detailImg').src = imgs[0];
    const thumbsContainer = document.getElementById('thumbnails');
    thumbsContainer.innerHTML = '';

    imgs.forEach((url, index) => {
        const thumb = document.createElement('div');
        thumb.className = `thumb ${index === 0 ? 'active' : ''}`;
        thumb.innerHTML = `<img src="${url}" alt="">`;
        thumb.onclick = () => {
            document.getElementById('detailImg').src = url;
            document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');
        };
        thumbsContainer.appendChild(thumb);
    });

    document.getElementById('detailTitle').innerText = p.nombre;
    const precioAMostrar = isMay ? (p.precio_may || p.precio) : p.precio;
    document.getElementById('detailPrice').innerHTML = `${STORE_CONFIG.currency} <strong>${precioAMostrar}</strong>`;

    // Variantes (talle/color) si el producto y la tienda las tienen activadas
    const varSection = document.getElementById('detailVarianteSection');
    const varSelect = document.getElementById('detailVarianteSelect');
    const detailStockEl = document.getElementById('detailStock');
    if (p.tieneVariantes && STORE_CONFIG.features.productVariants) {
        detailStockEl.style.display = 'none';
        varSection.style.display = 'block';
        varSelect.innerHTML = '<option value="">Cargando...</option>';
        try {
            const snap = await db.collection("productos").doc(id).collection("variantes").orderBy("orden").get();
            currentVariantes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            console.error(e);
            currentVariantes = [];
        }
        varSelect.innerHTML = currentVariantes.length === 0
            ? '<option value="">Sin opciones disponibles</option>'
            : '<option value="">Elegí una opción...</option>' + currentVariantes.map(v =>
                `<option value="${v.nombre}" ${v.stock <= 0 ? 'disabled' : ''}>${v.nombre} ${v.stock > 0 ? `(${v.stock} disp.)` : '(sin stock)'}</option>`
              ).join('');
    } else {
        currentVariantes = [];
        varSection.style.display = 'none';
        detailStockEl.style.display = '';
        detailStockEl.innerHTML = `Stock: <strong>${p.stock}</strong>`;
    }

    document.getElementById('detailDesc').innerHTML = p.descripcion?.replace(/\n/g, '<br>') || '';
    document.getElementById('detailCaract').innerHTML = p.caracteristicas?.replace(/\n/g, '<br>') || '';
    document.getElementById('detailFicha').innerHTML = p.ficha?.replace(/\n/g, '<br>') || '';

    // Ocultar secciones vacías del detalle (descripción / características / ficha)
    document.querySelectorAll('#productDetailModal .detail-sections details').forEach(det => {
        const content = det.querySelector('.detail-content');
        det.style.display = (content && content.innerHTML.trim()) ? '' : 'none';
    });

    document.getElementById('productDetailModal').style.display = 'flex';
    document.body.classList.add("modal-open");
}

function changeDetailQty(delta) {
    let qty = parseInt(document.getElementById('detailQtyInput').value) || 1;
    qty = Math.max(1, qty + delta);
    document.getElementById('detailQtyInput').value = qty;
    currentDetailQty = qty;
}

function closeProductDetail() {
    document.getElementById('productDetailModal').style.display = 'none';
    document.body.classList.remove("modal-open");
    currentProductId = null;
}

function addCurrentToCart() {
    if (!currentProductId) return;
    const p = prods.find(x => x.id === currentProductId);
    if (!p) return;

    let variante = null;
    if (p.tieneVariantes && STORE_CONFIG.features.productVariants) {
        variante = document.getElementById('detailVarianteSelect').value;
        if (!variante) return alert("Elegí una opción antes de agregar al carrito");
        const v = currentVariantes.find(x => x.nombre === variante);
        if (!v || v.stock < currentDetailQty) return alert(`❌ Solo quedan ${v ? v.stock : 0} unidades de "${variante}"`);
    } else {
        if (p.stock < currentDetailQty) return alert(`❌ Solo quedan ${p.stock} unidades`);
    }

    const exist = cart.find(i => i.id === currentProductId && (i.variante || null) === variante);
    if (exist) exist.qty += currentDetailQty;
    else cart.push({id: currentProductId, qty: currentDetailQty, variante});
    updateCartUI();
    showToast();
    closeProductDetail();
}

function addToCart(id) {
    const p = prods.find(x => x.id === id);
    if (!p) return;
    if (p.tieneVariantes && STORE_CONFIG.features.productVariants) return showProductDetail(id);
    if (p.stock < 1) return alert("Stock insuficiente");
    const exist = cart.find(i => i.id === id && !i.variante);
    if (exist) exist.qty++;
    else cart.push({id, qty: 1, variante: null});
    updateCartUI();
    showToast();
}

function showToast() {
    const toast = document.getElementById("toast");
    toast.style.display = "flex";
    setTimeout(() => toast.style.display = "none", 2200);
}

// ==================== CARRITO ====================

function updateCartUI() {
    let total = 0;
    let count = 0;
    const list = document.getElementById("cartItems");
    list.innerHTML = cart.map((item, idx) => {
        const p = prods.find(x => x.id === item.id);
        if (!p) return "";
        const precio = isMay ? (p.precio_may || p.precio) : p.precio;
        const sub = precio * item.qty;
        total += sub;
        count += item.qty;
        return `
            <div style="padding:18px 0; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;">
                <div style="flex:1;">
                    <div style="font-weight:700; font-size:14px; margin-bottom:4px;">${p.nombre}${item.variante ? ` <span style="opacity:0.6; font-weight:500;">(${item.variante})</span>` : ''}</div>
                    <div style="color:var(--accent); font-weight:800;">${STORE_CONFIG.currency}${sub}</div>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                    <button class="qty-btn" onclick="changeQty(${idx}, -1)" style="background:#64748b;">−</button>
                    <b style="min-width:25px; text-align:center;">${item.qty}</b>
                    <button class="qty-btn" onclick="changeQty(${idx}, 1)">+</button>
                </div>
            </div>`;
    }).join("");
    document.getElementById("cartTotal").innerText = STORE_CONFIG.currency + total;
    document.getElementById("cartCount").innerText = count;
}

function changeQty(idx, delta) {
    const item = cart[idx];
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) cart.splice(idx, 1);
    updateCartUI();
}

// ==================== AUTENTICACIÓN (Firebase Auth real) ====================

async function doLogin() {
    const u = document.getElementById("uInp").value.trim();
    const p = document.getElementById("pInp").value.trim();
    if (!u || !p) return alert("Completá usuario y contraseña");
    try {
        await auth.signInWithEmailAndPassword(toAuthEmail(u), p);
        closeAll();
    } catch (e) {
        console.error(e);
        alert("Usuario o contraseña incorrectos.");
    }
}

async function recuperarClave() {
    const u = document.getElementById("uInp").value.trim();
    if (!u.includes("@")) {
        return alert("Esta opción es para cuentas con email real (por ejemplo, la del administrador). Si sos cliente mayorista y olvidaste tu contraseña, pedile al administrador que te dé de alta de nuevo.");
    }
    try {
        await auth.sendPasswordResetEmail(u.toLowerCase());
        alert("Te enviamos un email para restablecer tu contraseña.");
    } catch (e) {
        console.error(e);
        alert("No pudimos enviar el email. Verificá que esté bien escrito.");
    }
}

function llenarPerfil(data) {
    document.getElementById("perfilContenido").style.display = "block";
    document.getElementById("perfilVacio").style.display = "none";
    document.getElementById("logoutBtn").style.display = "block";
    document.getElementById("p-user").innerText = data.user;
    document.getElementById("p-tel").innerText = data.tel || "--";
    document.getElementById("p-dir").innerText = data.dir || "Sin dirección registrada";
    document.getElementById("misPedidosList").innerHTML = ""; // se carga recién al tocar el botón
}

// Le muestra al cliente logueado sus propios pedidos (las reglas de
// Firestore solo dejan leer pedidos donde clienteUid == su propio uid).
// Los pedidos hechos antes de esta actualización no tienen ese campo, así
// que no van a aparecer acá — es una limitación de los datos viejos, no
// un error.
async function verMisPedidos() {
    if (!usuarioLogueado) return;
    const cont = document.getElementById("misPedidosList");
    cont.innerHTML = '<p style="opacity:0.5; text-align:center; padding:20px;">Cargando...</p>';
    try {
        const snap = await db.collection("pedidos").where("clienteUid", "==", usuarioLogueado.id).get();
        const propios = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.fecha - a.fecha);
        if (propios.length === 0) {
            cont.innerHTML = '<p style="opacity:0.5; text-align:center; padding:20px;">Todavía no hiciste ningún pedido.</p>';
            return;
        }
        cont.innerHTML = propios.map(o => `
            <div class="admin-item" style="flex-direction:column; align-items:flex-start;">
                <div class="flex-between" style="width:100%;">
                    <b style="color:var(--accent);">${o.total}</b>
                    <small>${new Date(o.fecha).toLocaleDateString('es-ES')}</small>
                </div>
                <div style="font-size:12px; opacity:0.7; white-space:pre-wrap; margin-top:6px;">${o.detalle}</div>
            </div>
        `).join('');
    } catch (e) {
        console.error(e);
        cont.innerHTML = '<p style="opacity:0.5; text-align:center; padding:20px;">No pudimos cargar tus pedidos.</p>';
    }
}

async function registrarUsuario() {
    const u = document.getElementById("rU").value.trim();
    const p = document.getElementById("rP").value.trim();
    const t = document.getElementById("rT").value.trim();
    const d = document.getElementById("rD").value.trim();
    if (!u || !p || !t || !d) return alert("Completá todos los campos");
    if (u.includes("@")) return alert("El nombre de usuario no puede contener '@'.");
    if (p.length < 6) return alert("La contraseña debe tener al menos 6 caracteres");

    try {
        const cred = await auth.createUserWithEmailAndPassword(toAuthEmail(u), p);
        await db.collection("usuarios").doc(cred.user.uid).set({
            user: u, tel: t, dir: d, activo: false, fecha: Date.now()
        });
        await auth.signOut(); // que no quede logueado hasta ser aprobado
        alert("✅ Solicitud enviada correctamente. Esperá la validación.");
        closeAll();
        document.querySelectorAll('#regModal input, #regModal textarea').forEach(i => i.value = "");
    } catch (e) {
        console.error(e);
        if (e.code === 'auth/email-already-in-use') alert("Ese nombre de usuario ya está en uso.");
        else if (e.code === 'auth/weak-password') alert("La contraseña es muy débil (mínimo 6 caracteres).");
        else alert("Error al enviar la solicitud.");
    }
}

// ==================== PRIMER INGRESO — CREAR CUENTA DE ADMINISTRADOR ====================
// No hay usuario/contraseña "de fábrica" en el código (sería inseguro:
// quedaría visible para cualquiera que vea el código fuente). En cambio,
// el dueño de la tienda crea su propia cuenta acá, protegida por dos
// candados: que su email coincida con el que se autorizó en Firestore
// (config/setup → allowedAdminEmail) y que lo verifique de verdad
// haciendo clic en el link que le llega por correo. Ver README.md →
// "Alta de un cliente nuevo".

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
        if (e.code === 'auth/email-already-in-use') alert("Ya existe una cuenta con ese email. Si es tuya, iniciá sesión normalmente desde 'Usuario (o email de administrador)'.");
        else alert("No pudimos crear la cuenta: " + (e.message || e));
    }
}

async function confirmarAdminVerificado() {
    if (!auth.currentUser) return alert("Se cerró la sesión. Volvé a intentar desde 'Crear cuenta'.");
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true); // refresca el token para que email_verified esté al día
    if (!auth.currentUser.emailVerified) {
        return alert("Todavía no verificaste tu email. Revisá tu bandeja de entrada (y spam) y volvé a intentar.");
    }
    try {
        await db.collection("admins").doc(auth.currentUser.uid).set({
            email: auth.currentUser.email, creado: Date.now()
        });
        alert("✅ ¡Listo! Ya sos administrador de esta tienda.");
        closeAll();
        document.getElementById("setupPaso1").style.display = "block";
        document.getElementById("setupPaso2").style.display = "none";
        document.getElementById("setupEmail").value = "";
        document.getElementById("setupPass").value = "";
    } catch (e) {
        console.error(e);
        alert("Ese email no está autorizado como administrador de esta tienda. Verificá con quien configuró el sitio que sea exactamente el mismo email cargado en Firestore.");
    }
}

// ==================== PANEL ADMIN — PRODUCTOS ====================

function renderAdmP() {
    const list = document.getElementById("admListP");
    list.innerHTML = prods.length === 0
        ? `<p style="text-align:center; padding:40px; opacity:0.4;">Aún no hay productos.</p>`
        : prods.map(p => {
            const firstImg = p.imagenes && p.imagenes.length > 0 ? p.imagenes[0] : (p.imagen || 'https://via.placeholder.com/70');
            return `
            <div class="admin-item">
                <img src="${firstImg}" class="admin-item-img" alt="${p.nombre}">
                <div style="flex:1;">
                    <b>${p.nombre}</b><br>
                    <small>${STORE_CONFIG.currency}${p.precio} (May: ${STORE_CONFIG.currency}${p.precio_may || p.precio})${p.tieneVariantes ? ' | Con variantes' : ` | Stock: ${p.stock}`}</small><br>
                    <span style="background:#334155; color:white; padding:2px 8px; border-radius:9999px; font-size:11px;">${p.categoria}</span>
                </div>
                <div>
                    <button onclick="editP('${p.id}')" style="font-size:18px; margin-right:8px; cursor:pointer; background:none; border:none;">✏️</button>
                    <button onclick="del('productos','${p.id}')" style="color:var(--danger); font-size:18px; cursor:pointer; background:none; border:none;">🗑️</button>
                </div>
            </div>
        `}).join("");
}

async function saveP() {
    const id = document.getElementById("fId").value;
    const nom = document.getElementById("fNom").value.trim();
    if (!nom) return alert("El nombre del producto es obligatorio");

    const imagenesRaw = document.getElementById("fImagenes").value.trim();
    const imagenes = imagenesRaw ? imagenesRaw.split('\n').map(u => u.trim()).filter(u => u) : [];

    // Variantes: una por línea, formato "Nombre | Stock" (ej: "M | 8")
    const variantesRaw = document.getElementById("fVariantes").value.trim();
    const variantesParsed = variantesRaw ? variantesRaw.split('\n').map(line => {
        const [nombreV, stockStr] = line.split('|').map(s => (s || '').trim());
        return nombreV ? { nombre: nombreV, stock: parseInt(stockStr) || 0 } : null;
    }).filter(Boolean) : [];

    const data = {
        nombre: nom,
        precio: parseFloat(document.getElementById("fPre").value) || 0,
        precio_may: parseFloat(document.getElementById("fPreMay").value) || 0,
        stock: parseInt(document.getElementById("fStock").value) || 0,
        promo: document.getElementById("fPro").value.trim(),
        categoria: document.getElementById("fCat").value.trim().toLowerCase(),
        imagenes: imagenes,
        descripcion: document.getElementById("fDesc").value.trim(),
        caracteristicas: document.getElementById("fCaract").value.trim(),
        ficha: document.getElementById("fFicha").value.trim(),
        tieneVariantes: variantesParsed.length > 0
    };

    try {
        let productId = id;
        if (id) {
            await db.collection("productos").doc(id).update(data);
        } else {
            const ref = await db.collection("productos").add(data);
            productId = ref.id;
        }

        // Sincronizar la subcolección de variantes: se reemplaza entera por los
        // valores actuales del formulario (que se precargan siempre con datos
        // en vivo desde editP, así que no se pisa stock real por accidente).
        const varCol = db.collection("productos").doc(productId).collection("variantes");
        const oldSnap = await varCol.get();
        const syncBatch = db.batch();
        oldSnap.forEach(doc => syncBatch.delete(doc.ref));
        variantesParsed.forEach((v, i) => {
            syncBatch.set(varCol.doc(), { nombre: v.nombre, stock: v.stock, orden: i });
        });
        await syncBatch.commit();

        limpiarP();
        alert("✅ Producto guardado correctamente");
    } catch (e) {
        console.error("Error Firebase:", e);
        alert("❌ Error al guardar el producto\n\n" + (e.message || e));
    }
}

function limpiarP() {
    document.getElementById("fId").value = "";
    document.getElementById("fNom").value = "";
    document.getElementById("fPre").value = "";
    document.getElementById("fPreMay").value = "";
    document.getElementById("fStock").value = "10";
    document.getElementById("fPro").value = "";
    if (document.getElementById("fCat").options.length) document.getElementById("fCat").selectedIndex = 0;
    document.getElementById("fVariantes").value = "";
    document.getElementById("fImagenes").value = "";
    document.getElementById("fDesc").value = "";
    document.getElementById("fCaract").value = "";
    document.getElementById("fFicha").value = "";
}

async function editP(id) {
    const p = prods.find(x => x.id === id);
    if (!p) return;
    document.getElementById("fId").value = p.id;
    document.getElementById("fNom").value = p.nombre || "";
    document.getElementById("fPre").value = p.precio || "";
    document.getElementById("fPreMay").value = p.precio_may || "";
    document.getElementById("fStock").value = p.stock !== undefined ? p.stock : 10;
    document.getElementById("fPro").value = p.promo || "";
    document.getElementById("fCat").value = p.categoria || "";

    // Manejar el array de imagenes de Firebase
    let imagesToFill = p.imagenes || [];
    if (imagesToFill.length === 0 && p.imagen) imagesToFill = [p.imagen];
    document.getElementById("fImagenes").value = imagesToFill.join('\n');

    document.getElementById("fDesc").value = p.descripcion || "";
    document.getElementById("fCaract").value = p.caracteristicas || "";
    document.getElementById("fFicha").value = p.ficha || "";

    // Traer las variantes en vivo desde Firestore (no desde caché) para no
    // pisar por accidente el stock real con datos viejos al guardar.
    const fVar = document.getElementById("fVariantes");
    fVar.value = p.tieneVariantes ? "Cargando..." : "";
    try {
        const snap = await db.collection("productos").doc(id).collection("variantes").orderBy("orden").get();
        fVar.value = snap.docs.map(d => `${d.data().nombre} | ${d.data().stock}`).join('\n');
    } catch (e) {
        console.error(e);
        fVar.value = "";
    }

    tab('t-prod');
    setTimeout(() => {
        const adminModalContent = document.querySelector('#adminModal');
        if(adminModalContent) adminModalContent.scrollTo({ top: 0, behavior: "smooth" });
    }, 200);
}

// ==================== PANEL ADMIN — CLIENTES ====================

function renderAdmU() {
    const list = document.getElementById("admListU");
    const pen = users.filter(u => !u.activo);
    const act = users.filter(u => u.activo);
    let html = `<h4 style="margin:0 0 15px 5px; opacity:0.6;">Solicitudes pendientes (${pen.length})</h4>`;
    if (pen.length === 0) html += `<p style="opacity:0.4; margin-left:10px;">No hay solicitudes pendientes.</p>`;
    html += pen.map(u => `
        <div class="admin-item" style="border-left:4px solid var(--promo); flex-direction:column; align-items:flex-start; gap:12px;">
            <div style="width:100%;">
                <b style="font-size:17px;">${u.user}</b>
                <div style="display:flex; gap:12px; margin-top:8px;">
                    <span style="background:#f59e0b; color:#000; padding:2px 10px; border-radius:9999px; font-size:11px; font-weight:700;">EN REVISIÓN</span>
                    <small>${new Date(u.fecha).toLocaleDateString('es-ES')}</small>
                </div>
            </div>
            <div style="width:100%; font-size:14px;">
                📱 <strong>${u.tel}</strong><br>
                📍 ${u.dir || 'Sin dirección'}
            </div>
            <button onclick="updU('${u.id}', true)" style="background:var(--success); padding:8px 20px; width:100%; cursor:pointer; border:none; border-radius:12px; color:white; font-weight:bold;">✅ Aprobar cliente</button>
        </div>
    `).join("");
    html += `<h4 style="margin:40px 0 15px 5px; opacity:0.6;">Clientes activos (${act.length})</h4>`;
    html += act.map(u => `
        <div class="admin-item">
            <div style="flex:1;">
                <b style="font-size:17px;">${u.user}</b><br>
                📱 <strong>${u.tel}</strong><br>
                📍 ${u.dir || 'Sin dirección'}
                <div style="margin-top:8px;">
                    <span style="background:#10b981; color:white; padding:2px 10px; border-radius:9999px; font-size:11px; font-weight:700;">ACTIVO</span>
                </div>
            </div>
            <button onclick="del('usuarios','${u.id}')" style="color:var(--danger); font-size:22px; align-self:center; background:none; border:none; cursor:pointer;">🗑️</button>
        </div>
    `).join("");
    list.innerHTML = html;
}

// ==================== PANEL ADMIN — PEDIDOS ====================

function renderAdmO() {
    const list = document.getElementById("admListO");
    if (orders.length === 0) {
        list.innerHTML = `<p style="text-align:center; padding:40px; opacity:0.4;">No hay pedidos aún.</p>`;
        return;
    }
    list.innerHTML = orders.map(o => `
        <div class="admin-item" style="flex-direction:column; align-items:flex-start;">
            <div class="flex-between" style="width:100%;">
                <b style="color:var(--accent);">${o.total}</b>
                <small>${new Date(o.fecha).toLocaleString('es-ES')}</small>
            </div>
            <div style="font-size:13px; white-space:pre-wrap; background:rgba(0,0,0,0.2); padding:10px; border-radius:10px; margin-top:8px; width:100%;">
                ${o.detalle}
            </div>
        </div>
    `).join("");
}

// Exporta el historial de pedidos como CSV (se abre directo en Excel/Sheets,
// sin depender de ninguna librería externa).
function exportarPedidosCSV() {
    if (orders.length === 0) return alert("No hay pedidos para exportar.");
    const filas = [["Fecha", "Total", "Cliente", "Detalle"]];
    orders.forEach(o => {
        filas.push([
            new Date(o.fecha).toLocaleString('es-ES'),
            o.total || '',
            o.clienteUser || 'Minorista',
            (o.detalle || '').replace(/\n/g, ' | ')
        ]);
    });
    const csv = filas.map(fila => fila.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM: que Excel reconozca tildes/ñ
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pedidos_${STORE_CONFIG.storeId}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ==================== PANEL ADMIN — ESTADÍSTICAS ====================
// Todo se calcula en el navegador a partir de los pedidos ya cargados
// (orders), sin servicios ni costos extra. Los pedidos guardados antes de
// esta actualización no tienen los campos nuevos (items/montoTotal/
// clienteUser), así que no aportan al detalle por producto/cliente, pero
// sí se cuentan en el total de pedidos e ingresos cuando se puede leer el
// monto desde el texto "total".

function getWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function calcularEstadisticas() {
    const stats = { totalPedidos: orders.length, ingresosTotales: 0, productosVendidos: {}, clientes: {}, porSemana: {} };
    orders.forEach(o => {
        const monto = typeof o.montoTotal === 'number' ? o.montoTotal : (parseFloat(String(o.total || '').replace(/[^\d.-]/g, '')) || 0);
        stats.ingresosTotales += monto;

        const cliente = o.clienteUser || 'Minorista';
        if (!stats.clientes[cliente]) stats.clientes[cliente] = { pedidos: 0, monto: 0 };
        stats.clientes[cliente].pedidos++;
        stats.clientes[cliente].monto += monto;

        (o.items || []).forEach(it => {
            const key = it.nombre + (it.variante ? ` (${it.variante})` : '');
            stats.productosVendidos[key] = (stats.productosVendidos[key] || 0) + it.qty;
        });

        const d = new Date(o.fecha);
        const semanaKey = `${d.getFullYear()}-S${getWeekNumber(d)}`;
        stats.porSemana[semanaKey] = (stats.porSemana[semanaKey] || 0) + monto;
    });
    return stats;
}

function renderAdmStats() {
    const cont = document.getElementById("admStats");
    if (!cont) return;
    const stats = calcularEstadisticas();
    const topProductos = Object.entries(stats.productosVendidos).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const topClientes = Object.entries(stats.clientes).sort((a, b) => b[1].monto - a[1].monto).slice(0, 10);
    const semanas = Object.entries(stats.porSemana).sort((a, b) => a[0] < b[0] ? 1 : -1).slice(0, 8);
    const vacio = (txt) => `<p style="opacity:0.4; padding:15px 5px;">${txt}</p>`;

    cont.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:10px;">
            <div class="admin-item" style="flex-direction:column; text-align:center;">
                <small style="opacity:0.5;">PEDIDOS TOTALES</small>
                <div style="font-size:26px; font-weight:800; color:var(--accent);">${stats.totalPedidos}</div>
            </div>
            <div class="admin-item" style="flex-direction:column; text-align:center;">
                <small style="opacity:0.5;">INGRESOS TOTALES</small>
                <div style="font-size:26px; font-weight:800; color:var(--success);">${STORE_CONFIG.currency}${stats.ingresosTotales.toFixed(0)}</div>
            </div>
        </div>

        <h4 style="opacity:0.6; margin: 25px 0 10px 5px;">Productos más vendidos</h4>
        ${topProductos.length === 0 ? vacio("Todavía no hay pedidos con detalle suficiente.") :
            topProductos.map(([nombre, qty]) => `
            <div class="admin-item"><div style="flex:1;">${nombre}</div><b style="color:var(--accent);">${qty} vendidos</b></div>
        `).join('')}

        <h4 style="opacity:0.6; margin: 30px 0 10px 5px;">Clientes más activos</h4>
        ${topClientes.length === 0 ? vacio("Todavía no hay datos suficientes.") :
            topClientes.map(([user, d]) => `
            <div class="admin-item"><div style="flex:1;">${user}</div><b>${d.pedidos} pedidos — ${STORE_CONFIG.currency}${d.monto.toFixed(0)}</b></div>
        `).join('')}

        <h4 style="opacity:0.6; margin: 30px 0 10px 5px;">Ingresos por semana</h4>
        ${semanas.length === 0 ? vacio("Todavía no hay datos suficientes.") :
            semanas.map(([semana, monto]) => `
            <div class="admin-item"><div style="flex:1;">${semana}</div><b>${STORE_CONFIG.currency}${monto.toFixed(0)}</b></div>
        `).join('')}
    `;
}

// ==================== PANEL ADMIN — SLIDER HERO ====================

function renderAdmSlider() {
    const list = document.getElementById("admListSlider");
    if (heroImages.length === 0) {
        list.innerHTML = `<p style="opacity:0.5; padding:30px; text-align:center;">No hay imágenes en el slider.</p>`;
        return;
    }
    list.innerHTML = heroImages.map(h => `
        <div class="admin-item">
            <img src="${h.url}" class="admin-item-img" alt="slide">
            <div style="flex:1;"><b>Imagen ${h.order + 1}</b></div>
            <button onclick="deleteHeroImage('${h.id}')" style="color:var(--danger); font-size:18px; cursor:pointer; background:none; border:none;">🗑️</button>
        </div>
    `).join("");
}

async function addHeroImage() {
    const url = document.getElementById("sliderUrl").value.trim();
    if (!url) return alert("Ingresa una URL válida");
    const order = heroImages.length;
    await db.collection("hero").add({ url: url, order: order });
    document.getElementById("sliderUrl").value = "";
    alert("Imagen agregada al slider");
}

async function deleteHeroImage(id) {
    if (confirm("¿Eliminar esta imagen del slider?")) {
        await db.collection("hero").doc(id).delete();
    }
}

// ==================== NAVEGACIÓN DEL PANEL / CATEGORÍAS ====================

function tab(id, e) {
    document.querySelectorAll("#t-prod, #t-user, #t-order, #t-slider, #t-stats").forEach(el => el.style.display = "none");
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.getElementById(id).style.display = "block";
    if (e && e.target) {
        e.target.classList.add("active");
    } else {
        const targetBtn = document.querySelector(`.tab-btn[onclick*="${id}"]`);
        if (targetBtn) targetBtn.classList.add("active");
    }
}

function setCat(el, cat) {
    filterCat = cat;
    document.querySelectorAll('.cat-item').forEach(item => item.classList.remove('active'));
    el.classList.add('active');
    render();
}

// ==================== CHECKOUT POR WHATSAPP ====================

async function finalizarYEnviar() {
    if (cart.length === 0) return alert("El carrito está vacío.");

    let textoPedido = `*📦 NUEVO PEDIDO — ${STORE_CONFIG.storeName.toUpperCase()}*\n`;
    if (usuarioLogueado) textoPedido += `*Cliente:* ${usuarioLogueado.user}\n*Local:* ${usuarioLogueado.dir || 'Sin dirección'}\n`;
    else textoPedido += `*Cliente:* Minorista\n`;
    textoPedido += `----------------------------\n`;

    const batch = db.batch();
    let montoTotalNumerico = 0;
    const itemsPedido = [];

    // Revalidamos el stock en vivo (no el que quedó cacheado en pantalla) y
    // armamos el batch de descuento. Para productos con variante, el
    // descuento se hace sobre el documento de esa variante puntual, no
    // sobre el producto.
    try {
        for (const item of cart) {
            const p = prods.find(x => x.id === item.id);
            if (!p) continue;

            const precioUnit = isMay ? (p.precio_may || p.precio) : p.precio;
            montoTotalNumerico += precioUnit * item.qty;
            itemsPedido.push({ id: p.id, nombre: p.nombre, qty: item.qty, variante: item.variante || null });

            if (item.variante) {
                const snap = await db.collection("productos").doc(p.id).collection("variantes")
                    .where("nombre", "==", item.variante).limit(1).get();
                if (snap.empty) return alert(`❌ La opción "${item.variante}" de ${p.nombre} ya no está disponible. Actualizá la página.`);
                const varDoc = snap.docs[0];
                const varData = varDoc.data();
                if (varData.stock < item.qty) return alert(`❌ Stock insuficiente para ${p.nombre} (${item.variante})`);
                textoPedido += `• ${p.nombre} — ${item.variante} [x${item.qty}]\n`;
                // Descontar stock de la variante. Las reglas de seguridad solo
                // dejan bajar este campo puntual (nunca nombre/precio/etc.).
                batch.update(varDoc.ref, { stock: varData.stock - item.qty });
            } else {
                if (p.stock < item.qty) return alert(`❌ Stock insuficiente para ${p.nombre}`);
                textoPedido += `• ${p.nombre} [x${item.qty}]\n`;
                // Descontar stock en Firebase. Las reglas de seguridad solo
                // dejan bajar este campo puntual, así que esto funciona
                // incluso para compradores sin cuenta.
                batch.update(db.collection("productos").doc(p.id), { stock: p.stock - item.qty });
            }
        }
    } catch (e) {
        console.error(e);
        return alert("No pudimos verificar el stock. Probá de nuevo.");
    }

    const total = document.getElementById("cartTotal").innerText;
    textoPedido += `----------------------------\n*TOTAL ESTIMADO: ${total}*`;

    try {
        await batch.commit(); // Ejecuta las actualizaciones de stock
        await db.collection("pedidos").add({
            detalle: textoPedido,
            total: total,
            fecha: Date.now(),
            montoTotal: montoTotalNumerico,
            clienteUid: usuarioLogueado ? usuarioLogueado.id : null,
            clienteUser: usuarioLogueado ? usuarioLogueado.user : null,
            items: itemsPedido
        });

        notificarPedidoPorEmail(textoPedido, total); // no bloquea ni rompe el checkout si falla

        window.open(`https://wa.me/${STORE_CONFIG.whatsappNumber}?text=${encodeURIComponent(textoPedido)}`);

        cart = [];
        updateCartUI();
        closeAll();
        alert("✅ Pedido enviado y stock actualizado");
    } catch(e) {
        console.error(e);
        alert("Error al procesar el pedido.");
    }
}

// ==================== UTILIDADES GENERALES ====================

async function del(col, id) {
    if (confirm("¿Eliminar este registro?")) {
        await db.collection(col).doc(id).delete();
    }
}

async function updU(id, stat) {
    await db.collection("usuarios").doc(id).update({activo: stat});
}

async function vaciarHistorial() {
    if (confirm("¿Borrar TODO el historial de pedidos?")) {
        const snap = await db.collection("pedidos").get();
        const batch = db.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        alert("Historial vaciado.");
    }
}

function toggleTheme() { document.body.classList.toggle("light"); }

function openModal(id) {
    closeAll();
    document.body.classList.add("no-scroll");
    document.getElementById(id).style.display = "flex";
}

function toggleInfo() {
    const d = document.getElementById("infoDrawer");
    d.classList.toggle("active");
    document.getElementById("ov").classList.toggle("active");
    document.body.classList.toggle("no-scroll", d.classList.contains("active"));
}

function toggleCart() {
    const d = document.getElementById("cartDrawer");
    d.classList.toggle("active");
    document.getElementById("ov").classList.toggle("active");
    document.body.classList.toggle("no-scroll", d.classList.contains("active"));
    updateCartUI();
}

function closeAll() {
    document.querySelectorAll(".modal").forEach(m => m.style.display = "none");
    document.querySelectorAll(".drawer").forEach(d => d.classList.remove("active"));
    document.getElementById("ov").classList.remove("active");
    document.body.classList.remove("no-scroll");
}

function logout() {
    if (confirm("¿Cerrar sesión?")) {
        auth.signOut().then(() => location.reload());
    }
}

function verificarAdmin() {
    if (esAdmin) {
        closeAll();
        openModal("adminModal");
    } else {
        closeAll();
        alert("Iniciá sesión con tu cuenta de administrador para acceder.");
        openModal("loginModal");
    }
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        const modal = document.getElementById("productDetailModal");
        if (modal && modal.style.display === "flex") closeProductDetail();
    }
});

window.onload = bootstrap;
