# Groceries

A small, personal, mobile-first grocery checklist PWA. No framework, no build step, no backend — plain HTML/CSS/JS with `localStorage` for persistence.

## Features

- Add / remove items, each with an optional quantity (`×2`)
- **Edit an item in place** (pencil icon) — fix a name or change quantity without deleting
- **Autocomplete** from what you've added before — type a few letters, tap a suggestion to add instantly
- **Duplicate merge** — adding the same item twice bumps its quantity instead of making two rows
- **Custom category order** (in settings) — reorder categories to match your store's aisles
- Check / uncheck while shopping; checked items sink to the bottom of their category
- Items grouped by category (Produce, Dairy, Meat, …) with a filter-chip row
- One-tap **Uncheck all** to reset the list after a shop
- **Undo** toast after a delete, a reset, or a clear-all (5-second window)
- **Settings sheet** (gear icon): pick a theme color (6 options) and Appearance (System / Light / Dark)
- **Clear entire list** in settings, with undo
- Full-width add input so you can see what you're typing; a "+ Add item" row at the end of the list jumps you to it
- Subtle haptic tick on check (phones that support `navigator.vibrate`)
- Installable to your phone home screen (PWA) and works offline
- Auto-updates when online (service worker is network-first for the app shell), safe-area insets on notched phones

## Run it locally

Any static server works. From this folder:

```bash
# Python
python -m http.server 8731
# or Node
npx serve -l 8731 .
```

Then open `http://localhost:8731`. A service worker + `localhost` secure context means the PWA install prompt works here too.

> Installing to a phone home screen requires HTTPS (or `localhost`). To use it on your phone, host the folder on any static HTTPS host (GitHub Pages, Netlify, Vercel) and open that URL on the phone → Share → *Add to Home Screen*.

## Tests

```bash
node test-model.js
```

Deterministic, dependency-free tests for the data model (add/remove/toggle, checked-sink sort, uncheck-all, snapshot/restore undo, persistence round-trip, meal-plan seam).

**UI integration test** (`test-ui.html`) drives the real app through real DOM events — add with qty+category, check→sink, delete→undo, reset→undo restores, refresh→persists. Run it by serving the folder and opening `test-ui.html` in a browser (it loads `index.html` in an iframe and reports PASS/FAIL on the page), or headless:

```bash
# with the static server running on :8731
chrome --headless=new --dump-dom http://localhost:8731/test-ui.html
```

## Files

| File | Purpose |
|---|---|
| `index.html` | The app: markup, styles, and view layer (all inline) |
| `model.js` | Core data model — runs in the browser **and** under Node for tests |
| `sw.js` | Service worker (offline + installable) |
| `manifest.webmanifest` | PWA manifest |
| `icons/` | App icons + `make_icons.py` to regenerate them |
| `test-model.js` | Node tests for `model.js` |

## Future: meal-plan integration

The data model deliberately separates **items** from **how items get added**. Every item carries a `source` field (`"manual"` today). A future meal-plan feature only needs to call:

```js
store.addMany([{ name: 'Chicken', qty: 2, category: 'meat' }], 'meal-plan');
```

Nothing in the add/remove/toggle/sort/reset logic depends on `source`, so meal-plan population can be layered on later without touching the core. That integration is **not** built yet — this app is standalone for now.
