# Brasa y Carbón · Sistema de restaurante

Este proyecto es una sola aplicación que se adapta sola a computadora, tablet y celular.
Guarda todo en una base de datos real (Supabase) y se publica en Netlify.

Lo que necesitas: una cuenta gratuita en **Supabase**, una en **GitHub** y una en **Netlify**.

---

## PARTE 1 · Supabase (la base de datos)

### Paso 1. Crear el proyecto
1. Entra a supabase.com e inicia sesión.
2. Toca **New project**. Ponle el nombre que quieras (por ejemplo, `brasa-y-carbon`), elige una contraseña para la base de datos y guárdala en un lugar seguro.
3. Elige la región más cercana a ti y toca **Create new project**. Espera un par de minutos.

### Paso 2. Crear toda la base de datos con un solo pegado
1. En el menú de la izquierda toca **SQL Editor**.
2. Toca **New query**.
3. Abre el archivo `supabase/1_schema.sql` con el Bloc de notas, copia **todo** el contenido y pégalo en el editor.
4. Toca el botón verde **Run**. Debe decir **Success**.

Con eso ya se crearon las tablas, la seguridad por roles, tu carta con los precios, tus 15 mesas y la carpeta de fotos.
No tienes que diseñar nada más.

### Paso 3. Apagar la confirmación por correo
Para que puedas crear empleados desde el sistema sin que tengan que confirmar un correo:
1. En el menú de la izquierda toca **Authentication**.
2. Entra a **Sign In / Providers** y abre **Email**.
3. Apaga **Confirm email** y toca **Save**.

### Paso 4. Crear tu usuario (el dueño)
1. En el menú de la izquierda toca **Authentication** y luego **Users**.
2. Toca **Add user** y elige **Create new user**.
3. Escribe tu correo y una contraseña. Marca la casilla **Auto Confirm User**.
4. Toca **Create user**.

### Paso 5. Convertir ese usuario en administrador (dueño)
1. Vuelve a **SQL Editor** y toca **New query**.
2. Abre el archivo `supabase/2_hacer_administrador.sql`.
3. Cambia `CAMBIA_ESTE_CORREO@ejemplo.com` por **el mismo correo** del paso 4. Deja las comillas.
4. Copia todo, pégalo y toca **Run**. Debe decir **Success**.

### Paso 6. Copiar las dos llaves de conexión
1. En el menú de la izquierda toca **Project Settings** (el engranaje) y luego **API Keys**.
   Si no ves una de las dos, también está en **Settings → API**.
2. Copia estas dos cosas y guárdalas en un bloc de notas:
   - **Project URL** (empieza con `https://` y termina en `.supabase.co`)
   - La clave **publishable** (o **anon public**, según cómo la muestre tu panel).
   **No** copies la clave `secret` ni `service_role`.

### Carpeta de fotos
No tienes que hacer nada. El Paso 2 crea sola una carpeta llamada **productos** y la deja **pública** (para que las fotos se vean en el menú).

Solo si al subir una foto desde el sistema aparece un error, créala a mano:
1. Toca **Storage** en el menú de la izquierda.
2. Toca **New bucket**.
3. En el nombre escribe exactamente `productos` y activa **Public bucket**.
4. Toca **Create**.

---

## PARTE 2 · GitHub y Netlify (para publicar el sistema)

### Paso 7. Subir los archivos a GitHub
1. Descomprime el ZIP en tu computadora.
2. Entra a github.com, inicia sesión y toca **New repository**. Ponle un nombre (por ejemplo, `brasa-y-carbon`), déjalo **Private** y toca **Create repository**.
3. En la página que aparece toca **uploading an existing file**.
4. Arrastra **todo lo que hay dentro** de la carpeta descomprimida (las carpetas `src`, `public`, `supabase` y los archivos sueltos). No arrastres el ZIP.
5. Toca **Commit changes**.

### Paso 8. Publicar en Netlify
1. Entra a netlify.com e inicia sesión (puedes usar tu cuenta de GitHub).
2. Toca **Add new site** y luego **Import an existing project**.
3. Elige **GitHub** y selecciona el repositorio que creaste. No cambies nada de la configuración: ya viene lista.
4. Antes de publicar, abre **Environment variables** (o **Add environment variables**) y agrega estas dos, con estos nombres exactos:

   | Nombre | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | tu **Project URL** del Paso 6 |
   | `VITE_SUPABASE_ANON_KEY` | tu clave **publishable / anon** del Paso 6 |

5. Toca **Deploy**. En unos minutos Netlify te da un enlace para entrar al sistema.

Si ya habías publicado y luego agregas o cambias las variables, entra a **Deploys** y toca **Trigger deploy → Clear cache and deploy site**.

### Probar en tu computadora (opcional)
Si algún día quieres probarlo en tu computadora, copia `.env.example` como `.env`, pon tus dos valores y ejecuta `npm install` y luego `npm run dev`. Para publicar en Netlify no lo necesitas.

---

## Cómo se usa al empezar

1. Abre el enlace de Netlify e inicia sesión con tu correo y contraseña (el del Paso 4).
2. **Caja**: abre la caja con el dinero con que empiezas. Sin caja abierta no se puede cobrar.
3. **Usuarios y roles**: toca **Nuevo usuario** para crear a tus cajeros, cocineros y mozos. Les das correo, contraseña y rol. Ellos entran con esos datos, sin pasar por Supabase.
4. **Menú y productos**: cambia precios, sube fotos y agrega platos.
5. **Inventario**: carga tus productos (carnes, carbón, aceite…) y arma las recetas. Al cobrar, el inventario se descuenta solo.

### Qué ve cada rol
| Rol | Pantallas |
|---|---|
| Dueño | Todas |
| Cajero | Punto de venta, mesas, caja, cocina |
| Mozo | Punto de venta y mesas (toma pedidos y pide la cuenta) |
| Cocina | Cocina, inventario, recetas y mermas |

### Cosas que conviene saber
- El botón **Exportar a Excel** descarga un archivo `.csv` que Excel abre directamente.
- Si alguien olvida su contraseña, entra a su cuenta (botón **Mi cuenta**) mientras todavía tiene sesión y la cambia. Si ya no puede entrar, pídele al dueño que lo desactive y cree un usuario nuevo con otro correo, o cambia su contraseña en Supabase → Authentication → Users.
- Las personas que no hayan sido creadas por el dueño pueden registrarse técnicamente, pero quedan **inactivas** y no ven nada.
- Las fotos de ejemplo de la carta salen de tu moodboard. Cámbialas desde **Menú y productos → Editar**.
