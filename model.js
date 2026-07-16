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
        const nm = String(name).trim();
        const q = Math.max(1, parseInt(qty, 10) || 1);
        const cat = category || 'other';
        // Merge into an existing UNCHECKED item with the same name (case-insensitive)
        // and category — adding "Milk" twice bumps qty instead of making two rows.
        // A checked (already-bought) match is left alone; a re-add starts a fresh need.
        const dup = this.items.find(i =>
          !i.checked && i.category === cat && i.name.toLowerCase() === nm.toLowerCase());
        if (dup) { dup.qty = Math.min(99, dup.qty + q); this.save(); return dup; }
        const item = {
          id: uid(), name: nm, qty: q, category: cat, checked: false,
          source, createdAt: Date.now(), seq: ++seq,
        };
        this.items.push(item);
        this.save();
        return item;
      },
      update(id, fields) {
        const it = this.items.find(i => i.id === id);
        if (!it) return null;
        if (fields.name !== undefined) { const nm = String(fields.name).trim(); if (nm) it.name = nm; }
        if (fields.qty !== undefined) it.qty = Math.max(1, Math.min(99, parseInt(fields.qty, 10) || 1));
        if (fields.category !== undefined) it.category = fields.category || 'other';
        this.save();
        return it;
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

  /* History of previously-added item names, for autocomplete. Persists
     independently of the current list (survives deleting the item). Keyed by
     lowercased name; remembers the last category and how often it's been added. */
  function createHistory(storage) {
    const HKEY = 'grocery-history-v1';
    let map = {};
    try { map = JSON.parse(storage.getItem(HKEY) || '{}') || {}; } catch { map = {}; }
    return {
      record(name, category) {
        const nm = String(name).trim();
        const key = nm.toLowerCase();
        if (!key) return;
        const e = map[key] || { name: nm, count: 0 };
        e.name = nm; e.category = category || e.category || 'other';
        e.count = (e.count || 0) + 1; e.last = Date.now();
        map[key] = e;
        storage.setItem(HKEY, JSON.stringify(map));
      },
      suggest(query, limit = 6) {
        const q = String(query || '').trim().toLowerCase();
        let arr = Object.values(map);
        if (q) arr = arr.filter(e => e.name.toLowerCase().includes(q) && e.name.toLowerCase() !== q);
        arr.sort((a, b) => (b.count - a.count) || ((b.last || 0) - (a.last || 0)));
        return arr.slice(0, limit);
      },
    };
  }

  return { CATEGORIES, catById, createStore, sortForDisplay, createHistory, KEY };
});
