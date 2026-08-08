/* ============================================================================
   CONFIG.JS — Personalización de la tienda
   ----------------------------------------------------------------------------
   Este es el ÚNICO archivo que necesitás editar para adaptar la plantilla a un
   cliente/comercio nuevo. No hace falta tocar index.html, style.css ni app.js.

   Guía completa paso a paso para dar de alta un cliente nuevo: ver README.md
   ============================================================================ */

const STORE_CONFIG = {

  // --------------------------------------------------------------------
  // 1) IDENTIDAD DEL NEGOCIO
  // --------------------------------------------------------------------
  storeId: "mundo-tic",              // Interno, sin espacios/tildes (ej: "kiosco-juan")
  storeName: "Mundo Tic",
  tagline: "Equipamos tu mundo digital",
  city: "Santa Fe, Argentina",
  logoUrl: "log.png",                // Subí el logo del cliente a esta misma carpeta

  // --------------------------------------------------------------------
  // 2) TIPO DE NEGOCIO (referencia / documentación)
  //    No cambia el comportamiento por sí solo: lo que realmente prende y
  //    apaga funciones es el bloque "features" de más abajo. Este campo
  //    sirve para que vos y tus clientes sepan qué plantilla es cuál, y
  //    como punto de partida documentado en README.md → "Ejemplos por tipo
  //    de negocio" (kiosco / tienda de electrónica / mayorista-minorista).
  // --------------------------------------------------------------------
  businessType: "electronica",

  // --------------------------------------------------------------------
  // 3) CONTACTO Y REDES
  // --------------------------------------------------------------------
  whatsappNumber: "5493424063266",   // Código de país + número, sin '+' ni espacios
  instagramUrl: "https://www.instagram.com/mundo.tic/",   // dejar "" para ocultar el botón
  facebookUrl: "https://www.facebook.com/profile.php?id=61587552659399", // "" para ocultar

  // --------------------------------------------------------------------
  // 4) FUNCIONALIDADES — activar / desactivar según el negocio
  // --------------------------------------------------------------------
  features: {
    wholesalePricing: true,   // ¿Maneja precio mayorista además del minorista?
    stockControl: true,       // ¿Mostrar cantidad de stock disponible?
    heroSlider: true,         // ¿Mostrar el carrusel de imágenes arriba de todo?
    userRegistration: true,   // ¿Permitir que clientes se registren como mayoristas?
  },

  // --------------------------------------------------------------------
  // 5) CATEGORÍAS
  //    'id' se guarda en cada producto (sin espacios). 'label' es lo que
  //    ve el cliente. 'icon' es opcional (un emoji).
  // --------------------------------------------------------------------
  categories: [
    { id: "fundas",           icon: "📱", label: "Fundas" },
    { id: "cargadores",       icon: "🔌", label: "Cargadores" },
    { id: "bateria",          icon: "🔋", label: "Batería" },
    { id: "cables",           icon: "🔗", label: "Cables" },
    { id: "cabezales",        icon: "⚡", label: "Cabezales" },
    { id: "adaptadores",      icon: "🔄", label: "Adaptadores" },
    { id: "powerbank",        icon: "🔋", label: "Power Bank" },
    { id: "inalambrico",      icon: "📡", label: "Inalámbrico" },
    { id: "auricular_vincha", icon: "🎧", label: "Vincha" },
    { id: "auri_sin_cable",   icon: "🎧", label: "Sin cable" },
    { id: "auri_con_cable",   icon: "🎧", label: "Con cable" },
    { id: "smartwatch",       icon: "⌚", label: "Watch" },
    { id: "smartband",        icon: "⌚", label: "Band" },
    { id: "aro_luz",          icon: "💡", label: "Aro de luz" },
  ],

  // --------------------------------------------------------------------
  // 6) TEMA VISUAL — cada clave se convierte en variable CSS (--bg, --accent, etc.)
  // --------------------------------------------------------------------
  theme: {
    bg: "#0f172a",
    card: "#1e293b",
    text: "#f1f5f9",
    accent: "#3b82f6",
    success: "#10b981",
    promo: "#f59e0b",
    danger: "#ef4444",
    radius: "18px",
  },

  // --------------------------------------------------------------------
  // 7) MONEDA
  // --------------------------------------------------------------------
  currency: "$",

  // --------------------------------------------------------------------
  // 8) FIREBASE — credenciales DEL PROYECTO DE ESTE CLIENTE
  //    Cada cliente tiene su propio proyecto Firebase (100% aislado del
  //    resto). Ver README.md → "Alta de un cliente nuevo" para el
  //    paso a paso de dónde sacar estos valores y qué reglas de
  //    seguridad pegar (firestore.rules).
  //
  //    Nota: el apiKey de Firebase NO es un secreto — está pensado para
  //    viajar en el navegador. La seguridad real de los datos la dan las
  //    reglas de Firestore (firestore.rules), no ocultar esta clave.
  // --------------------------------------------------------------------
  firebase: {
    apiKey: "AIzaSyDAqlchDsLHIMMbv6YL2ipggaShXlFqiW8",
    authDomain: "tienda-online-baaf6.firebaseapp.com",
    projectId: "tienda-online-baaf6",
    storageBucket: "tienda-online-baaf6.firebasestorage.app",
    messagingSenderId: "121093097347",
    appId: "1:121093097347:web:ca8ea54b592cb20f5098b6"
  }
};
