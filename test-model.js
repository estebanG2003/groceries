/* Deterministic tests for the grocery data model.
   Run: node test-model.js    (no dependencies) */
const { createStore, sortForDisplay, createHistory, hexToRgb, rgbToHex, derivePreset, hsvToRgb, rgbToHsv } = require('./model.js');

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ FAIL: ' + msg); }
}

// In-memory localStorage shim
function memStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), _map: m };
}

console.log('add / remove / toggle');
{
  const s = createStore(memStorage()).load();
  const a = s.add('Milk', 2, 'dairy');
  const b = s.add('Bananas', 1, 'produce');
  ok(s.items.length === 2, 'two items added');
  ok(a.qty === 2 && a.category === 'dairy' && a.source === 'manual', 'item fields set (qty, category, source)');
  ok(b.qty === 1, 'default qty respected');
  s.toggle(a.id);
  ok(s.items.find(i => i.id === a.id).checked === true, 'toggle checks an item');
  s.toggle(a.id);
  ok(s.items.find(i => i.id === a.id).checked === false, 'toggle unchecks again');
  s.remove(b.id);
  ok(s.items.length === 1 && !s.items.find(i => i.id === b.id), 'remove drops the item');
}

console.log('qty guards');
{
  const s = createStore(memStorage()).load();
  ok(s.add('X', 0, 'other').qty === 1, 'qty 0 clamps to 1');
  ok(s.add('Y', -5, 'other').qty === 1, 'negative qty clamps to 1');
  ok(s.add('Z', '3', 'other').qty === 3, 'string qty parses');
  ok(s.add('W', undefined, undefined).category === 'other', 'missing category defaults to other');
}

console.log('checked items sink to bottom (sortForDisplay)');
{
  const s = createStore(memStorage()).load();
  const i1 = s.add('A', 1, 'produce');
  const i2 = s.add('B', 1, 'produce');
  const i3 = s.add('C', 1, 'produce');
  s.toggle(i1.id);                       // check the first-added
  const order = sortForDisplay(s.items).map(i => i.name);
  ok(JSON.stringify(order) === JSON.stringify(['B', 'C', 'A']), 'checked A sinks below B,C -> ' + order.join(','));
  s.toggle(i2.id);
  const order2 = sortForDisplay(s.items).map(i => i.name);
  ok(JSON.stringify(order2) === JSON.stringify(['C', 'A', 'B']), 'unchecked C on top, checked keep insertion order -> ' + order2.join(','));
}

console.log('uncheckAll (reset)');
{
  const s = createStore(memStorage()).load();
  const i1 = s.add('A', 1, 'produce'); const i2 = s.add('B', 1, 'produce');
  s.toggle(i1.id); s.toggle(i2.id);
  ok(s.hasChecked() === true, 'hasChecked true before reset');
  s.uncheckAll();
  ok(s.items.every(i => !i.checked), 'all unchecked after reset');
  ok(s.hasChecked() === false, 'hasChecked false after reset');
}

console.log('snapshot / restore (undo)');
{
  const s = createStore(memStorage()).load();
  const i1 = s.add('A', 1, 'produce'); s.add('B', 1, 'produce');
  const snap = s.snapshot();             // 2 items, none checked
  s.remove(i1.id);
  ok(s.items.length === 1, 'item removed');
  s.restore(snap);
  ok(s.items.length === 2 && s.items.find(i => i.name === 'A'), 'restore brings deleted item back (undo delete)');

  const snap2 = s.snapshot();
  s.uncheckAll(); s.items.forEach(i => i.checked = true); s.save();
  const beforeReset = s.snapshot();
  s.uncheckAll();
  ok(s.items.every(i => !i.checked), 'all checked then reset -> unchecked');
  s.restore(beforeReset);
  ok(s.items.every(i => i.checked), 'restore brings back prior checked state (undo reset)');
}

console.log('persistence round-trip (survives a reload)');
{
  const storage = memStorage();
  const s1 = createStore(storage).load();
  s1.add('Milk', 2, 'dairy');
  const first = s1.add('Eggs', 1, 'dairy');
  s1.toggle(first.id);
  // simulate a fresh page load against the same storage
  const s2 = createStore(storage).load();
  ok(s2.items.length === 2, 'items persisted across reload');
  const eggs = s2.items.find(i => i.name === 'Eggs');
  ok(eggs && eggs.checked === true, 'checked state persisted');
  ok(s2.items.find(i => i.name === 'Milk').qty === 2, 'quantity persisted');
}

console.log('meal-plan seam (addMany with source)');
{
  const s = createStore(memStorage()).load();
  s.add('Manual thing', 1, 'other');
  s.addMany([{ name: 'Chicken', qty: 2, category: 'meat' }, { name: 'Rice', qty: 1, category: 'pantry' }]);
  ok(s.items.length === 3, 'addMany added both items');
  const chicken = s.items.find(i => i.name === 'Chicken');
  ok(chicken.source === 'meal-plan', 'bulk-added items tagged source=meal-plan');
  ok(s.items.find(i => i.name === 'Manual thing').source === 'manual', 'manual items keep source=manual');
  ok(s.countLeft() === 3, 'countLeft counts unchecked');
}

console.log('merge duplicates (same name + category, unchecked)');
{
  const s = createStore(memStorage()).load();
  const a = s.add('Milk', 1, 'dairy');
  const b = s.add('Milk', 2, 'dairy');          // same -> should merge
  ok(s.items.length === 1, 'second identical add merges into one row');
  ok(a.id === b.id && a.qty === 3, 'merged qty is 1+2=3');
  ok(s.add('milk', 1, 'dairy').qty === 4, 'merge is case-insensitive on name');
  s.add('Milk', 1, 'produce');
  ok(s.items.length === 2, 'same name in a DIFFERENT category does not merge');
  const checked = s.add('Eggs', 1, 'dairy'); s.toggle(checked.id);
  s.add('Eggs', 1, 'dairy');
  ok(s.items.filter(i => i.name === 'Eggs').length === 2, 'a re-add of a CHECKED item makes a fresh row, not a merge');
}

console.log('update (edit in place)');
{
  const s = createStore(memStorage()).load();
  const it = s.add('Bananna', 1, 'produce');    // typo
  s.update(it.id, { name: 'Banana', qty: 4 });
  const u = s.items.find(i => i.id === it.id);
  ok(u.name === 'Banana' && u.qty === 4, 'update fixes name and qty');
  s.update(it.id, { qty: 0 });
  ok(s.items.find(i => i.id === it.id).qty === 1, 'update clamps qty to >=1');
  s.update(it.id, { name: '   ' });
  ok(s.items.find(i => i.id === it.id).name === 'Banana', 'update ignores blank name');
  ok(s.update('nope', { name: 'x' }) === null, 'update on missing id returns null');
}

console.log('history / autocomplete');
{
  const st = memStorage();
  const h = createHistory(st);
  h.record('Bananas', 'produce'); h.record('Bananas', 'produce'); h.record('Bread', 'bakery');
  const sug = h.suggest('ban');
  ok(sug.length === 1 && sug[0].name === 'Bananas', 'suggest matches by substring');
  ok(sug[0].category === 'produce', 'suggestion carries last category');
  ok(sug[0].count === 2, 'suggestion counts repeats');
  const top = h.suggest('');
  ok(top[0].name === 'Bananas', 'empty query returns most-frequent first');
  ok(h.suggest('Bananas').length === 0, 'exact full match is not re-suggested');
  const h2 = createHistory(st);   // reload from same storage
  ok(h2.suggest('bre')[0].name === 'Bread', 'history persists across reload');
}

console.log('color helpers (custom RGB theme)');
{
  ok(rgbToHex(255, 0, 0) === '#ff0000', 'rgbToHex red');
  ok(rgbToHex(59, 130, 246) === '#3b82f6', 'rgbToHex arbitrary');
  ok(rgbToHex(300, -5, 128) === '#ff0080', 'rgbToHex clamps out-of-range');
  ok(hexToRgb('#00ff00').join(',') === '0,255,0', 'hexToRgb green');
  ok(hexToRgb('#fff').join(',') === '255,255,255', 'hexToRgb 3-digit shorthand');
  const p = derivePreset(59, 130, 246);
  ok(p.light[0] === '#3b82f6' && p.dark[0] === '#3b82f6', 'derivePreset keeps the chosen accent in both modes');
  ok(/^#[0-9a-f]{6}$/.test(p.light[1]) && /^#[0-9a-f]{6}$/.test(p.dark[1]), 'derived tints are valid hex');
  const sum = h => hexToRgb(h).reduce((a, b) => a + b, 0);
  ok(sum(p.light[1]) > sum(p.light[0]), 'light tint is lighter than the accent');
  ok(sum(p.dark[1]) < sum(p.dark[0]), 'dark tint is darker than the accent');
  ok(rgbToHex(...hexToRgb('#abcdef')) === '#abcdef', 'hex -> rgb -> hex round-trips');
}

console.log('HSV <-> RGB (color picker)');
{
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  ok(eq(hsvToRgb(0, 1, 1), [255, 0, 0]), 'hsv red -> rgb');
  ok(eq(hsvToRgb(120, 1, 1), [0, 255, 0]), 'hsv green -> rgb');
  ok(eq(hsvToRgb(240, 1, 1), [0, 0, 255]), 'hsv blue -> rgb');
  ok(eq(hsvToRgb(0, 0, 1), [255, 255, 255]), 'hsv zero-sat full-val -> white');
  ok(eq(hsvToRgb(0, 0, 0), [0, 0, 0]), 'hsv zero-val -> black');
  const [h, s, v] = rgbToHsv(255, 0, 0);
  ok(Math.round(h) === 0 && s === 1 && v === 1, 'rgbToHsv red -> h0 s1 v1');
  const [h2] = rgbToHsv(0, 255, 0);
  ok(Math.round(h2) === 120, 'rgbToHsv green -> h120');
  // round-trip a few arbitrary colours (within rounding tolerance)
  const rt = (r, g, b) => { const [H, S, V] = rgbToHsv(r, g, b); return hsvToRgb(H, S, V); };
  ok(eq(rt(59, 130, 246), [59, 130, 246]), 'round-trip #3b82f6');
  ok(eq(rt(219, 39, 119), [219, 39, 119]), 'round-trip #db2777');
  ok(eq(rt(120, 60, 230), [120, 60, 230]), 'round-trip arbitrary purple');
}

console.log('\n' + (fail === 0 ? '✅ ALL PASS' : '❌ FAILURES') + `  (${pass} passed, ${fail} failed)`);
process.exit(fail === 0 ? 0 : 1);
