# Plantilla de Tienda Online — Sistema multi-tienda por slug

Sistema de e-commerce (catálogo + carrito + checkout por WhatsApp + panel de
administración) pensado para alojar **muchas tiendas distintas** (kioscos,
electrónica, mayoristas, etc.) **desde un solo sitio publicado**, cada una
accesible por su propio link (`.../?slug=nombre-tienda`).

Cada tienda tiene su **propio proyecto de Firebase, 100% aislado del resto**
— sus productos, clientes y pedidos nunca se mezclan con los de otra tienda.
Lo único centralizado es un pequeño "directorio" que sabe, para cada slug,
a qué proyecto de Firebase conectarse.

Corre 100% en el navegador (HTML + CSS + JS), sin backend propio.

## Estructura de archivos

```
index.html            La tienda en sí. Sirve a TODOS los clientes según ?slug=
style.css              Estilos (compartido, no hace falta tocarlo)
app.js                  Lógica de la tienda (compartida, no hace falta tocarlo)
config.js               Conexión al proyecto MASTER (fijo, igual para todos)
firestore.rules         Reglas de seguridad — se pegan en CADA proyecto cliente
master-admin.html       Panel para dar de alta tiendas nuevas en el directorio
master-admin.js         Lógica del panel master
firestore.master.rules  Reglas de seguridad del proyecto MASTER (uno solo)
log.png                 Logo de referencia/placeholder
```

Ya no existe "un archivo config.js por cliente": ahora hay **un solo
despliegue** de `index.html`/`app.js`/`config.js`, y cada tienda se
distingue por el slug de la URL. La marca, categorías, tema, etc. de cada
tienda viven dentro de su propio Firebase (no en ningún archivo).

---

## Cómo funciona el sistema multi-tienda por slug

Cuando alguien abre `tusitio.com/?slug=mundo-tic`, en ese orden:

1. El sitio (siempre el mismo `index.html`/`app.js`) lee `mundo-tic` de la URL.
2. Se conecta al proyecto **master** (el directorio; sus credenciales están
   fijas en `config.js`) y le pregunta *"¿a qué Firebase corresponde el
   slug mundo-tic?"*.
3. El master le devuelve el `firebaseConfig` del proyecto de **ese
   cliente puntual**, guardado ahí por vos desde el panel `master-admin.html`.
4. El sitio se conecta a ESE proyecto (el del cliente) y recién ahí carga
   productos, clientes, pedidos, login — todo específico de esa tienda.
5. Además trae un documento `config/tienda` **del propio Firebase del
   cliente** con su marca, categorías, tema, WhatsApp, etc.

Si la URL no trae `?slug=`, o el slug no existe en el directorio, se
muestra un aviso ("No pudimos abrir esta tienda") en vez de romperse.

**Qué queda centralizado:** solo el mapeo *slug → firebaseConfig* (y el
nombre del comercio, para mostrarlo en el panel master). Nada de productos,
clientes, pedidos, ni contraseñas.

**Qué queda 100% aislado por cliente:** todo lo demás — su Firestore, su
Authentication, sus productos, sus pedidos, su configuración de marca.

**Trade-off a tener en cuenta:** al ser un solo sitio publicado para todos
los clientes, un error en una actualización del `app.js` compartido puede
afectar a todas las tiendas a la vez (antes, con un sitio por cliente, un
error solo afectaba al que estabas tocando). Probá los cambios antes de
publicarlos.

---

## Alta del proyecto MASTER (una sola vez)

Esto se hace **una única vez en la vida** del sistema, no por cada cliente.

1. Creá un proyecto de Firebase nuevo en
   [console.firebase.google.com](https://console.firebase.google.com),
   dedicado exclusivamente a ser el directorio (ej. llamalo
   `mi-plataforma-master`).
2. Habilitá **Authentication → Sign-in method → Email/Password**.
3. Creá **Firestore Database** en modo producción.
4. Pegá el contenido de `firestore.master.rules` en la pestaña **Reglas** →
   **Publicar**.
5. Firestore → colección `config` → documento con ID personalizado `setup`
   → campo `allowedAdminEmail` (string) = tu propio email (el de quien va a
   administrar el directorio de tiendas).
6. Configuración del proyecto → Tus apps → **</> (Web)** → registrá una app
   → copiá esas 6 credenciales dentro de `config.js`, en
   `MASTER_FIREBASE_CONFIG`.
7. Subí `master-admin.html`, `master-admin.js`, `config.js` y `style.css`
   a tu hosting (junto con el resto, ver el paso de publicación más abajo).
8. Abrí `tusitio.com/master-admin.html` → **"¿Primera vez? Configurar
   acceso"** → completá tu email (el mismo del paso 5) y una contraseña →
   verificá tu email → ya podés dar de alta tiendas.

> `master-admin.html` no está enlazado desde ninguna parte del sitio
> público — solo quien tenga la URL exacta llega a esa pantalla, y encima
> pide login. Es una capa extra, no la única: la seguridad real la dan las
> reglas y la verificación de email.

---

## Alta de un cliente nuevo — paso a paso

### 1. Crear el proyecto de Firebase del cliente
En [console.firebase.google.com](https://console.firebase.google.com) →
**Agregar proyecto** → nombralo como ese comercio.

### 2. Habilitar el login (Authentication)
**Authentication → Sign-in method → Email/Password** → habilitar. Sin este
paso el login no va a funcionar (error `auth/operation-not-allowed`).

### 3. Crear la base de datos (Firestore)
**Firestore Database → Crear base de datos** → modo **producción** →
ubicación más cercana (ej. `southamerica-east1`).

### 4. Pegar las reglas de seguridad de ESE cliente
Firestore Database → pestaña **Reglas** → pegá el contenido completo de
`firestore.rules` (no `firestore.master.rules`, ese es solo para el
proyecto master) → **Publicar**.

### 5. Registrar la tienda en el directorio (panel master)
Configuración del proyecto → Tus apps → **</> (Web)** → registrá una app →
copiá esas 6 credenciales. Andá a `tusitio.com/master-admin.html`, iniciá
sesión, y en **"Agregar tienda nueva"** completá el nombre del comercio, el
slug que va a tener en la URL (ej. `kiosco-don-juan`) y esas 6 credenciales
→ **Guardar tienda**. Copiá el link que te muestra — es la URL final de
esa tienda.

> Desde esa misma lista podés **buscar** una tienda por nombre o slug (con
> contador de resultados), **editarla** (✏️ — incluso cambiar el slug, que
> internamente borra el documento viejo y crea uno nuevo), **pausarla**
> (⏸️ — el link deja de funcionar sin borrar nada) o **eliminarla del
> directorio** (🗑️ — esto NO borra el proyecto de Firebase del cliente ni
> sus datos, solo la saca de la lista).

### 6. Autorizar el email del administrador de esa tienda
En el Firestore **de ese cliente** (no en el master): colección `config` →
documento con ID personalizado `setup` → campo `allowedAdminEmail` (string)
= email real del dueño de ese negocio → **Guardar**.

### 7. El dueño crea su cuenta de administrador (desde el sitio)
El dueño abre el link de su tienda (el del paso 5) → ícono ⚙️ → como
todavía no hay ningún administrador para esa tienda, aparece el link **"¿Sos
el administrador y todavía no tenés cuenta?"** → completa su email (el
mismo del paso 6) y una contraseña a elección → verifica por correo → listo,
desde ahora entra con ese email y contraseña, y el ⚙️ le abre el panel
directo. Si alguien lo intenta con un email distinto, el sistema lo
rechaza sin dar pistas.

### 8. Cargar la configuración inicial de esa tienda
Con la cuenta de administrador ya creada (paso 7), una parte se completa
directo desde el panel (⚙️ → **CONFIGURACIÓN**): WhatsApp, dirección,
horarios, redes sociales, pausa/banner, medios de pago, logo, colores y
tema rápido.

Lo que **todavía** hay que cargar a mano en el Firestore de ese cliente
(colección `config` → documento `tienda`), porque no tiene pantalla propia
todavía — ver ejemplos en "Ejemplos de configuración por tipo de negocio"
más abajo: `storeName`, `tagline`, `city`, `businessType`, `currency`,
`categories`, y las funciones de `features` que no están en el panel
(`wholesalePricing`, `stockControl`, `userRegistration`, `productVariants`).

> `logoUrl` tiene que ser una **URL pública completa** (no un archivo local
> como antes), porque ahora el sitio es uno solo para todos los clientes.
> Subí el logo a Firebase Storage del propio cliente, a un servicio como
> Imgur, o a donde prefieras, y pegá esa URL en el panel. Si lo dejás
> vacío, se muestra el nombre del comercio en texto.

### 9. Listo
No hace falta publicar nada nuevo: el sitio ya está corriendo (es el mismo
para todos los clientes) y esta tienda ya responde en
`tusitio.com/?slug=el-slug-que-elegiste`.

## Cómo publicar el sitio (una sola vez para todo el sistema)

Como ahora hay un solo despliegue para todos los clientes, esto se hace
**una vez**, no por cada cliente. La forma más simple es **Firebase
Hosting** del proyecto master (gratis):

```bash
npm install -g firebase-tools
firebase login
firebase init hosting     # elegí el proyecto MASTER, y esta carpeta como public
firebase deploy
```

También funciona cualquier hosting estático (Netlify, GitHub Pages,
Vercel, etc.) — subí toda la carpeta (`index.html`, `style.css`, `app.js`,
`config.js`, `master-admin.html`, `master-admin.js`, `log.png`) tal cual.

---

## Qué cambió respecto a la versión original

La versión original guardaba las contraseñas de los clientes en texto plano
en la base de datos (visibles para cualquiera desde la consola del
navegador) y usaba una clave de administrador fija escrita en el código
(`admin` / `admin`). Esta plantilla reemplaza todo eso por **Firebase
Authentication real**: nadie puede ver ni comparar contraseñas desde el
cliente, y quién es administrador se decide del lado del servidor (reglas
de Firestore), no en el JavaScript que cualquiera puede leer. Como efecto
secundario positivo, la sesión ahora queda guardada entre visitas.

---

## Variantes de producto (talle / color)

Pensado para indumentaria y calzado: un producto puede tener opciones
(talle, color, lo que sea) con **stock propio por opción**. Un producto sin
variantes sigue funcionando exactamente igual que antes.

**Para activarlo:** `features.productVariants: true` en el documento
`config/tienda` de esa tienda. Mientras esté en `false` (el valor por
defecto), el campo ni aparece en el panel admin.

**Para cargarlas:** en el formulario de producto del panel admin va a
aparecer un campo "Variantes (opcional)" — una opción por línea, con el
formato `Nombre | Stock`:
```
S | 5
M | 8
L | 0
XL | 3
```
Si ese campo queda vacío, el producto se maneja con el stock general de
siempre (el campo "Stock disponible" de más arriba).

**Limitación conocida:** el precio es el mismo para todas las variantes de
un producto. Si en el futuro hace falta precio por variante, es la
próxima mejora natural sobre esta base.

## Notificación automática de pedidos

Por defecto, el admin se entera de un pedido nuevo porque el cliente abre
WhatsApp y se lo envía — eso sigue funcionando siempre. Si además querés
un **email automático apenas entra un pedido**, activalo con
[EmailJS](https://www.emailjs.com) (gratis hasta 200 emails/mes, sin
backend propio).

> **¿Y WhatsApp Business API automática?** Existe, pero requiere backend
> propio y una cuenta paga con un proveedor (Meta Cloud API, Twilio,
> 360dialog, etc.) — no es algo que se pueda hacer solo con HTML/JS. El
> email por EmailJS cubre el mismo objetivo gratis y sin backend.

**Paso a paso:**

1. Creá una cuenta gratis en [emailjs.com](https://www.emailjs.com).
2. **Email Services** → conectá tu cuenta de Gmail/Outlook → anotá el
   **Service ID**.
3. **Email Templates** → creá un template con las variables `{{to_email}}`,
   `{{tienda}}`, `{{total}}`, `{{mensaje}}` → anotá el **Template ID**.
4. **Account** → copiá tu **Public Key**.
5. (Recomendado) **Account → Security** → agregá el dominio de tu sitio en
   "Allowed origins".
6. En el documento `config/tienda` **de esa tienda** (en su propio
   Firestore), completá el bloque `notifications`:
   ```js
   notifications: {
     emailEnabled: true,
     emailJsServiceId: "service_xxxxxxx",
     emailJsTemplateId: "template_xxxxxxx",
     emailJsPublicKey: "tu_public_key",
     adminEmail: "tu_email@ejemplo.com",
   }
   ```

Si falla el envío, el pedido no se pierde: sigue guardado en Firestore y
yéndose por WhatsApp igual — el email es un aviso extra.

## Buscador con sugerencias

Al escribir en el buscador aparece un desplegable con hasta 6 productos
sugeridos (con foto). Prioriza coincidencias directas; si no encuentra
ninguna y el texto tiene 3 letras o más, prueba tolerando un par de
errores de tipeo. Todo corre en el navegador, sin servicios externos.

## Panel de estadísticas (admin)

Pestaña **ESTADÍSTICAS** en el panel admin: pedidos totales, ingresos
totales, productos más vendidos, clientes más activos e ingresos por
semana. Se calcula al momento a partir de los pedidos ya cargados, sin
costo ni configuración extra.

> Los pedidos hechos **antes** de esta actualización no tienen el detalle
> por producto/cliente, así que no van a aparecer en "productos más
> vendidos" ni en "clientes más activos" — sí se cuentan en el total de
> pedidos e ingresos.

## Exportar pedidos a Excel

Botón **"Exportar a Excel"** en la pestaña HISTORIAL del panel admin.
Descarga un `.csv` (fecha, total, cliente, detalle) que se abre directo en
Excel o Google Sheets.

## Historial de compras para el cliente

Un cliente mayorista logueado tiene un botón **"Ver mis pedidos"** en su
perfil (ícono ☰). Las reglas de Firestore solo dejan que cada uno vea los
suyos. Los pedidos de antes de esta actualización no van a aparecer acá.

## Panel de configuración de la tienda

Pestaña **CONFIGURACIÓN** en el panel admin — edita el documento
`config/tienda` sin tocar Firestore a mano. Está organizada en 4 bloques:

**Datos generales y de contacto**
- WhatsApp para pedidos (el mismo que usa el checkout).
- Dirección del local y horarios de atención — se muestran en el panel de
  info (ícono ☰) solo si están cargados.
- Instagram, Facebook y TikTok (URLs completas) — cada ícono se muestra u
  oculta solo según si está cargado.

**Estado de la tienda**
- **Pausar tienda**: oculta el ícono del carrito y muestra un banner rojo
  arriba de todo ("La tienda no está recibiendo pedidos"). El checkout
  también queda bloqueado del lado del servidor por las dudas, no solo
  oculto visualmente.
- **Banner de aviso**: un cartel arriba de todo con el texto que quieras
  (ej. "Envíos gratis +$20.000"). Si la tienda está pausada, el banner de
  pausa tiene prioridad y el de aviso no se muestra.

**Medios de pago aceptados**
- Efectivo, transferencia bancaria (con un campo para CBU/Alias/Titular) y
  Mercado Pago — tildá los que aceptás. Si hay más de uno activo, el
  cliente elige cuál va a usar antes de enviar el pedido por WhatsApp; si
  hay uno solo, se usa directo sin preguntar. Si eligió transferencia, los
  datos para transferir van incluidos en el mensaje de WhatsApp.
- Esto es solo informativo/organizativo — no hay integración de cobro real
  con Mercado Pago (eso sigue siendo una idea a futuro, ver más abajo).

**Experiencia visual**
- **Logo**: URL de la imagen. Si lo dejás vacío, se muestra el nombre del
  comercio en texto grande en vez de un logo roto.
- **Tema rápido**: elegí "Tema Oscuro", "Tema Claro" o "Tema Neón" para
  aplicar una combinación de colores completa de una sola vez (podés
  ajustar el color principal y de fondo a mano después).
- **Colores** (accent / fondo) y **secciones** (Hero / Mapa) como antes.

## Cómo carga productos el dueño de la tienda

Logueado como administrador: ícono ⚙️ → pestaña **PRODUCTOS** → completar
el formulario → **GUARDAR PRODUCTO**. Los clientes mayoristas que se
registren aparecen en **CLIENTES**, pendientes de aprobación.

---

## Ejemplos de configuración por tipo de negocio

Estos son puntos de partida para el documento `config/tienda` de cada
cliente (Firestore → esa tienda → colección `config` → documento `tienda`).

**Kiosco / almacén** — sin precio mayorista, categorías simples:
```js
businessType: "kiosco",
features: {
  wholesalePricing: false,
  stockControl: true,
  heroSlider: false,
  userRegistration: false,
},
categories: [
  { id: "golosinas",  icon: "🍬", label: "Golosinas" },
  { id: "bebidas",    icon: "🥤", label: "Bebidas" },
  { id: "cigarrillos",icon: "🚬", label: "Cigarrillos" },
  { id: "limpieza",   icon: "🧴", label: "Limpieza" },
  { id: "almacen",    icon: "🛒", label: "Almacén" },
]
```

**Mayorista / minorista puro** — el foco está en el precio diferenciado:
```js
businessType: "mayorista_minorista",
features: {
  wholesalePricing: true,
  stockControl: true,
  heroSlider: true,
  userRegistration: true,
}
```

**Tienda de electrónica** (como Mundo Tic) — fundas, cargadores,
auriculares, etc.

**Indumentaria / calzado** — con variantes de talle activadas:
```js
businessType: "indumentaria",
features: {
  wholesalePricing: true,
  stockControl: true,
  heroSlider: true,
  userRegistration: true,
  productVariants: true,
},
categories: [
  { id: "remeras",   icon: "👕", label: "Remeras" },
  { id: "pantalones",icon: "👖", label: "Pantalones" },
  { id: "camperas",  icon: "🧥", label: "Camperas" },
  { id: "calzado",   icon: "👟", label: "Calzado" },
]
```

---

## Notas de seguridad y limitaciones conocidas

- **Directorio de tiendas (proyecto master)**: cualquiera puede resolver un
  slug puntual que ya conoce (necesario para que la web funcione), pero
  **nadie puede listar/enumerar todas las tiendas** salvo el master-admin
  — así nadie puede bajar de un saque la lista completa de tus clientes.
- **`master-admin.html` no está enlazado** desde ningún lado del sitio
  público, y además pide login con el mismo doble candado (email
  autorizado + verificado) que cada tienda. No compartas esa URL
  públicamente.
- **Sitio compartido entre todos los clientes**: un bug en una
  actualización del `app.js` compartido puede afectar a todas las tiendas
  a la vez. Cada tienda sigue teniendo sus DATOS 100% aislados (eso no
  cambia), pero el CÓDIGO que corre es el mismo para todas.
- **Contraseñas de clientes mayoristas**: como se registran con un nombre
  de usuario (no un email real), esas cuentas usan un email interno
  inventado — no hay recuperación de contraseña por correo para ellas. El
  administrador de cada tienda sí usa su email real y puede recuperar su
  contraseña normalmente.
- **Descuento de stock sin login**: para que el checkout por WhatsApp
  descuente stock sin backend propio, las reglas dejan que cualquier
  visitante reduzca (nunca aumente) el stock de un producto. Compromiso
  razonable para un comercio chico; el siguiente paso de robustez es una
  Cloud Function (requiere plan Blaze).
- **Sin protección anti-bots** (reCAPTCHA / Firebase App Check) en el alta
  de pedidos o registros. Próxima capa si el sitio recibe mucho tráfico.
- **Cambiar el administrador de una tienda o del master**: no se puede
  hacer desde la web a propósito — hay que borrar el documento en
  `admins` y actualizar `allowedAdminEmail` desde la consola de Firebase
  del proyecto correspondiente.

## Ideas para más adelante (no incluidas todavía)

- Pantalla en el panel admin para editar `storeName`, `categories` y el
  resto de `features` sin tocar Firestore a mano (hoy ya se puede editar
  contacto, pausa/banner, medios de pago, logo y tema desde el panel — ver
  "Panel de configuración de la tienda").
- Cobro real con Mercado Pago (Checkout Pro) — hoy "Mercado Pago" como
  medio de pago es solo informativo, el cliente igual coordina el pago por
  fuera del sitio.
- Precio distinto por variante (hoy todas las variantes de un producto
  comparten el mismo precio).
- Notificación automática por WhatsApp Business API real (hoy es por
  email vía EmailJS).
- Cantidad mínima de compra para clientes mayoristas.
- Cupones de descuento.
