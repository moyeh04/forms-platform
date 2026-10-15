const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const R = require('../../../domain/rules/index.js');
const { sourceOf } = require('../../../scripts/build/site-map.js');

const root = path.resolve(__dirname, '..', '..', '..');
// The domain files in the order the student page loads them.
const page = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8');
const parts = [...page.matchAll(/<script src="([^"]+)"/g)]
  .map((m) => sourceOf(m[1]))
  .filter((file) => file?.startsWith('domain/'));

test('Rules: the loader gathers every function of every part', () => {
  const own = parts.filter((f) => /^domain\/rules\/(?!index)/.test(f));
  for (const file of own) {
    const part = require(path.join(root, file));
    for (const name of Object.keys(part)) {
      assert.equal(R[name], part[name], file + ': ' + name);
    }
  }
});

test('Rules: a page loading the enums and parts gets the same Rules', () => {
  const page = vm.createContext({});
  for (const file of parts) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), page, {
      filename: file
    });
  }
  const names = vm.runInContext('Object.keys(Rules)', page);
  assert.deepEqual([...names].sort(), Object.keys(R).sort());
  assert.equal(
    vm.runInContext("Rules.normalizePhone('+20 101 234 5678')", page),
    '01012345678'
  );
  assert.equal(
    vm.runInContext("Rules.formState({ status: 'draft' })", page),
    'draft'
  );
});
