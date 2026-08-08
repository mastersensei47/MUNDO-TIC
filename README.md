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

### 6. Crear el usuario administrador
Authentication → pestaña **Users** → **Add user** → cargá el **email real**
del dueño del negocio y una contraseña → **Add user**. Firebase te muestra
el **UID** de ese usuario en la tabla (una cadena larga de letras y
números) — copialo, lo necesitás en el siguiente paso.

### 7. Convertirlo en administrador
Firestore Database → pestaña **Datos** → **Iniciar colección** → ID de la
colección: `admins` → en "ID del documento" elegí **ID personalizado** y
pegá el UID que copiaste → agregale un campo cualquiera, por ejemplo
`rol` (string) = `admin` → **Guardar**.

Con esto, cuando esa persona inicie sesión con su email en la web, el
panel de administración (⚙️) se le va a abrir automáticamente.

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

## Ideas para más adelante (no incluidas todavía)

- Variantes de producto (talle/color) para tiendas de indumentaria.
- Envío automático de notificación (email o WhatsApp Business API) al
  admin cuando entra un pedido, sin depender de que el cliente abra WhatsApp.
- Separar `index.html`/`style.css`/`app.js` de cada cliente en un
  repositorio propio con control de versiones (Git), para poder actualizar
  la lógica base de todos los clientes a la vez.
