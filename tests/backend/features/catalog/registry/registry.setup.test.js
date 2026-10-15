const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorld } = require('../../../../harness/appsscript-mock.js');

function boot() {
  const w = createWorld();
  w.call('setup');
  w.call('setAdminPin', '4321');
  w.admin = (body) => w.api({ ...body, admin: { pin: '4321' } });
  return w;
}

test(
  'Setup: creates registry tabs, default ' + 'lists, and is safe to repeat',
  () => {
    const w = boot();
    w.call('setup');
    const names = w.registry.getSheets().map((s) => s.getName());
    assert.deepEqual(names.sort(), ['Clients', 'Forms', 'Lists']);
    const lists = w.admin({ action: 'admin.lists.get' }).lists;
    assert.equal(lists.levels.length, 5);
    assert.equal(lists.sections.length, 14);
    assert.equal(lists.wa_sections.length, 33);
    assert.equal(w.registry.getSheetByName('Lists').getLastRow(), 7);
    assert.deepEqual(w.triggers, [], 'setup books no timer');
  }
);
