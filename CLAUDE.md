# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Reglas de Comunicación y Código

- **Hablar siempre en español** con el usuario
- Comentarios, variables y funciones en el código **en inglés**
- Seguir conventional commits (`feat:`, `fix:`, `docs:`) - **nunca mencionar a Claude** en los mensajes de commit
- **Prohibido usar TypeScript** - usar archivos `.d.ts` con JSDoc para tipado
- Astro con **vanilla JS, vanilla CSS y HTML** únicamente

## Comandos de Desarrollo

```bash
npm install        # Instalar dependencias (Astro v5)
npm run dev        # Servidor de desarrollo en http://localhost:4321
npm run build      # Compilar sitio estático a dist/
npm run preview    # Servir build de producción para validación
npm run test       # Ejecutar build de producción (usado en CI)
```

## Arquitectura

Sitio estático bilingüe (español/inglés) en Astro para el libro "Liderazgo Afectivo".

### Sistema de Internacionalización

El sistema i18n (`src/i18n/`) es el patrón arquitectónico central:
- `translations.ts` exporta traducciones tipadas y mapeo de rutas para ambos idiomas
- `es.json` / `en.json` contienen todo el copy organizado por página (home, preview, blog, contact)
- Páginas en español en raíz (`/`, `/primeras-paginas`, `/blog`, `/contacto`)
- Páginas en inglés bajo prefijo `/en/` (`/en/`, `/en/preview`, `/en/blog`, `/en/contact`)
- La constante `PATHS` mapea claves de página a sus URLs localizadas
- Cada página importa traducciones via `getTranslations(lang)` y las pasa a Layout y componentes

### Patrón de Páginas

Las páginas siguen un patrón consistente:
1. Establecer constante `lang` ('es' o 'en')
2. Llamar `getTranslations(lang)` y `getAlternateLang(lang)`
3. Construir objeto `alternateUrls` para etiquetas hreflang
4. Pasar traducciones a componentes Layout, Header y Footer

### Componente Layout

`Layout.astro` maneja:
- Meta tags SEO (Open Graph, Twitter Cards)
- Datos estructurados Schema.org (esquemas Book y WebSite)
- Enlaces hreflang alternativos para cambio de idioma
- Estilos globales y variables CSS

### Componente Header

El componente Header gestiona:
- Menú hamburguesa responsive para móvil
- Toggle de idioma con persistencia en localStorage
- Auto-redirección basada en preferencia de idioma del navegador (visitantes nuevos)

## Convenciones de Código

- Nombres de componentes: PascalCase (`Header.astro`, `Footer.astro`)
- Nombres de páginas: lowercase (`index.astro`, `contacto.astro`)
- Estilos scoped dentro de componentes; estilos globales solo en Layout
- Prettier con indentación de 2 espacios
- Conventional commits: `feat:`, `fix:`, `docs:` (descripciones en español aceptables)

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) ejecuta en PRs y pushes a main:
- Ejecuta `npm run test` (build de producción)
- Sube `dist/` como artefacto `astro-preview` para revisión
