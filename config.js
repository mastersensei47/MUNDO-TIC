/* ============================================================================
   CONFIG.JS — Conexión al proyecto MASTER (directorio de tiendas)
   ----------------------------------------------------------------------------
   Este archivo es IGUAL para todos los clientes: ya no es un archivo "por
   cliente" como en la versión anterior. Apunta siempre al mismo proyecto
   "master" (el que contiene el directorio slug → firebaseConfig de cada
   tienda).

   La marca, categorías, tema, WhatsApp, etc. de CADA tienda ya no viven acá:
   viven en el propio Firestore de esa tienda (colección "config", documento
   "tienda"), y se resuelven dinámicamente según el ?slug= de la URL. Ver
   README.md → "Sistema multi-tienda por slug".

   Para dar de alta el proyecto master (se hace UNA sola vez, no por cada
   cliente): ver README.md → "Alta del proyecto master".
   ============================================================================ */

const MASTER_FIREBASE_CONFIG = {
  apiKey: "AIzaSyD_uELDR3InLuRlsxXCyFuIM4OzYw6xYkE",
  authDomain: "tienda-c497e.firebaseapp.com",
  projectId: "tienda-c497e",
  storageBucket: "tienda-c497e.firebasestorage.app",
  messagingSenderId: "709484748527",
  appId: "1:709484748527:web:64dbea8f89b02b830a851a",
  measurementId: "G-CCNPEMM8WG"
};

// Opciones de arranque de la tienda.
// Si el link no trae ?slug= y no hay un slug guardado en este navegador,
// la tienda intentará resolver automáticamente la única tienda activa del
// directorio Master. Si hay varias, se informa claramente y se pide el link.
const DEFAULT_STORE_SLUG = "";
const AUTO_DISCOVER_SINGLE_STORE = true;
