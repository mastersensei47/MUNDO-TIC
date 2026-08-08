// ============================================================================
// APP.JS — Lógica de la tienda (no debería hacer falta tocar este archivo
// para dar de alta un cliente nuevo; toda la personalización vive en config.js)
// ============================================================================

// ==================== FIREBASE ====================
// Las credenciales viven en config.js (STORE_CONFIG.firebase), así cada
// cliente tiene su propio proyecto sin tocar este archivo.
firebase.initializeApp(STORE_CONFIG.firebase);
const db = firebase.firestore();
const auth = firebase.auth();

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
// email interno con el storeId como dominio ficticio.
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
    document.querySelectorAll("#t-prod, #t-user, #t-order, #t-slider").forEach(el => el.style.display = "none");
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

    // Revalidamos el stock en vivo (no el que quedó cacheado en pantalla) y
    // armamos el batch de descuento. Para productos con variante, el
    // descuento se hace sobre el documento de esa variante puntual, no
    // sobre el producto.
    try {
        for (const item of cart) {
            const p = prods.find(x => x.id === item.id);
            if (!p) continue;

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
        await db.collection("pedidos").add({ detalle: textoPedido, total: total, fecha: Date.now() });

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

window.onload = init;
