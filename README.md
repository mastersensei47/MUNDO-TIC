# Plantilla de Tienda Online

Plantilla reutilizable de e-commerce (catálogo + carrito + checkout por WhatsApp +
panel de administración), pensada para armar sitios a medida para distintos
comercios (kioscos, tiendas de electrónica, mayoristas, etc.) sin reprogramar
cada vez. Cada cliente tiene su propio sitio y su propia base de datos
100% aislada del resto.

Corre 100% en el navegador (HTML + CSS + JS) contra un proyecto de
[Firebase](https://firebase.google.com) (Firestore + Authentication), sin
backend propio.

## Estructura de archivos

```
index.html         Estructura de la página (no hace falta tocarlo)
style.css           Estilos (no hace falta tocarlo)
app.js               Lógica de la app (no hace falta tocarlo)
config.js            👉 EL ÚNICO ARCHIVO QUE EDITÁS POR CADA CLIENTE
firestore.rules      Reglas de seguridad (se pegan en la consola de Firebase)
log.png              Logo de ejemplo (reemplazar por el del cliente)
```

Dar de alta un cliente nuevo = crear un proyecto de Firebase (checklist de
5 minutos, más abajo) + editar `config.js` + subir la carpeta a un hosting.
Nunca hace falta tocar `index.html`, `style.css` ni `app.js`.

## Qué cambió respecto a la versión original

La versión original guardaba las contraseñas de los clientes en texto plano
en la base de datos (visibles para cualquiera desde la consola del
navegador) y usaba una clave de administrador fija escrita en el código
(`admin` / `admin`). Esta plantilla reemplaza todo eso por **Firebase
Authentication real**: nadie puede ver ni comparar contraseñas desde el
cliente, y quién es administrador se decide del lado del servidor (reglas de
Firestore), no en el JavaScript que cualquiera puede leer.

Como efecto secundario positivo: ahora la sesión queda guardada entre
visitas (antes había que loguearse de nuevo cada vez que se refrescaba la
página).

---

## Alta de un cliente nuevo — paso a paso

### 1. Crear el proyecto de Firebase
En [console.firebase.google.com](https://console.firebase.google.com) →
**Agregar proyecto** → ponele el nombre del cliente → seguí los pasos
(podés desactivar Google Analytics, no hace falta).

### 2. Habilitar el login (Authentication)
Menú lateral → **Authentication** → **Comenzar** → pestaña **Sign-in
method** → habilitar el proveedor **Email/Password**. Sin este paso el
login no va a funcionar (error `auth/operation-not-allowed`).

### 3. Crear la base de datos (Firestore)
Menú lateral → **Firestore Database** → **Crear base de datos** → elegí
**modo producción** (no "modo de prueba", que abre todo por 30 días) →
elegí la ubicación del servidor más cercana (ej. `southamerica-east1`).

### 4. Pegar las reglas de seguridad
Dentro de Firestore Database → pestaña **Reglas** → borrá lo que haya y
pegá el contenido completo de `firestore.rules` (incluido en esta
plantilla) → **Publicar**.

### 5. Copiar las credenciales a config.js
Ícono de engranaje (⚙️) → **Configuración del proyecto** → bajá hasta "Tus
apps" → **</> (Web)** → registrá una app → Firebase te muestra un bloque
`firebaseConfig`. Copiá esos 6 valores dentro de `config.js`, en la sección
`firebase: { ... }`.

> Nota: ese `apiKey` no es un secreto — está pensado para viajar en el
> navegador. Lo que protege los datos de verdad son las reglas del paso 4.

### 6. Autorizar el email del administrador
Firestore Database → pestaña **Datos** → **Iniciar colección** → ID de la
colección: `config` → en "ID del documento" elegí **ID personalizado** y
escribí `setup` → agregale un campo `allowedAdminEmail` (string) con el
**email real** del dueño del negocio → **Guardar**.

Este paso reemplaza tener que crear la cuenta a mano y copiar un UID: solo
estás autorizando de antemano CUÁL email va a poder convertirse en
administrador. La cuenta la crea el propio dueño en el paso siguiente,
eligiendo su propia contraseña (nunca la sabés vos ni queda en el código).

### 7. El dueño crea su cuenta de administrador (desde el sitio)
Con el sitio ya publicado, el dueño del negocio abre el ícono ⚙️ → como
todavía no hay ningún administrador, se le ofrece el link **"¿Sos el
administrador y todavía no tenés cuenta?"** → completa su email (el
**mismo** que autorizaste en el paso 6) y una contraseña a elección →
**Crear cuenta**. Le llega un email de verificación de Firebase: lo abre,
hace clic en el link, vuelve a la web y toca **"Ya verifiqué mi email"**.
Listo — desde ese momento entra con ese email y esa contraseña siempre que
quiera, y el ícono ⚙️ le abre el panel directamente.

Si alguien intenta este mismo camino con un email distinto al autorizado,
el sistema lo rechaza (no le da acceso, ni deja pistas de cuál es el email
correcto).

### 8. Completar el resto de config.js
Nombre del negocio, WhatsApp, redes, categorías, colores, tipo de negocio
y qué funciones activar — todo está comentado dentro de `config.js`. Ver
también la sección "Ejemplos por tipo de negocio" más abajo.

### 9. Reemplazar el logo
Subí el archivo del logo del cliente a la misma carpeta (reemplazando
`log.png`, o con otro nombre siempre que actualices `logoUrl` en
`config.js`).

### 10. Publicar
La forma más simple es **Firebase Hosting** (gratis, del mismo proyecto):

```bash
npm install -g firebase-tools
firebase login
firebase init hosting     # elegí "usar un proyecto existente" y esta carpeta como public
firebase deploy
```

También funciona en cualquier hosting estático (Netlify, GitHub Pages,
Vercel, un hosting compartido tradicional, etc.) — es HTML/CSS/JS puro,
no necesita ningún servidor especial.

---

## Variantes de producto (talle / color)

Pensado para indumentaria y calzado: un producto puede tener opciones (talle,
color, lo que sea) con **stock propio por opción**. Un producto sin
variantes sigue funcionando exactamente igual que antes.

**Para activarlo:** en `config.js` → `features.productVariants: true`.
Mientras esté en `false` (el valor por defecto), el campo ni aparece en el
panel admin.

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
un producto (no se puede cobrar distinto por talle, por ejemplo). Si en el
futuro hace falta precio por variante, es la próxima mejora natural sobre
esta base.

## Notificación automática de pedidos

Por defecto, el admin se entera de un pedido nuevo porque el cliente abre
WhatsApp y se lo envía — eso sigue funcionando siempre. Pero si además
querés que te llegue un **email automático apenas entra un pedido** (sin
depender de que el cliente complete ese paso), podés activarlo con
[EmailJS](https://www.emailjs.com), un servicio que manda emails desde el
navegador sin necesitar backend propio (gratis hasta 200 emails/mes).

> **¿Y WhatsApp Business API automática?** Existe, pero requiere un backend
> propio y una cuenta paga con un proveedor (Meta Cloud API, Twilio,
> 360dialog, etc.) — no es algo que se pueda hacer solo con HTML/JS como el
> resto de esta plantilla. Si en algún momento hace falta de verdad, es un
> proyecto aparte. El email por EmailJS cubre el mismo objetivo (que te
> enteres sin depender del cliente) de forma gratuita y sin backend.

**Paso a paso:**

1. Creá una cuenta gratis en [emailjs.com](https://www.emailjs.com).
2. **Email Services** → conectá tu cuenta de Gmail/Outlook/la que uses →
   anotá el **Service ID**.
3. **Email Templates** → creá un template nuevo con estas variables (así
   coinciden con lo que manda la plantilla): `{{to_email}}`, `{{tienda}}`,
   `{{total}}`, `{{mensaje}}` → anotá el **Template ID**.
4. **Account** → copiá tu **Public Key**.
5. (Recomendado) **Account** → **Security** → agregá el dominio de tu sitio
   publicado en "Allowed origins", para que nadie más pueda usar tu cuenta
   de EmailJS desde otro sitio.
6. En `config.js`, completá el bloque `notifications`:
   ```js
   notifications: {
     emailEnabled: true,
     emailJsServiceId: "service_xxxxxxx",
     emailJsTemplateId: "template_xxxxxxx",
     emailJsPublicKey: "tu_public_key",
     adminEmail: "tu_email@ejemplo.com",
   },
   ```

Si falla el envío del email (por ejemplo, mala configuración), el pedido
**no se pierde**: igual queda guardado en Firestore y se sigue mandando por
WhatsApp con normalidad — el email es un aviso extra, no un paso crítico
del checkout.

## Cómo mantener actualizados varios clientes a la vez

Como cada cliente es un repositorio/sitio aparte, no hay una forma
automática de que "una mejora se aplique sola a todos". La forma más simple
de manejarlo:

**Para clientes nuevos:** marcá este repositorio (el de la plantilla) como
*Template repository* en GitHub (Settings → tildar "Template repository").
Así, para arrancar uno nuevo simplemente usás el botón **"Use this
template"**, obtenés una copia limpia, y solo agregás el `config.js` y el
logo de ese cliente.

**Para clientes que ya existen:** cuando mejores el motor (como acabamos de
hacer ahora), solo tenés que reemplazar estos 4 archivos en el repositorio
de cada cliente — **nunca** `config.js` ni `log.png`, que son lo único
propio de cada uno:
- `index.html`
- `style.css`
- `app.js`
- `firestore.rules` (y volver a pegarlas en Firebase Console → Firestore → Reglas)

Si en algún momento tenés muchos clientes y esto se vuelve tedioso, el
siguiente paso natural es armar un repositorio "motor" separado y que cada
cliente lo use como *git submodule*, para actualizar todos con un solo
comando — pero para una cantidad chica de clientes, copiar esos 4 archivos
a mano es más simple y con menos posibilidad de error.

## Buscador con sugerencias

Al escribir en el buscador aparece un desplegable con hasta 6 productos
sugeridos (con foto). Prioriza coincidencias directas; si no encuentra
ninguna y el texto tiene 3 letras o más, prueba tolerando un par de
errores de tipeo. Todo corre en el navegador, sin servicios externos.

## Panel de estadísticas (admin)

Nueva pestaña **ESTADÍSTICAS** en el panel admin: pedidos totales,
ingresos totales, productos más vendidos, clientes más activos e ingresos
por semana. Se calcula en el momento a partir de los pedidos ya cargados,
sin costo ni configuración extra.

> Los pedidos hechos **antes** de esta actualización no tienen el detalle
> por producto/cliente (son datos nuevos que se empiezan a guardar de acá
> en adelante), así que no van a aparecer en "productos más vendidos" ni
> en "clientes más activos" — sí se cuentan en el total de pedidos e
> ingresos.

## Exportar pedidos a Excel

Botón **"Exportar a Excel"** en la pestaña HISTORIAL del panel admin.
Descarga un archivo `.csv` (fecha, total, cliente, detalle) que se abre
directo en Excel o Google Sheets — no hace falta ninguna librería extra.

## Historial de compras para el cliente

Un cliente mayorista logueado ahora tiene un botón **"Ver mis pedidos"**
en su perfil (ícono ☰), con sus compras anteriores. Las reglas de
Firestore solo dejan que cada uno vea las suyas, nunca las de otro
cliente. Igual que con las estadísticas: los pedidos de antes de esta
actualización no van a aparecer acá.

## Cómo carga productos el dueño de la tienda

Una vez logueado como administrador: ícono ⚙️ → pestaña **PRODUCTOS** →
completar el formulario (nombre, precios, stock, categoría, imágenes,
descripción) → **GUARDAR PRODUCTO**. Los clientes mayoristas que se
registren van a aparecer en la pestaña **CLIENTES**, pendientes de
aprobación hasta que el admin los apruebe con un clic.

---

## Ejemplos de configuración por tipo de negocio

Estos son puntos de partida para copiar dentro de `config.js`. El resto de
los campos (Firebase, WhatsApp, redes) siempre se completan igual.

**Kiosco / almacén** — normalmente sin precio mayorista, categorías
simples:
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
],
```

**Mayorista / minorista puro** (indumentaria, bazar, lo que sea) —
el foco está en el precio diferenciado:
```js
businessType: "mayorista_minorista",
features: {
  wholesalePricing: true,
  stockControl: true,
  heroSlider: true,
  userRegistration: true,
},
```

**Tienda de electrónica** (la configuración por defecto de esta
plantilla) — usa las categorías ya cargadas en `config.js`.

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
],
```
(Ver la sección "Variantes de producto" más arriba para cargar los talles.)

---

## Notas de seguridad y limitaciones conocidas

Para que quede claro qué tan sólida es esta base y qué le falta si el
negocio crece mucho:

- **Contraseñas de clientes mayoristas**: como el formulario pide un
  "nombre de usuario" y no un email real, esas cuentas usan un email
  interno inventado. Eso significa que **no existe recuperación de
  contraseña por correo** para esas cuentas — si un cliente la olvida, la
  solución más simple es borrar su cuenta desde Authentication y pedirle
  que se registre de nuevo. El administrador, en cambio, sí usa su email
  real y puede recuperar la contraseña normalmente.
- **Descuento de stock sin login**: para que el checkout por WhatsApp
  pueda descontar stock sin backend propio, las reglas dejan que
  cualquier visitante reduzca (nunca aumente) el stock de un producto.
  Es un compromiso razonable para un comercio chico, pero en teoría alguien
  mal intencionado podría spamear pedidos para vaciar el stock mostrado.
  Si esto llega a ser un problema real, el siguiente paso es mover ese
  descuento a una Cloud Function (requiere plan Blaze de Firebase).
- **Sin protección anti-bots** en el alta de pedidos/registros (tipo
  reCAPTCHA o Firebase App Check). Para un comercio chico normalmente no
  hace falta, pero es la próxima capa de seguridad si el sitio recibe
  mucho tráfico.
- **Alta del administrador**: queda protegida por dos candados (el email
  tiene que coincidir con el autorizado en `config/setup`, y tiene que
  estar verificado por correo real), pero seguí buenas prácticas básicas
  igual: no compartas el email autorizado públicamente, y si alguna vez
  hace falta cambiar de administrador, la única forma es borrar el
  documento en `admins` y el campo `allowedAdminEmail` desde la consola de
  Firebase (no hay forma de hacerlo desde la web, a propósito).

## Ideas para más adelante (no incluidas todavía)

- Precio distinto por variante (hoy todas las variantes de un producto
  comparten el mismo precio).
- Notificación automática por WhatsApp Business API real (hoy es por
  email vía EmailJS — ver sección de arriba para el porqué).
- Cantidad mínima de compra para clientes mayoristas.
- Cupones de descuento.
