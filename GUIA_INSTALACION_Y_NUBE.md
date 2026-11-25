# Guía de Instalación, GitHub Pages y Google Drive — Coldi's Corner 🐧💜

Guía personalizada para el repositorio **`alfredosmp/coldis-corner`**:
- **Repositorio:** `https://github.com/alfredosmp/coldis-corner`
- **Enlace del celular (PWA sin internet):** `https://alfredosmp.github.io/coldis-corner/`
- **Instalador Windows 11:** `release/Coldis-Corner-Setup-1.0.0.exe`

---

## Paso 1 — Crear el repositorio en GitHub (1 minuto)

1. Entra a [https://github.com/new](https://github.com/new) (con tu cuenta **`alfredosmp`**).
2. En **Repository name** escribe exactamente: `coldis-corner`
3. Déjalo en **Public** *(necesario para que GitHub Pages y las actualizaciones automáticas de Windows 11 sean 100% gratis; aquí solo vive el código de la app, nunca los apuntes ni libros de Mafecita)*.
4. **No** marques README, `.gitignore` ni licencia (créalo vacío).
5. Haz clic en **Create repository**.
6. Dentro del repositorio ve a **Settings → Pages**:
   - En **Source**, selecciona **GitHub Actions**.

---

## Paso 2 — Crear el Client ID gratuito de Google Drive (3 minutos)

1. Entra a [https://console.cloud.google.com/](https://console.cloud.google.com/) (no pide tarjeta).
2. Crea un proyecto nuevo llamado **`Coldis Corner`**.
3. Ve a **APIs y servicios → Biblioteca**, busca **`Google Drive API`** y pulsa **Habilitar**.
4. Ve a **APIs y servicios → Pantalla de consentimiento de OAuth**:
   - Tipo: **Externo** → Nombre: **`Coldi's Corner`** → guarda.
   - En **Público / Usuarios de prueba (Test users)** agrega el Gmail de Mafecita (y el tuyo si quieres probar).
5. Ve a **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo de aplicación: **Aplicación web**
   - En **Orígenes de JavaScript autorizados**, agrega:
     - `https://alfredosmp.github.io`
     - `http://localhost:5173`
   - En **URI de redireccionamiento autorizados**, agrega exactamente estos 3:
     - `https://alfredosmp.github.io/coldis-corner/`
     - `http://127.0.0.1:47821/oauth-callback`
     - `http://localhost:5173/`
6. Haz clic en **Crear** y guarda el **ID de cliente** (`...apps.googleusercontent.com`) y el **Secreto de cliente**.

---

## Paso 3 — Configurar el Secret en GitHub (para que el celular ya venga conectado)

1. En tu repositorio `alfredosmp/coldis-corner`, ve a **Settings → Secrets and variables → Actions → New repository secret**.
2. Crea el secret:
   - Name: `VITE_GOOGLE_CLIENT_ID`
   - Secret: pega tu **ID de cliente** de Google (`...apps.googleusercontent.com`).
3. En tu computadora, pega tu `VITE_GOOGLE_CLIENT_ID` y `VITE_GOOGLE_CLIENT_SECRET` en `e:\Mis descargas\coldi-derecho\.env` (ese archivo nunca se sube a GitHub) y recompilamos el `.exe` final con `npm run build:win`.

---

## Paso 4 — Cómo sacar actualizaciones futuras si Mafecita reporta un error

- **Para actualizar el celular (automático):** hacemos el cambio aquí y subimos a GitHub (`git push`). En ~1 minuto `https://alfredosmp.github.io/coldis-corner/` se actualiza solo.
- **Para actualizar Windows 11 (automático):** subimos el número de versión en `package.json` (ej. `1.0.0` → `1.0.1`), corremos `npm run build:win`, y subimos `Coldis-Corner-Setup-1.0.1.exe`, `Coldis-Corner-Setup-1.0.1.exe.blockmap` y `latest.yml` a un nuevo **Release** en `https://github.com/alfredosmp/coldis-corner/releases/new` con tag `v1.0.1`. La próxima vez que ella abra la app con internet, se actualiza sola sin perder nada.
