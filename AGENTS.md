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

## Commit & Pull Request Guidelines
- Mirror the repository’s conventional commit style (`feat:`, `fix:`, `docs:`); concise Spanish descriptions are welcome if they stay consistent.
- Keep commits focused on a single change set and include assets updates when they impact the UI.
- Pull requests should provide: a summary of the intention, screenshots or clips for visual tweaks, linked issues/tasks, and noted manual test steps.
- Confirm the **CI Preview** workflow finishes green; download the `astro-preview` artifact for reviewer-ready previews and flag any regressions found there.
