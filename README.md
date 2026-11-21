# Liderazgo Afectivo

Sitio web oficial del libro "Liderazgo Afectivo", desarrollado con Astro. Este sitio presenta información sobre el lanzamiento del libro y su disponibilidad.

## 🚀 Características

- Diseño moderno y responsive
- Video de fondo a pantalla completa
- Integración con la editorial Savvily
- Optimizado para rendimiento

## 🛠️ Stack Tecnológico

- [Astro](https://astro.build)
- TypeScript
- CSS Moderno

## 🔧 Desarrollo Local

1.Clona el repositorio

```bash
git clone git@github.com:manufosela/liderazgoafectivo.com.git
```

2.Instala dependencias

```bash
npm install
```

3.Inicia el servidor de desarrollo

```bash
npm run dev
```

4.Abre [http://localhost:4321](http://localhost:4321) en tu navegador

## 📦 Estructura del Proyecto

/ 
├── public/
│ ├── liderazgoafectivo_videoinicial.mp4
│ ├── portada_LiderazgoAfectivo_ES.jpg
│ ├── portada_LiderazgoAfectivo_EN.png
│ └── liderazgo_afectivo_logo.svg
├── src/
│ ├── components/
│ │ ├── Header.astro
│ │ └── Footer.astro
│ ├── layouts/
│ │ └── Layout.astro
│ └── pages/
│ └── index.astro
└── package.json

## 🎧 Audiolibro privado: códigos de acceso

El backend del audiolibro vive en `functions/` (workspace de npm, Node 24). Cada código va unido a un correo y en la base solo se guardan sus huellas HMAC, nunca el código ni el correo.

Para gestionar los códigos, con credenciales de Google con acceso al proyecto (`gcloud auth application-default login`), la variable `GOOGLE_CLOUD_PROJECT` apuntando al proyecto de Firebase y la clave de huellas de Secret Manager en `AUDIOBOOK_FINGERPRINT_KEY`:

```bash
npm run grants --workspace functions -- create --email <correo> --note <nota>
npm run grants --workspace functions -- list
npm run grants --workspace functions -- revoke <id-corto>
```

El código solo se muestra al crearlo. La lista enseña el id corto, el estado, la fecha y la nota, nunca el código.

También se gestionan desde `/admin`, entrando con una cuenta de Google de la lista `AUDIOBOOK_ADMIN_EMAILS` (secreto de Firebase). La página necesita la configuración web de Firebase (consola de Firebase, Configuración del proyecto, Tus apps) en un `.env` que no se versiona, antes de `npm run build`: `PUBLIC_FIREBASE_API_KEY`, `PUBLIC_FIREBASE_AUTH_DOMAIN`, `PUBLIC_FIREBASE_PROJECT_ID` y `PUBLIC_FIREBASE_APP_ID`. Sin ella, la página avisa de que falta.

## 📝 Licencia

© 2024 Liderazgo Afectivo® - Todos los derechos reservados
