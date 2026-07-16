/* ============================================================
   Grocery List — data model (environment-agnostic).

   This file is the CORE LOGIC, deliberately separated from the
   view (index.html) and from any storage backend. It runs both
   in the browser and under Node (see test-model.js).

   Future meal-plan integration seam:
   The list is a flat array of items; each item carries a `source`
   field ("manual" | "meal-plan"). HOW an item got added is
   decoupled from the item itself. A future meal-plan module only
   needs to call store.addMany(items, "meal-plan") — none of the
   add / remove / toggle / sort / reset logic cares about source,
   so it can be added later without touching this core.
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; // Node
  else root.GroceryModel = api;                                           // browser
})(typeof self !== 'undefined' ? self : this, function () {

  const CATEGORIES = [
    { id: 'produce',   label: 'Produce',        emoji: '🥬' },
    { id: 'dairy',     label: 'Dairy & Eggs',   emoji: '🥛' },
    { id: 'meat',      label: 'Meat & Seafood', emoji: '🥩' },
    { id: 'bakery',    label: 'Bakery',         emoji: '🍞' },
    { id: 'frozen',    label: 'Frozen',         emoji: '🧊' },
    { id: 'pantry',    label: 'Pantry',         emoji: '🥫' },
    { id: 'snacks',    label: 'Snacks',         emoji: '🍫' },
    { id: 'beverages', label: 'Beverages',      emoji: '🥤' },
    { id: 'household', label: 'Household',      emoji: '🧻' },
    { id: 'personal',  label: 'Personal Care',  emoji: '🧴' },
    { id: 'other',     label: 'Other',          emoji: '🛒' },
  ];
  const catById = id => CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

  const KEY = 'grocery-app-v1';
  const uid = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

  /* createStore(storage): storage is any {getItem, setItem} (localStorage in
     the browser, an in-memory shim in tests). Kept injectable so the model is
     testable without a DOM. */
  function createStore(storage) {
    let seq = 0; // tie-breaker so items added in the same ms keep insertion order
    const store = {
      items: [],
      load() {
        try {
          const raw = storage.getItem(KEY);
          this.items = raw ? JSON.parse(raw) : [];
        } catch { this.items = []; }
        // keep seq ahead of anything loaded
        seq = this.items.reduce((m, i) => Math.max(m, i.seq || 0), 0);
        return this;
      },
      save() { storage.setItem(KEY, JSON.stringify(this.items)); return this; },
      snapshot() { return JSON.stringify(this.items); },
      restore(snap) { this.items = JSON.parse(snap); return this.save(); },

      add(name, qty, category, source = 'manual') {
        const item = {
          id: uid(), name: String(name).trim(),
          qty: Math.max(1, parseInt(qty, 10) || 1),
          category: category || 'other', checked: false,
          source, createdAt: Date.now(), seq: ++seq,
        };
        this.items.push(item);
        this.save();
        return item;
      },
      addMany(list, source = 'meal-plan') {   // future meal-plan seam
        (list || []).forEach(i => this.add(i.name, i.qty, i.category, source));
        return this;
      },
      remove(id) { this.items = this.items.filter(i => i.id !== id); return this.save(); },
      toggle(id) {
        const it = this.items.find(i => i.id === id);
        if (it) { it.checked = !it.checked; this.save(); }
        return it;
      },
      uncheckAll() { this.items.forEach(i => i.checked = false); return this.save(); },
      hasChecked() { return this.items.some(i => i.checked); },
      countLeft() { return this.items.filter(i => !i.checked).length; },
    };
    return store;
  }

  /* Within a category, unchecked items first, then checked (checked sink to
     the bottom); stable by insertion order within each half. */
  function sortForDisplay(items) {
    return items.slice().sort((a, b) =>
      (a.checked - b.checked) || ((a.seq || 0) - (b.seq || 0)));
  }

  return { CATEGORIES, catById, createStore, sortForDisplay, KEY };
});
