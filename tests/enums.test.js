const test = require('node:test');
const assert = require('node:assert/strict');
const enums = require('../domain/enums.js');
const { createWorld } = require('./harness/appsscript-mock.js');

test('Enums: frozen, with distinct values and CONSTANT_CASE members', () => {
  for (const [name, members] of Object.entries(enums)) {
    assert.equal(Object.isFrozen(members), true, `${name} is frozen`);
    const values = Object.values(members);
    assert.equal(new Set(values).size, values.length, `${name} values`);
    for (const key of Object.keys(members)) {
      assert.match(key, /^[A-Z][A-Z0-9_]*$/, `${name}.${key}`);
    }
  }
});

test('Enums: the backend bundle has the same enums as Node', () => {
  const w = createWorld();
  for (const [name, members] of Object.entries(enums)) {
    assert.deepEqual({ ...w.ctx[name] }, { ...members }, name);
  }
});
