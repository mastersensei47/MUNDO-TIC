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
  apiKey: "AIzaSyDAqlchDsLHIMMbv6YL2ipggaShXlFqiW8",
  authDomain: "tienda-online-baaf6.firebaseapp.com",
  projectId: "tienda-online-baaf6",
  storageBucket: "tienda-online-baaf6.firebasestorage.app",
  messagingSenderId: "121093097347",
  appId: "1:121093097347:web:ca8ea54b592cb20f5098b6"
};
