# Repository Guidelines

## Project Structure & Module Organization
- Root mini program files: `app.js`, `app.json`, `app.wxss`, `project.config.json`.
- Pages: `pages/<name>/` (e.g., `pages/index`, `pages/detail`, `pages/add`, `pages/settings`).
- Components: `components/<name>/` (custom UI like `custom-loading`).
- Utilities: `utils/` (e.g., `cloud_utils.js`, `model_utils.js`, `i18n.js`, `baidu_ai.js`).
- Cloud Functions: `cloudfunctions/<func>/` (e.g., `login`, `getSharedPlant`).
- Assets: `images/`.

## Build, Test, and Development Commands
- Run locally: Use WeChat Developer Tools, open repo folder (reads `project.config.json`).
- Dependencies: `npm install` (if needed; project has minimal runtime deps).
- Tests: none configured (`npm test` is a stub).
- Cloud functions: deploy via WeChat DevTools/Tencent Cloud panel per function folder.

## Coding Style & Naming Conventions
- JavaScript: 2-space indentation, single quotes, semicolons, camelCase for variables/functions.
- Files: page bundles follow WeChat conventions (`.wxml`, `.wxss`, `.js`, `.json`).
- Directories: lowercase names (`pages/index`, `components/custom-loading`).
- Strings/i18n: prefer `i18n.t(...)` or app-level `app.t(...)` where available.
- Avoid hardcoding secrets in client code; use cloud functions or environment config.

## Testing Guidelines
- Manual testing in WeChat DevTools: Preview + real device.
- Critical flows: add plant, recognition, batch water/fertilize, image memo/order, settings model switch, share preview.
- Cloud functions: test each function from DevTools console with sample payloads.
- Aim for no regressions on `pages/index` load time and UI layout.

## Commit & Pull Request Guidelines
- Commit style: Prefer Conventional Commits (observed examples: `feat(ui): ...`, `fix(ui): ...`).
  - Types: `feat`, `fix`, `docs`, `refactor`, `chore`, `perf`, `style`.
  - Scope examples: `(ui)`, `(model)`, `(cloud)`, `(i18n)`.
- PRs: clear description, linked issues, before/after screenshots for UI, steps to reproduce/verify, and notes on cloud function changes/deploy steps.

## Security & Configuration Tips
- Move API keys (e.g., model keys) to secure endpoints/cloud functions; never ship live keys in client JS.
- CDN assets: see `CDN_DEPLOYMENT_GUIDE.md`; whitelist domains in Mini Program settings and use HTTPS.
