# Groceries

A small, personal, mobile-first grocery checklist PWA. No framework, no build step, no backend — plain HTML/CSS/JS with `localStorage` for persistence.

## Features

- Add / remove items, each with an optional quantity (`×2`)
- Check / uncheck while shopping; checked items sink to the bottom of their category
- Items grouped by category (Produce, Dairy, Meat, …) with a filter-chip row
- One-tap **Uncheck all** to reset the list after a shop
- **Undo** toast after a delete or a reset (5-second window)
- Installable to your phone home screen (PWA) and works offline
- Light/dark aware, respects safe-area insets on notched phones

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
