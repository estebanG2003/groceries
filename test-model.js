/* Deterministic tests for the grocery data model.
   Run: node test-model.js    (no dependencies) */
const { createStore, sortForDisplay } = require('./model.js');

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

console.log('\n' + (fail === 0 ? '✅ ALL PASS' : '❌ FAILURES') + `  (${pass} passed, ${fail} failed)`);
process.exit(fail === 0 ? 0 : 1);
