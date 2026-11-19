# Repository Guidelines

## Project Structure & Module Organization
- Source lives in `src/`, with `pages/` for route-level `.astro`, `components/` for reusable UI (PascalCase), `layouts/` for shared wrappers, and `assets/` for vector artwork referenced throughout the site.
- Static media—videos, imagery, and logos—belongs in `public/`, where files are served verbatim; keep heavy files out of `src/` to avoid bundling them.
- `astro.config.mjs` defines global integrations and output settings; update it when adding tooling or changing deployment targets.
- Build artifacts land in `dist/`; this directory is generated and should stay untracked.

## Build, Test, and Development Commands
- `npm install` installs Astro (v5) and project dependencies.
- `npm run dev` starts the local dev server on http://localhost:4321 with hot reloading.
- `npm run build` compiles the static site into `dist/` for deployment.
- `npm run preview` serves the latest build to validate production behavior.
- `npm run test` runs the same production build executed in CI (`npm run ci` is an alias for automation hooks).

## Coding Style & Naming Conventions
- Follow Prettier defaults with 2-space indentation; run your editor’s formatter or `npx prettier --write` before committing.
- Keep component filenames in `src/components` PascalCase (e.g., `HeroBanner.astro`); pages under `src/pages` stay lowercase or `index.astro` for route roots.
- Prefer scoped styles within components; reserve global styles for layout-level rules.
- Write semantic HTML and meaningful `aria` attributes to preserve accessibility documented for the marketing site.

## Testing Guidelines
- Use `npm run test` before every push; it ensures the build artifact is production-ready without requiring TypeScript tooling.
- After building, spot-check via `npm run preview`, validating responsive breakpoints and localized copy.
- When introducing automated tests, colocate them with the relevant component/page and document the execution command in this file.
- Audiobook backend (`functions/`, an npm workspace): `npm run test` also runs its Vitest suite, so CI runs it too.

## Commit & Pull Request Guidelines
- Mirror the repository’s conventional commit style (`feat:`, `fix:`, `docs:`); concise Spanish descriptions are welcome if they stay consistent.
- Keep commits focused on a single change set and include assets updates when they impact the UI.
- Pull requests should provide: a summary of the intention, screenshots or clips for visual tweaks, linked issues/tasks, and noted manual test steps.
- Confirm the **CI Preview** workflow finishes green; download the `astro-preview` artifact for reviewer-ready previews and flag any regressions found there.

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
<!-- >>> kj:managed:guidelines v1 >>> (regenerated by kj harden: anything written inside is lost; keep your own rules outside this block) -->
# Project guidelines (kj harden)

## Code
- SOLID, DRY, KISS, YAGNI. Names in English, descriptive.
- No silent fallbacks: the system works or fails loudly. Validate and sanitize all input.

## Commits & PRs
- Conventional Commits (`feat:`/`fix:`/`refactor:`/`docs:`/`test:`/`chore:`). Header <=100 chars, lowercase subject.
- Never attribute commits or PRs to AI (no `Co-Authored-By`, no "generated by").
- Atomic PRs: one purpose, small (~150 LOC). Each PR compiles and passes its tests on its own.

## Testing
- Test-first. Run the tests after each meaningful change. Never skip tests.

## Security
- Never commit secrets, keys or tokens. Parameterized queries; sanitize output against injection.

## Files
- Edit existing files in place; never overwrite a whole file to make a small change.

## JavaScript / TypeScript
- `const` by default; arrow callbacks; template literals.
- ES2025 target: never `var`, `document.write`, `alert`/`confirm`/`prompt`, `escape`/`unescape`, `substr`.
  Prefer modern APIs (`structuredClone`, `Object.groupBy`, `Array.at`/`findLast`/`toSorted`, optional chaining, `??`).
- ES modules (`import`/`export`), never `require` in new code. Avoid `any` in TypeScript.

## UI/UX
- No native `alert`/`confirm`/`prompt` — use the app's modal system. Loading states; accessible; mobile-first.
<!-- <<< kj:managed:guidelines <<< -->
